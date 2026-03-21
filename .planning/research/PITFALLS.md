# Domain Pitfalls

**Domain:** Real-time trading signal dashboard (FastAPI + React + WebSockets + market data APIs)
**Project:** Trading Dashboard — IFVG + CISD + 20-EMA strategy
**Researched:** 2026-03-21 (v1.1 update — Alpaca WebSocket integration)
**Confidence:** HIGH (Alpaca pitfalls verified against official docs and confirmed GitHub issues)

---

## v1.1 Critical Pitfalls

Pitfalls specific to replacing yfinance polling with Alpaca WebSocket, adding multi-timeframe aggregation, and adding runtime watchlist management.

---

### Pitfall A1: StockDataStream.run() Blocks the FastAPI Event Loop

**What goes wrong:**
`alpaca-py`'s `StockDataStream.run()` calls `asyncio.run()` internally. In a FastAPI application, an event loop is already running. Calling `asyncio.run()` from inside a running loop raises `RuntimeError: asyncio.run() cannot be called from a running event loop`. The result is the feed never starts, and the error may be swallowed silently if wrapped in a broad `except Exception`.

**Why it happens:**
The Binance feed in the existing codebase uses `python-binance`'s `AsyncClient` and is driven as a raw `asyncio.Task` — you write the loop yourself. `alpaca-py`'s `StockDataStream` hides the event loop management inside `run()`, which is designed for scripts, not for embedding in an already-running async application.

**How to avoid:**
Do not call `stream.run()`. Instead, use `stream._run_forever()` directly as a coroutine wrapped in `asyncio.create_task()` in the FastAPI lifespan — the same pattern used for `BinanceFeed.run()`:

```python
# In lifespan, alongside the Binance task:
tasks.append(asyncio.create_task(alpaca_feed.run()))  # where run() is an async wrapper

# Inside AlpacaFeed.run():
async def run(self) -> None:
    await self._stream._run_forever()  # not stream.run()
```

Alternatively, wrap `stream.run()` in `asyncio.to_thread()` so it runs in a thread pool with its own event loop, but this complicates shutdown.

**Warning signs:**
- `RuntimeError: asyncio.run() cannot be called from a running event loop` in startup logs
- Feed task appears created but no Alpaca bars ever arrive in `bar_store`
- Binance feed works fine, Alpaca feed produces no data

**Phase to address:** Phase 1 of v1.1 (Alpaca feed wiring). Must be resolved before any other Alpaca work.

---

### Pitfall A2: IEX Feed Produces No Bars for Low-Volume or Inactive Symbols

**What goes wrong:**
The IEX exchange accounts for roughly 2% of total US equities volume. Alpaca's free-tier WebSocket (IEX feed) only streams bars when trades actually occurred on IEX during that minute. Symbols with low IEX participation — including many mid/small-cap stocks and index ETFs during quiet periods — will produce zero bars for minutes or longer, even though trading is happening on other exchanges. The BarStore for that symbol silently receives no updates, and the strategy engine sees stale data without any error.

**Why it happens:**
The free tier `StockDataStream` defaults to `feed=DataFeed.IEX`. Developers assume "subscribed = receiving data" but IEX bars only exist when IEX-executed trades occur. This is documented in Alpaca's FAQ but easy to miss.

**How to avoid:**
- Accept that IEX gaps are normal and not an error condition. Do not trigger reconnects or alerts on missing bars alone.
- Implement a staleness check: if no bar has been received for a symbol in more than N minutes during market hours, display a staleness indicator in the UI rather than showing the last known signal as live.
- For symbols where IEX provides almost no data, fall back to yfinance polling as a supplement (the existing `poll_yfinance_loop` can coexist with the Alpaca feed — yfinance provides the "fill" when IEX has gaps).
- The existing `yfinance_feed.py` recency check (90-second threshold) is the right model — apply the same logic to Alpaca bars.

**Warning signs:**
- SPY and AAPL receive regular bars but a small-cap symbol produces zero bars for an entire session
- Strategy shows "no signal" for a symbol even during peak market hours
- `bar_store.get("SYMBOL")` returns data from 30+ minutes ago during a live session

**Phase to address:** Phase 1 of v1.1 (Alpaca feed). Build staleness detection into `AlpacaFeed._on_bar()` from the start.

---

### Pitfall A3: Runtime Symbol Subscribe/Unsubscribe Causes Stream to Hang (alpaca-py Bug)

**What goes wrong:**
Adding or removing symbols while the `StockDataStream` is running via `stream.subscribe_bars(handler, "NVDA")` after `run()` has started is documented as supported, but there is a confirmed bug in alpaca-py (GitHub issue #491): after the first dynamic subscribe/unsubscribe call, the stream client can freeze. The WebSocket connection stays open (no error raised) but stops delivering messages. All subsequent bars are silently dropped.

**Why it happens:**
`alpaca-py`'s subscription methods use `asyncio.run_coroutine_threadsafe()` to schedule the subscription message on the running event loop. The interaction between this and the internal stream reader coroutine has a race condition that causes the reader to stop processing. The library was designed for static symbol lists set at startup, not dynamic runtime management.

**How to avoid:**
Do not call subscription methods on a live stream. Instead, implement a restart-on-change pattern:
1. When the watchlist changes (symbol added or removed), cancel the existing Alpaca stream task.
2. Build a new `StockDataStream` instance with the updated symbol list.
3. Re-subscribe all symbols on the new instance and start it.

This is the same pattern the existing `BinanceFeed` uses — it reconnects from scratch rather than patching a live connection. The restart takes under 1 second and happens outside market hours most of the time.

```python
# WatchlistManager signals a change via asyncio.Event
# AlpacaFeed detects it and restarts the stream task
async def run(self) -> None:
    while True:
        symbols = self._get_symbols()
        stream = self._build_stream(symbols)
        task = asyncio.create_task(stream._run_forever())
        await self._change_event.wait()   # set when watchlist mutates
        task.cancel()
        self._change_event.clear()
```

**Warning signs:**
- Bars arrive normally for 10 minutes, then stop after a watchlist change
- No errors or disconnection log messages after the subscribe call
- Restarting the server restores data flow (confirming the stream hung, not the server)

**Phase to address:** Phase 2 of v1.1 (watchlist management UI + live subscription). This is the highest-risk integration point.

---

### Pitfall A4: One WebSocket Connection Per Alpaca Account — Concurrent Connections Cause 406 Error

**What goes wrong:**
Alpaca enforces one concurrent WebSocket connection per account for the free tier. If the development environment has the feed running locally while Render also has it running (e.g., after a deployment that did not stop gracefully), the second connection is rejected with error code 406 "connection limit exceeded." The first connection also gets dropped in some configurations. Both instances then retry indefinitely, resulting in neither receiving any data.

**Why it happens:**
The existing code starts the Alpaca feed as a `asyncio.Task` in the FastAPI lifespan. On Render, deployment does a rolling restart: the new instance starts before the old one is terminated. During this overlap window, both instances try to hold the Alpaca WebSocket connection.

**How to avoid:**
- Add exponential backoff on 406 errors specifically (do not retry immediately — wait 30s, 60s, 120s).
- On Render, configure the health-check delay to ensure the old instance is terminated before the new one starts accepting traffic.
- Use a connection identifier in logs: log the Alpaca API key prefix used so you can distinguish which instance holds the connection.
- During local development, never run the Alpaca feed if the Render deployment is active — use `ENABLE_ALPACA_FEED=false` env var locally (mirroring the existing `ENABLE_BINANCE_FEED` pattern).

**Warning signs:**
- Alpaca feed logs show "connection limit exceeded" repeatedly
- Bars were flowing, then stopped after a deployment
- Error 406 in Alpaca connection logs

**Phase to address:** Phase 1 of v1.1 (Alpaca feed wiring) and Phase 3 (deployment configuration).

---

### Pitfall A5: Alpaca Bar Timestamp Is the Bar Open Time, Not Bar Close Time

**What goes wrong:**
Alpaca WebSocket bar events use the bar's open timestamp (e.g., 09:31:00 ET for the 9:31 bar). The existing Binance feed receives klines where `kline["t"]` is also the open timestamp. However, the yfinance feed returns dataframes indexed by bar open time and the existing code uses `df.iloc[-1]` (last closed bar) with the open timestamp as the key. The Alpaca bar event fires approximately at the close of that minute (after 09:32:00 ET for the 09:31 bar), but the timestamp on the bar is 09:31:00 — not 09:32:00.

Strategy code that computes session window checks against bar timestamps must account for this: a bar timestamped 09:30:00 ET is valid within the 09:30–10:30 session window even though it arrives at 09:31. If session filtering uses the arrival time rather than the bar timestamp, bars at the session edge may be incorrectly excluded.

**Why it happens:**
Alpaca streams the bar after it closes (at 09:32) with the open timestamp (09:31). Some developers use `datetime.now()` as the bar time instead of the event timestamp, which is always wrong.

**How to avoid:**
- Always use the bar's `timestamp` field from the Alpaca event, not `datetime.now()`.
- The session filter in `signals/session.py` already uses bar timestamps — verify it handles the open-time convention correctly against the 09:30–10:30 boundary.
- Write a test: an Alpaca bar with `timestamp=09:30:00 ET` that arrives at `09:31:05 ET` should be treated as inside the session.

**Warning signs:**
- The first bar of each session (09:30 bar) is silently dropped by the session filter
- Strategy shows "no signal" for the first minute of each session despite data arriving
- Bar timestamps in logs show values one minute behind expected

**Phase to address:** Phase 1 of v1.1 (Alpaca feed + session filter validation).

---

### Pitfall A6: BarStore Has No Eviction for Removed Symbols — Stale Data Persists

**What goes wrong:**
The current `BarStore.update()` replaces data for a symbol; `BarStore.get()` reads it. There is no `BarStore.remove()` method. When a symbol is removed from the watchlist, its bar data stays in `bar_store._data` indefinitely. The Alpaca stream is restarted without that symbol, but the old data remains. If the symbol is later re-added, the strategy engine will resume from the stale historical bars rather than starting fresh, potentially including bars from a different session.

**Why it happens:**
The current design — where yfinance polling fetches a full day's bars on every poll — overwrites the entire symbol entry. The Alpaca feed appends individual bars (as the Binance feed does). Without explicit removal, the in-memory dict grows without bound and returns stale data.

**How to avoid:**
- Add a `BarStore.remove(symbol: str) -> None` method that deletes the entry under the lock.
- Call `bar_store.remove(symbol)` in the watchlist removal path, after cancelling the stream task and before restarting it.
- For Render's limited memory (512 MB free tier), also enforce the 500-bar cap on append (already done in `BinanceFeed._on_closed_bar` — replicate in `AlpacaFeed`).

**Warning signs:**
- Removed symbol still appears in `bar_store.symbols()` after watchlist removal
- Re-added symbol shows signal state from a previous session immediately on add
- Memory usage on Render grows steadily over days without restart

**Phase to address:** Phase 2 of v1.1 (watchlist management). Add `remove()` before wiring the watchlist UI.

---

### Pitfall A7: Multi-Timeframe Aggregation Serves the Current Incomplete Higher-TF Bar

**What goes wrong:**
When aggregating 1-minute bars into 5-minute or 15-minute bars, the aggregation window at the current time is always incomplete. A 5-minute bar starting at 09:35 is not closed until 09:40. If the frontend requests the chart at 09:37, the in-progress bar has only 2 minutes of data. Serving this incomplete bar to the strategy engine causes the same lookahead bias documented in Pitfall 1 — the IFVG or CISD calculation runs on a bar whose high/low/close will change.

**Why it happens:**
Bar aggregation functions (e.g., `resample('5T')` in pandas) include the current open window by default. Developers inspect the last bar of the resampled series assuming it is closed.

**How to avoid:**
- When serving aggregated bars for signal computation, always drop the last (incomplete) bar from the resampled output: `resampled.iloc[:-1]`.
- Maintain a separate "forming bar" state for the current incomplete HTF bar — display it on the chart (so the user sees it forming) but never feed it to `strategy/engine.py`.
- The existing pattern in `yfinance_feed.py` (`df = df.iloc[:-1]` before strategy logic) is the model to follow — replicate it at the aggregation layer.

**Warning signs:**
- A 15m chart shows a signal that disappears when the 15m bar closes (repainting)
- Signal fires at 09:37 on the 15m timeframe but is absent on a 09:40 refresh
- Higher timeframe signals are more frequent than expected compared to TradingView

**Phase to address:** Phase 2 of v1.1 (multi-timeframe chart switcher). The aggregation boundary must be enforced at the same layer that feeds signals, not just the display layer.

---

### Pitfall A8: 1-Minute Bars From Alpaca WebSocket Do Not Backfill on Connect

**What goes wrong:**
When the `StockDataStream` connects and subscribes to bars for a symbol, Alpaca starts streaming bars from that point forward. It does not replay any missed bars. If the application restarts at 09:45 AM during a session, the `BarStore` for Alpaca symbols starts with zero bars. The strategy engine has insufficient history (it needs ~50 bars for EMA warm-up and IFVG lookback). Signals will be wrong or absent until enough bars accumulate — which could take 50 minutes of live trading.

**Why it happens:**
WebSocket streams are push-only and stateless. This is well-known but developers connecting mid-session expect some kind of catch-up.

**How to avoid:**
- On `AlpacaFeed` startup (or after a restart), fetch historical bars via the Alpaca REST API (`StockHistoricalDataClient.get_stock_bars()`) to seed the BarStore before starting the WebSocket stream.
- Fetch at minimum 100 bars of history per symbol on startup.
- This is the equivalent of what yfinance polling does on every call (`period="1d"`, `interval="1m"` returns the full day's bars).
- The REST seed fetch and the WebSocket stream must use the same timestamp convention so bars are not duplicated or gapped at the join point. Deduplicate by timestamp after merging.

**Warning signs:**
- After a restart, signals show "None" for all symbols for the first 30–50 minutes
- EMA values in logs are far from expected values immediately after startup
- BarStore length for Alpaca symbols is <20 bars during market hours

**Phase to address:** Phase 1 of v1.1 (Alpaca feed). Backfill must be part of the initial feed implementation, not a later enhancement.

---

## v1.0 Critical Pitfalls (Still Relevant)

These pitfalls from v1.0 research remain active risks and are not resolved by the v1.1 changes.

---

### Pitfall 1: Lookahead Bias — Computing Signals on the Live (Unclosed) Bar

**What goes wrong:**
Strategy computes IFVG zones and CISD levels on the current forming candle. The last bar from any live feed is incomplete until the minute closes. Signals fire on partial data, then shift or vanish when the bar closes, creating phantom signals.

**How to avoid:**
Always slice off the last bar before strategy computation: `bars = bars[:-1]`. Maintain separate `confirmed` (closed bar) and `live` (forming bar) states.

**Warning signs:**
- Signal shows "Long" then disappears without a new candle arriving
- More signals in live mode than on replay

**Phase to address:** Existing — validated in Phase 1. Re-verify with Alpaca feed since the bar delivery pattern differs from yfinance.

---

### Pitfall 2: PineScript-to-Python Logic Translation Bugs (IFVG / CISD)

**What goes wrong:**
PineScript implicit time-series semantics do not map directly to pandas. EMA initialization, `nz()` equivalents, and bar-indexing off-by-ones produce subtly wrong signal calculations.

**How to avoid:**
Use `ewm(span=20, adjust=False, min_periods=20)` for EMA. Validate row-by-row against TradingView export for a known date range.

**Phase to address:** Existing — validated in Phase 1.

---

### Pitfall 3: Render Free Tier Sleep Kills Connections

**What goes wrong:**
Render's free tier sleeps after 15 minutes of inactivity. Cold start takes 2–3 minutes. The Alpaca WebSocket feed will also drop on sleep and need to reconnect and re-seed history (see Pitfall A8).

**How to avoid:**
Keep-alive cron at 9:20 AM ET. Frontend exponential backoff reconnect. Alpaca feed startup backfill makes restarts less damaging.

**Phase to address:** Deployment (Phase 3 of v1.1).

---

### Pitfall 5: Binance WebSocket Silently Drops and Has a Hard 24-Hour Limit

**What goes wrong:**
Binance forcibly closes WebSocket connections at the 24-hour mark. Must proactively reconnect at 23 hours. This feed is unchanged in v1.1 — the existing `BinanceFeed` handles this correctly with the 23h reconnect timer.

**Phase to address:** Existing — implemented in Phase 2 of v1.0.

---

### Pitfall 6: React WebSocket Creates Multiple Connections on Re-Render

**What goes wrong:**
WebSocket instantiated in `useEffect` without proper cleanup creates one connection per render cycle. Use `useRef` for WS instance; cleanup must call `ws.close()`.

**Phase to address:** Frontend work in v1.1 (watchlist UI may trigger re-renders).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Subscribe all symbols at startup, restart stream on change | Avoids alpaca-py runtime subscribe bug | ~1s stream gap per watchlist change | Acceptable — changes are rare; stream restarts in <1s |
| yfinance polling as IEX gap filler | Maintains signal continuity for low-volume symbols | Two data sources for the same asset type; complexity | Acceptable in v1.1; revisit if Alpaca gaps become rare |
| Seed BarStore from REST API on every restart | Ensures strategy has enough history | Extra REST API call on startup (~200ms per symbol) | Always acceptable; not a bottleneck |
| In-memory BarStore with no persistence | Simple; no DB writes per tick | History lost on restart (mitigated by REST seed) | Acceptable — REST seed makes restarts recoverable |
| Single `StockDataStream` for all stock symbols | Simple; avoids connection limit | All symbols share one connection; a stream hang affects all | Acceptable — matches Alpaca's 1-connection-per-account limit |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Alpaca StockDataStream | Call `stream.run()` inside FastAPI lifespan | Use `asyncio.create_task(stream._run_forever())` |
| Alpaca free tier | Connect without specifying `feed=DataFeed.IEX` | Always pass `feed=DataFeed.IEX` explicitly; SIP requires paid plan and raises 409 |
| Alpaca runtime subscribe | Call `stream.subscribe_bars()` while stream is running | Restart the stream task entirely with the new symbol list |
| Alpaca bar timestamps | Use `datetime.now()` as bar timestamp | Use event's `.timestamp` field; bars arrive after close but carry open time |
| Alpaca connection limit | Run feed locally while Render is also running it | Use `ENABLE_ALPACA_FEED` env var (like `ENABLE_BINANCE_FEED`) to disable locally |
| Multi-TF aggregation | Pass `resampled_bars` including current open bar to strategy | Always `resampled.iloc[:-1]` before any signal computation |
| BarStore on symbol removal | Leave stale bars for removed symbol | Call `bar_store.remove(symbol)` explicitly in watchlist removal path |
| Alpaca WebSocket on restart | Assume stream delivers historical bars | Fetch REST backfill before starting WebSocket stream |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Aggregating bars on every frontend request | Chart requests cause 50ms+ CPU spike per symbol per timeframe | Pre-aggregate to 5m/15m/1h in-memory when new 1m bar arrives; cache the result | >5 symbols + high-frequency chart refreshes |
| Re-fetching REST backfill on every stream restart | Alpaca REST rate limit hit; slow restarts | Cache backfill; only re-fetch bars newer than last known timestamp | Watchlist changes more than once per minute |
| Strategy engine recomputing full history on every bar | CPU spike per bar per symbol | Compute incrementally: only recompute the last N bars where signals can change | >10 symbols or low-power Render instance |
| Pandas resample on raw 1m bar list (not DataFrame) | TypeError or silent wrong aggregation | Convert `list[Bar]` to DataFrame once, cache the DataFrame | Every bar if done naively per request |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Alpaca API key in frontend or committed to git | Attacker can stream market data on your account (hits connection limit; exposes account details) | Store in Render environment variables only; never in source code or `.env` committed to git |
| Alpaca API key in frontend `.env` file committed | Same risk, public repo exposure | `.env` is in `.gitignore`; verify before pushing |
| Watchlist add/remove endpoints unprotected | Attacker can add arbitrary symbols, causing stream restart and data gaps | Watchlist routes already require JWT (`get_current_user` dependency) — keep this in place |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No data-source indicator on chart | User cannot tell if they are seeing Alpaca IEX data (possibly gappy) vs yfinance data | Show data source badge per symbol: "IEX" or "Yahoo" |
| No staleness indicator when IEX has a gap | User sees last-known signal state assuming it is current | Show timestamp of last received bar; highlight if >2 minutes old during market hours |
| Chart timeframe switch re-fetches and re-aggregates from scratch | Visible loading flash on every timeframe change | Pre-aggregate all timeframes when a new 1m bar arrives; timeframe switch is instant |
| Watchlist add succeeds but no data appears for several minutes | User thinks the add failed | Show "Fetching historical data..." state on new symbol; transition to live when first bar arrives |
| No feedback during stream restart (watchlist change) | User sees frozen data for ~1s after adding/removing symbol | Show "Refreshing feed..." briefly; restore to live state when reconnected |

---

## "Looks Done But Isn't" Checklist

- [ ] **Alpaca feed integration:** Verify bars are actually arriving in BarStore by logging `bar_store.symbols()` and bar count at a 30s interval — a connected stream with no bars means IEX has no data for those symbols, not that the feed is working.
- [ ] **Stream restart on watchlist change:** Verify the stream task is fully cancelled (not just the asyncio task — the underlying WebSocket must be closed) before creating a new one, or the old connection holds the Alpaca connection limit.
- [ ] **Backfill on startup:** Verify strategy produces valid signals within the first 5 minutes of a restart by checking EMA values against expected range, not just checking that bars are present.
- [ ] **Multi-TF aggregation:** Verify the 5m, 15m, and 1h bars never include the current open (incomplete) bar by asserting `last_bar.timestamp < floor(now, timeframe)` in a unit test.
- [ ] **IEX staleness handling:** Open the dashboard during market hours for SPY and a low-volume symbol — confirm the low-volume symbol shows a staleness warning when it receives no IEX bars.
- [ ] **Removed symbol cleanup:** Remove a symbol from the watchlist, then call `bar_store.symbols()` directly — confirm the symbol is absent.
- [ ] **Connection limit protection:** Stop the server, wait 5 seconds, restart — confirm the Alpaca feed reconnects successfully without 406 errors (old connection fully closed).

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Stream hung after subscribe call (A3) | LOW | Restart the FastAPI server; implement restart-on-change pattern to prevent recurrence |
| 406 connection limit error (A4) | LOW | Wait 60s for Alpaca to time out old connection; add exponential backoff in reconnect logic |
| Missing bars on IEX gap (A2) | LOW | No recovery needed — this is normal IEX behavior; surface staleness indicator to user |
| BarStore stale after symbol removal (A6) | LOW | Add `bar_store.remove()` call; for immediate fix, restart server to clear all state |
| Strategy has no history after restart (A8) | MEDIUM | Add REST backfill to startup; for immediate fix, wait 50 minutes for live bars to accumulate |
| Stream block on asyncio.run() (A1) | LOW | Change `stream.run()` to `stream._run_forever()` in task wrapper |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| A1: StockDataStream blocks event loop | Phase 1 of v1.1 (Alpaca feed wiring) | Alpaca task starts without RuntimeError; bars appear in BarStore within 2 minutes |
| A2: IEX gaps for low-volume symbols | Phase 1 of v1.1 (Alpaca feed) | Staleness indicator appears correctly; feed does not false-trigger reconnects |
| A3: Runtime subscribe/unsubscribe hang | Phase 2 of v1.1 (watchlist management) | Add/remove symbol 3 times; bars continue arriving for retained symbols |
| A4: One-connection-per-account 406 | Phase 1 + deployment (Phase 3 of v1.1) | Deploy to Render; verify no 406 errors; test rolling restart |
| A5: Bar timestamp is open-time not close-time | Phase 1 of v1.1 (Alpaca feed + session filter) | Unit test: 09:30:00 bar passes session filter; 16:01:00 bar is rejected |
| A6: BarStore stale data for removed symbols | Phase 2 of v1.1 (watchlist management) | Remove symbol; assert absent from `bar_store.symbols()` |
| A7: Incomplete higher-TF bar fed to strategy | Phase 2 of v1.1 (multi-TF aggregation) | Unit test: aggregation output last bar timestamp always < floor(now, TF) |
| A8: No bar history on stream connect | Phase 1 of v1.1 (Alpaca feed) | Restart server at 10:00 AM; verify signals appear within 5 minutes |

---

## Sources

**Alpaca-specific (verified):**
- [Alpaca WebSocket Stream docs — subscription limits, 1-connection limit, error codes 406/407/409](https://docs.alpaca.markets/docs/streaming-market-data)
- [Alpaca Market Data API — IEX vs SIP, free tier limitations, 30-symbol cap](https://docs.alpaca.markets/docs/about-market-data-api)
- [Alpaca Market Data FAQ — why bars are missing (IEX volume)](https://docs.alpaca.markets/docs/market-data-faq)
- [alpaca-py StockDataStream API reference — feed parameter, subscribe/unsubscribe methods](https://alpaca.markets/sdks/python/api_reference/data/stock/live.html)
- [alpaca-py GitHub issue #491 — stream client hangs on runtime subscribe/unsubscribe](https://github.com/alpacahq/alpaca-py/issues/491)
- [alpaca-py GitHub issue #193 — StockDataStream RuntimeError in running event loop](https://github.com/alpacahq/alpaca-py/issues/193)
- [Alpaca Community Forum — IEX or SIP with free account](https://forum.alpaca.markets/t/iex-or-sip-with-a-free-account/17141)
- [Alpaca Community Forum — missing/inconsistent bars from WebSocket](https://forum.alpaca.markets/t/websocket-bars-missing-inconsistent-data-stream/13747)
- [Alpaca Community Forum — paper trading with IEX streamed data](https://forum.alpaca.markets/t/paper-trading-with-iex-streamed-data/16408)
- [Alpaca Community Forum — bar timestamp beginning or end of minute](https://forum.alpaca.markets/t/timestamp-on-sip-websocket-minute-bars-beginning-or-end-of-minute/5917)
- [Alpaca Community Forum — connection limit exceeded (multiple instances)](https://forum.alpaca.markets/t/alpaca-data-streaming-client-is-unauthorized-connection-limit-exceeded/5098)

**Multi-timeframe aggregation:**
- [MTF repainting pitfalls — useThinkScript Community](https://usethinkscript.com/threads/mtf-multi-timeframe-repainting-pitfalls.16359/)

**Existing v1.0 sources (still relevant):**
- [Binance WebSocket Streams — official docs (24h limit)](https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams)
- [How to keep FastAPI active on Render free tier](https://medium.com/@saveriomazza/how-to-keep-your-fastapi-server-active-on-renders-free-tier-93767b70365c)
- [FastAPI WebSocket disconnection handling](https://hexshift.medium.com/handling-websocket-disconnections-gracefully-in-fastapi-9f0a1de365da)

---
*Pitfalls research for: Trading Dashboard v1.1 — Alpaca WebSocket integration, multi-timeframe aggregation, runtime watchlist management*
*Updated: 2026-03-21 (supersedes 2026-03-16 v1.0 pitfalls)*
