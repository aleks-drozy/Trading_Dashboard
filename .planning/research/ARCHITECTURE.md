# Architecture Research

**Domain:** Real-time trading signal dashboard — v1.1 integration layer
**Researched:** 2026-03-21
**Confidence:** HIGH (based on direct source inspection + official Alpaca docs)

---

## Standard Architecture

### System Overview

The system runs in a single FastAPI process on Render free tier. All components share one asyncio event loop. The existing v1.0 architecture is unchanged; v1.1 grafts three new integration points onto it.

```
┌──────────────────────────────────────────────────────────────────────┐
│                         FASTAPI PROCESS                              │
│                                                                      │
│  Data Ingest (asyncio tasks)          REST / WebSocket Handlers      │
│  ┌─────────────────────────┐          ┌──────────────────────────┐   │
│  │ BinanceFeed             │          │ SignalBroadcaster        │   │
│  │ (crypto, unchanged)     │          │ 60s loop → WS clients    │   │
│  ├─────────────────────────┤          ├──────────────────────────┤   │
│  │ AlpacaFeed [NEW]        │          │ /chart/bars/{symbol}     │   │
│  │ replaces yfinance poll  │          │ ?tf=1m|5m|15m|1h [MOD]  │   │
│  │ StockDataStream WS      │          ├──────────────────────────┤   │
│  └────────────┬────────────┘          │ /watchlist CRUD          │   │
│               │                      │ (unchanged)              │   │
│               ▼                      └──────────────────────────┘   │
│         [ BarStore ]                                                 │
│         dict[symbol, list[Bar]]                                      │
│         threading.Lock, 500-bar cap per symbol                       │
│         1m bars only — higher TFs aggregated on-demand              │
│                                                                      │
│  Persistence                                                         │
│  ┌──────────────────────┐                                            │
│  │ SQLite               │                                            │
│  │ watchlist, paper     │                                            │
│  │ trades (unchanged)   │                                            │
│  └──────────────────────┘                                            │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ WebSocket + HTTP
                   ┌───────────▼───────────────┐
                   │  REACT FRONTEND (Vercel)  │
                   │                           │
                   │  DashboardPage (signal WS)│
                   │  ChartPage + TF switcher  │
                   │    [MODIFIED]             │
                   │  WatchlistSidebar [NEW]   │
                   └───────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status in v1.1 |
|-----------|----------------|----------------|
| BinanceFeed | Stream closed 1m crypto bars into BarStore | Unchanged |
| AlpacaFeed | Stream closed 1m stock bars into BarStore via Alpaca WS | New (replaces yfinance) |
| BarStore | Thread-safe singleton dict[symbol, list[Bar]], 500-bar cap | Unchanged interface |
| SignalBroadcaster | 60s compute loop, reads BarStore, pushes WS signal updates | Unchanged |
| /chart/bars endpoint | Return OHLCV + overlays; resample 1m→higher TF on demand | Modified (add ?tf param) |
| /watchlist endpoints | CRUD for watchlist symbols (GET/POST/DELETE) | Unchanged |
| ChartPage | Candlestick chart; add timeframe switcher UI | Modified |
| WatchlistSidebar | Add/remove symbols from dashboard UI | New |

---

## Recommended Project Structure

The new components slot into the existing module layout without restructuring.

```
backend/
├── data/
│   ├── bar_store.py        # unchanged
│   ├── binance_feed.py     # unchanged
│   ├── alpaca_feed.py      # NEW — replaces yfinance_feed.py
│   └── yfinance_feed.py    # REMOVED (or kept and disabled)
├── charts/
│   └── router.py           # MODIFIED — add ?tf query param + resample
├── signals/
│   └── broadcaster.py      # unchanged
├── watchlist/              # unchanged (CRUD already works)
├── main.py                 # MODIFIED — swap yfinance task for alpaca_feed task

frontend/src/
├── pages/
│   ├── DashboardPage.tsx   # MODIFIED — mount WatchlistSidebar
│   └── ChartPage.tsx       # MODIFIED — add timeframe switcher
├── components/
│   └── WatchlistSidebar.tsx  # NEW — add/remove watchlist symbols
```

### Structure Rationale

- **alpaca_feed.py next to binance_feed.py:** Both are async data feed tasks that write to BarStore. Grouping them makes the symmetry explicit and minimises main.py wiring changes.
- **yfinance_feed.py:** Either delete it or add a comment that it is replaced. Keeping it as dead code invites confusion.
- **WatchlistSidebar as a separate component:** DashboardPage already has clear sections (signal table, portfolio, trades). Sidebar is a separate concern and should not be inlined.

---

## Architectural Patterns

### Pattern 1: Feed → BarStore Write (existing — AlpacaFeed must follow it)

**What:** Any data feed (Binance, Alpaca) appends a closed `Bar` to `bar_store.update(symbol, (current + [bar])[-500:])`. The 500-bar cap is enforced at write time. The BarStore interface is a plain `update(symbol, bars)` / `get(symbol)` / `symbols()` API behind a `threading.Lock`.

**When to use:** All data ingestion. Feeds write raw OHLCV only — no indicator state.

**Trade-offs:** Simple and decoupled. All readers (broadcaster, chart endpoint) pull from one authoritative source. The 500-bar cap is intentional — sufficient for 20-bar EMA warmup + IFVG/CISD lookback, and prevents unbounded memory growth.

**AlpacaFeed must match this pattern exactly.** The `_on_closed_bar` method in `BinanceFeed` is the reference implementation.

### Pattern 2: Callable Watchlist Getter (existing — AlpacaFeed must use it)

**What:** Background tasks receive `watchlist_getter: Callable[[], list[str]]` rather than a snapshot list. The getter reads from SQLite on every invocation, so the running task always sees the current watchlist without requiring a restart.

**When to use:** Any long-running background task whose symbol set can change at runtime.

**Trade-offs:** Minor overhead of a SQLite read per call. Completely eliminates event/callback coupling between the watchlist layer and the data layer.

**Example (existing in main.py):**
```python
def get_watchlist_symbols() -> list[str]:
    with Session(get_engine()) as s:
        return [w.symbol for w in WatchlistRepository(s).get_all()]
```

### Pattern 3: On-Demand Resample for Multi-Timeframe Charts (new)

**What:** The chart endpoint resamples stored 1m bars to the requested timeframe using `df.resample(rule).agg(agg_dict).dropna()` on each HTTP GET request. No pre-computed higher-timeframe stores exist.

**When to use:** When compute cost is negligible relative to request latency (true here: ~2–5ms for 500 bars on pandas resample).

**Trade-offs:** Adds ~2–5ms per chart request — negligible for a personal dashboard. Pre-computing separate BarStore entries per timeframe would add 3× write complexity, require partial-bar management at period boundaries, and provide zero latency benefit (chart is HTTP, not streaming).

**Aggregation rules (OHLCV standard):**
```python
agg = {"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"}
tf_rules = {"1m": "1min", "5m": "5min", "15m": "15min", "1h": "1h"}
df_tf = df_1m.resample(tf_rules[tf]).agg(agg).dropna()
```

The existing `StrategyEngine.run()` lookahead guardrail (`df.iloc[:-1]`) already drops the last incomplete bar after resampling, so no additional guardrail is needed in the endpoint.

### Pattern 4: Periodic Diff-Check for Dynamic Feed Subscriptions (new)

**What:** `AlpacaFeed.run()` polls the watchlist getter every 30 seconds, computes the diff against the currently subscribed symbol set, and calls `stream.subscribe_bars(handler, *new_symbols)` / `stream.unsubscribe_bars(*removed_symbols)` for the diff.

**When to use:** When a streaming subscription must stay current with a mutable watchlist, without coupling the HTTP layer to the data feed layer.

**Trade-offs:** Up to 30 second delay before a newly added symbol starts receiving bars. Acceptable for a personal dashboard. No coupling between `watchlist/router.py` and `alpaca_feed.py`.

---

## Data Flow

### New Bar Arrival (v1.1 hot path)

```
Alpaca WS message (T="b", closed 1m bar)
    │
    ▼
AlpacaFeed._on_closed_bar()
    builds Bar dataclass from Alpaca message fields (S,o,h,l,c,v,t)
    │
    ▼
bar_store.update(symbol, (current + [bar])[-500:])
    │
    ├──→ SignalBroadcaster reads bar_store on next 60s tick
    │       StrategyEngine.run() on 1m bars (unchanged)
    │       push signal_update → WS clients (unchanged)
    │
    └──→ User requests chart: GET /chart/bars/SPY?tf=5m
            df_1m = bar_store.get("SPY") converted to DataFrame
            df_5m = df_1m.resample("5min").agg(ohlcv_agg).dropna()
            compute_ifvg/cisd/ema on df_5m
            return JSON → CandlestickChart renders
```

### Watchlist Mutation Flow (v1.1)

```
User adds "AAPL" in WatchlistSidebar
    │
    ▼
POST /watchlist {"symbol":"AAPL","asset_type":"stock"}
    │
    ▼
WatchlistRepository.add() → SQLite INSERT
    │  (HTTP 201 returned to frontend)
    │
    ▼ (up to 30s later)
AlpacaFeed 30s diff-check tick
    get_watchlist_symbols() reads SQLite → sees "AAPL"
    diff: {"AAPL"} not in current subscribed set
    │
    ▼
stream.subscribe_bars(handler, "AAPL")
    │
    ▼
Alpaca WS starts delivering AAPL bars on next minute close
    │
    ▼
bar_store.update("AAPL", ...) populates
    │
    ▼
SignalBroadcaster includes AAPL in next broadcast
    WatchlistSidebar shows AAPL in list immediately (from 201 response)
    SignalTable shows AAPL signal after first bar arrives
```

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Alpaca WebSocket (IEX) | `StockDataStream._run_forever()` as asyncio task | Free tier = IEX feed only (~2% market volume). Use `DataFeed.IEX`. One WS connection per account. |
| Binance WebSocket | `BinanceFeed.run()` as asyncio task | Unchanged. Keep `ENABLE_BINANCE_FEED` env var flag. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| AlpacaFeed → BarStore | Direct method call `bar_store.update()` | Same as BinanceFeed. Thread-safe via Lock. |
| SignalBroadcaster → BarStore | Direct method call `bar_store.get()` | Unchanged. |
| charts/router → BarStore | Direct method call `bar_store.get()` | Modified to resample before passing to strategy. |
| WatchlistSidebar → /watchlist API | REST (GET/POST/DELETE) | No new backend code needed. |
| AlpacaFeed → WatchlistRepository | Callable getter (closure over SQLite read) | Polling every 30s for diff-check. |

### New vs Existing — Explicit Summary

| Item | Status | Files Touched |
|------|--------|---------------|
| `backend/data/alpaca_feed.py` | New file | None |
| Remove yfinance task from lifespan | Modified | `backend/main.py` |
| Add AlpacaFeed task to lifespan | Modified | `backend/main.py` |
| Chart endpoint `?tf` param + resample | Modified | `backend/charts/router.py` |
| ChartPage timeframe switcher | Modified | `frontend/src/pages/ChartPage.tsx` |
| WatchlistSidebar component | New file | None |
| Mount WatchlistSidebar in DashboardPage | Modified | `frontend/src/pages/DashboardPage.tsx` |
| AlpacaFeed 30s diff-check subscription logic | New (internal to alpaca_feed.py) | None |

---

## Alpaca SDK Integration: Critical Details

**Use `alpaca-py` (not `alpaca-trade-api`).**
- Package: `alpaca-py` on PyPI
- Class: `alpaca.data.live.stock.StockDataStream`
- Bar message fields: `T="b"`, `S` (symbol), `o`, `h`, `l`, `c`, `v`, `vw`, `n`, `t` (RFC-3339 timestamp)
- Bar delivery timing: bars arrive immediately after the minute mark, containing trades from the prior minute
- Updated bars (`T="u"`): arrive at 30s marks for late trades. Ignore in `AlpacaFeed` — strategy only needs closed bars.

**Event loop conflict (HIGH confidence — verified in alpaca-py issue #193, #476):**
- `StockDataStream.run()` calls `asyncio.run()` internally. This crashes with `RuntimeError: This event loop is already running` when called inside FastAPI's lifespan.
- Workaround: use `stream._run_forever()` (internal coroutine) via `asyncio.create_task(stream._run_forever())`. This is a stable internal API in practice but is not publicly documented. Pin the `alpaca-py` version in requirements.txt.

**Free tier limitations (HIGH confidence — official Alpaca docs):**
- IEX feed only. IEX represents ~2% of total market volume. Price data is real-time but not consolidated tape.
- One concurrent WebSocket connection per account.
- Minute bars: unlimited symbol subscriptions.
- Trades/quotes: 30 channel limit (not relevant — this project only uses bars).

**Dynamic subscription (MEDIUM confidence — from SDK docs):**
- `stream.subscribe_bars(handler, *symbols)` and `stream.unsubscribe_bars(*symbols)` can be called on a connected stream without reconnecting.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Calling `StockDataStream.run()` directly in lifespan

**What people do:** `asyncio.create_task(stream.run())` inside FastAPI lifespan.

**Why it's wrong:** `stream.run()` calls `asyncio.run()` which raises `RuntimeError: This event loop is already running` because FastAPI's lifespan runs inside an existing event loop.

**Do this instead:** `asyncio.create_task(stream._run_forever())`. Mirror the pattern used for `BinanceFeed.run()`.

### Anti-Pattern 2: Pre-computing per-timeframe BarStore entries

**What people do:** On each new 1m bar, check if a 5m period just closed, build a 5m bar, write to `bar_store["SPY_5m"]`.

**Why it's wrong:** Adds 3× write complexity per bar. Requires tracking partial-bar state per timeframe. Introduces session-boundary bugs (incomplete bar at market close). Provides no latency benefit because the chart endpoint is HTTP GET, not streaming.

**Do this instead:** Store only 1m bars. Resample on demand in `charts/router.py` with `df.resample().agg()`.

### Anti-Pattern 3: Having watchlist router call into AlpacaFeed

**What people do:** `watchlist/router.py` imports `alpaca_feed` and calls `alpaca_feed.subscribe("AAPL")` on POST.

**Why it's wrong:** Creates import-level coupling between the HTTP layer and the streaming layer. Complicates testing (importing router pulls in feed, which needs env vars). Risks circular import chains.

**Do this instead:** `AlpacaFeed` polls the watchlist getter every 30s and manages its own subscriptions via diff-check. HTTP layer and data layer never reference each other directly.

### Anti-Pattern 4: Storing Alpaca updated bars (`T="u"`) in BarStore

**What people do:** Subscribe to `T="u"` updated bar messages and overwrite the prior bar in BarStore.

**Why it's wrong:** The strategy engine has already processed the closed bar. Retroactively changing a bar that the engine has already consumed creates inconsistency between BarStore state and the last-broadcast signal. The update is a minor volume/price correction for a late trade — irrelevant at the 1-minute bar strategy level.

**Do this instead:** Filter on `T="b"` only in `AlpacaFeed._on_closed_bar()`. Ignore `T="u"`.

### Anti-Pattern 5: Recalculating strategy overlays from scratch on every new bar (chart endpoint)

**What people do:** Poll the chart endpoint every 60s from the frontend to keep the chart live.

**Why it's wrong:** The chart endpoint recomputes `compute_ifvg`, `compute_cisd`, `compute_ema` on the full bar set on every call. This is fine for on-demand user interaction, but polling it every 60s creates unnecessary CPU work and makes no sense — the user must explicitly look at the chart.

**Do this instead:** The chart is a pull-on-demand view. Load it when the user navigates to the chart page, and reload when they change symbol or timeframe. Do not auto-poll.

---

## Build Order (dependency graph)

Phase ordering is dictated by what each task depends on at the time of integration.

```
Step 1 — AlpacaFeed backend (no other new component depends on this)
    Create backend/data/alpaca_feed.py
    Wire into main.py: remove yfinance task, add alpaca_feed task
    Verify: bar_store populated for stock symbols
    Dependency: bar_store.py (exists), alpaca-py SDK (install)

Step 2 — Multi-timeframe chart backend (reads from BarStore, which Step 1 populates)
    Modify backend/charts/router.py: add ?tf param, resample before overlay compute
    Dependency: Step 1 (bars must exist to test resampling)

Step 3 — Chart timeframe switcher frontend (calls the modified endpoint from Step 2)
    Modify frontend/src/pages/ChartPage.tsx: add TF switcher state + query param
    Dependency: Step 2 (backend must accept ?tf before frontend sends it)

Step 4 — Watchlist sidebar frontend (calls existing REST API — no new backend needed)
    Create frontend/src/components/WatchlistSidebar.tsx
    Modify DashboardPage.tsx to mount it
    Dependency: none (existing /watchlist REST API already works)

Step 5 — Dynamic AlpacaFeed subscription (completes the watchlist → feed propagation loop)
    Add 30s diff-check loop inside AlpacaFeed.run()
    Dependency: Step 1 (feed must be running), Step 4 (mutations must exist to test)
```

Rationale for this order:
- AlpacaFeed first because it unblocks all testing of downstream components.
- Multi-timeframe backend before frontend because the frontend change is trivial once the endpoint exists.
- Watchlist UI before dynamic subscription because you need a way to trigger mutations to test the subscription diff-check.

---

## Scaling Considerations

This is a personal, single-user dashboard. Scaling is out of scope. For reference:

| Concern | At 1 user (current) | If it ever mattered |
|---------|---------------------|---------------------|
| WS connections | In-memory list in SignalBroadcaster | Redis pub/sub for multi-process |
| BarStore | In-memory threading.Lock dict | Would need per-process sync |
| AlpacaFeed | One WS connection, unlimited bars | Already the Alpaca account limit |
| Chart resample | ~2ms for 500 bars | Negligible even at 10 concurrent users |

---

## Sources

- Alpaca WebSocket streaming docs: https://docs.alpaca.markets/docs/streaming-market-data
- Alpaca real-time stock data format: https://docs.alpaca.markets/docs/real-time-stock-pricing-data
- alpaca-py StockDataStream SDK reference: https://alpaca.markets/sdks/python/api_reference/data/stock/live.html
- alpaca-py GitHub issue #476 (multiple streams / _run_forever pattern): https://github.com/alpacahq/alpaca-py/issues/476
- alpaca-py GitHub issue #193 (asyncio.run conflict in running event loop): https://github.com/alpacahq/alpaca-py/issues/193
- Alpaca IEX vs SIP free tier limits: https://docs.alpaca.markets/docs/market-data-faq
- Pandas OHLCV resample reference: https://atekihcan.com/blog/codeortrading/changing-timeframe-of-ohlc-candlestick-data-in-pandas/
- Existing codebase (read directly): backend/data/bar_store.py, binance_feed.py, yfinance_feed.py, signals/broadcaster.py, strategy/engine.py, charts/router.py, main.py, watchlist/repository.py, watchlist/router.py, frontend/src/pages/ChartPage.tsx, frontend/src/pages/DashboardPage.tsx

---
*Architecture research for: trading-dashboard v1.1 (Alpaca feed + multi-timeframe charts + watchlist UI)*
*Researched: 2026-03-21*
