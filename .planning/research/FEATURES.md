# Feature Landscape

**Domain:** Real-time algorithmic trading signal dashboard with paper trading engine
**Strategy:** ICT/SMC — IFVG + CISD + 20-EMA
**Researched:** 2026-03-21 (v1.1 update; original v1.0 research: 2026-03-16)
**Confidence:** HIGH for table stakes (well-established patterns); MEDIUM for differentiators

---

## v1.1 Milestone Scope

This file is updated for the v1.1 milestone. The three new features being added are:

1. **Alpaca WebSocket real-time stock feed** — replaces yfinance 60s polling
2. **Multi-timeframe bar aggregation** — 1m/5m/15m/1h chart switcher with overlays
3. **Watchlist management UI** — add/remove symbols from the sidebar without API calls

Everything from the v1.0 feature landscape still applies. The sections below describe
the new features in full detail including table stakes, differentiators, anti-features,
edge cases, and dependencies on the existing system.

---

## Table Stakes (v1.1 additions)

Features users expect from the new milestone. Missing any of these makes the v1.1
increment feel incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Alpaca WebSocket bar events (1m, closed bars only)** | Polling with 60s delay means signals fire a full minute late. A strategy with a 1-hour window (9:30–10:30 AM ET) needs sub-5s bar delivery to be actionable. | Medium | Subscribe to `bars` channel on `wss://stream.data.alpaca.markets/v2/iex`. Only append closed bars to BarStore (never the in-progress bar). Mirrors the existing `binance_feed.py` closed-bar pattern (`kline["x"] == True`). |
| **Graceful reconnect on WebSocket disconnect** | Alpaca's stream drops connections. An unhandled disconnect silently kills the feed with no indication on the UI. | Medium | Exponential backoff retry loop. Watchdog timer (3-minute silence = reconnect). Mirrors the Binance 23-hour proactive reconnect pattern already in the codebase. |
| **Alpaca feed replaces yfinance for stock symbols only** | yfinance polling is 60s latency minimum, rate-limited, and uses HTTP not WebSocket. It blocks the async event loop via `to_thread`. | Low | `poll_yfinance_loop` task removed from `main.py` lifespan. `alpaca_feed` task added. Crypto symbols (BTC-USD etc.) keep using the Binance WebSocket feed unchanged. |
| **Timeframe switcher UI (1m / 5m / 15m / 1h)** | Any chart product with a configurable timeframe shows a timeframe selector. Without it, users cannot see higher-timeframe context for their signals. | Medium | Pill/tab group above the CandlestickChart on ChartPage. Buttons for 1m, 5m, 15m, 1h. Active state highlighted. Default: 1m. |
| **IFVG and CISD overlays recomputed per timeframe** | Showing 1m IFVG zones on a 15m chart would be misleading — zones must match the timeframe being displayed. | High | Backend aggregates 1m bars to the requested TF, runs `compute_ifvg` and `compute_cisd` on the aggregated DataFrame, returns overlays scoped to that TF. |
| **Watchlist add symbol (UI)** | Users expect to be able to add instruments directly from the dashboard without using an API client or editing config. | Low | Text input + "Add" button in the sidebar. Sends `POST /watchlist`. Validates symbol format client-side before sending. |
| **Watchlist remove symbol (UI)** | Same reasoning — remove without leaving the dashboard. | Low | "×" or trash icon on each watchlist row. Sends `DELETE /watchlist/{symbol}`. Optimistic UI update (remove immediately, revert on 404/500). |
| **Watchlist symbol validation feedback** | Entering "AAPL!" or "btc usd" and getting a silent failure is bad UX. | Low | Frontend validates: uppercase, alphanumeric + hyphen only, 1–10 chars. Backend 409 ("already in watchlist") and 404 ("not found on remove") surfaced as inline error text, not just console errors. |

---

## Differentiators (v1.1 additions)

Features that go beyond the minimum but are genuinely valuable for this use case.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **EMA period scales with timeframe** | 20-EMA on 1m is a tight 20-minute average. On 1h it is 20 hours. Using a fixed period regardless of TF would produce meaningless overlays. | Low | Pass `timeframe` parameter to the chart endpoint; keep period=20 but the backend aggregates first so the EMA is always computed on the correct OHLCV resolution. |
| **Alpaca test stream for development** | Alpaca provides `wss://stream.data.alpaca.markets/v2/test` with symbol "FAKEPACA" — always on, no market hours dependency. This enables local development without needing real market hours. | Low | Add `ALPACA_USE_TEST_FEED=true` env var that swaps the stream URL. High value for developers; zero added complexity. |
| **Feed source indicator on dashboard** | When Alpaca is disconnected and falling back to stale data, the trader needs to know. An indicator prevents acting on bad data. | Low | Extend the existing `WSStatusDot` component to show feed source ("Alpaca" / "Binance" / "Stale") with color coding. |
| **Timeframe persistence across symbol switches** | If the user is looking at SPY on 15m and switches to AAPL, they expect the chart to stay on 15m rather than reset to 1m. | Low | Store selected timeframe in React state at the page level (not inside CandlestickChart), passed down as a prop. Survives symbol changes. |
| **Watchlist symbol count badge** | Shows how many symbols are being tracked. With free IEX tier, the practical limit before signal noise becomes unmanageable is ~10 symbols. A badge sets implicit expectations. | Low | Text counter "N symbols" below the watchlist header. Changes color if approaching a self-imposed limit. |

---

## Anti-Features (v1.1)

Features to explicitly NOT build in this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **SIP data upgrade (paid Alpaca tier)** | Costs money. The project constraint is free-tier only. IEX covers ~2% of total market volume but delivers clean real-time bars for the signals that matter (SPY, QQQ, major single stocks). | Use IEX. Document the coverage limitation in UI tooltip or README. |
| **Client-side bar aggregation (1m→5m in React)** | Doing OHLCV rollups in JavaScript means the frontend holds 500 bars × 4 timeframes in memory, re-aggregates on every tick, and recomputes IFVG/CISD in JS — none of which exists client-side. | Server-side aggregation on the `/chart/bars/{symbol}` endpoint. React just renders what it receives. |
| **Tick-level or trade-level subscriptions** | Alpaca also streams individual trades and quotes. Processing tick data requires a separate aggregation pipeline and produces no benefit over closed 1m bars for this strategy. | Subscribe to `bars` channel only. |
| **Watchlist symbol search/autocomplete** | Autocomplete against all US equities requires a symbol master database or a third-party search API. Neither is available free-tier. | Plain text input. The user knows their own tickers. Show error if backend rejects the symbol. |
| **Per-symbol chart pinning (multi-chart layout)** | Multi-panel layouts (4-chart grid etc.) are complex to build, hurt mobile UX, and are not needed for a single-strategy dashboard. | Single chart, symbol switched via the existing selector. |
| **Intraday bar history from Alpaca REST** | Alpaca's REST historical bars API can backfill missing bars after reconnect. This is useful but adds API calls, rate-limit handling, and gap-detection logic. Scope it out for v1.1. | On reconnect, BarStore simply starts accumulating fresh bars. If the store is empty at chart load, show "Waiting for first bar" message (already implemented). |
| **Persistent timeframe preference (localStorage)** | Overkill for a personal dashboard opened once per session. Adds storage key management for marginal UX gain. | In-memory React state. Resets to 1m on page reload. |

---

## Edge Cases to Handle

These are not separate features, but behaviors that must be correct for each new feature to work reliably.

### Alpaca WebSocket Feed

| Edge Case | What Happens | Required Behavior |
|-----------|-------------|-------------------|
| **Incomplete / in-progress bar** | Alpaca emits bar events only when the minute closes. However, on reconnect, a partial bar event may appear. | Follow the Binance pattern: only append a bar when it is confirmed closed. Do not emit partial bars into BarStore. |
| **Pre-market and after-hours bars** | Alpaca IEX emits pre/post-market bars when there is IEX volume. These are outside the 9:30–16:00 ET window. | Apply the existing `_apply_market_hours_filter` logic from `yfinance_feed.py` to the Alpaca handler. |
| **Single concurrent connection limit** | Alpaca allows only 1 active WebSocket connection per API key. A server restart that doesn't cleanly close the connection can trigger error 406 ("connection limit exceeded") for ~30 seconds. | Log error 406 specifically; back off 60 seconds before retrying. Do not retry immediately in a tight loop. |
| **Symbol limit (free IEX tier)** | Free tier: 30 symbols for trades/quotes; no documented limit for bars. Practically, keep watchlist under 30 to stay safe. | No active enforcement needed in v1.1 (watchlist rarely exceeds 10 symbols for a single-strategy dashboard), but log a warning if >20 symbols are subscribed. |
| **Market closed (nights, weekends)** | No bars are emitted outside market hours. The feed stays connected but silent. | Do not treat silence as a disconnect. Watchdog timer should be set to 3+ minutes, not 60 seconds, to avoid false reconnects during thin early-session minutes. |
| **Symbol not trading on IEX** | IEX covers most NYSE/Nasdaq listed stocks but not all OTC or foreign ADRs. A symbol can be valid on SIP but receive zero IEX bars. | Log a warning if BarStore for a subscribed symbol receives no bars within 15 minutes of market open. Surface "No data" on the signal table for that symbol. |

### Multi-Timeframe Aggregation

| Edge Case | What Happens | Required Behavior |
|-----------|-------------|-------------------|
| **Insufficient 1m bars for aggregation** | A 5m bar requires 5 complete 1m bars. Early in the session (9:30–9:35 AM) there may be fewer than 5 bars in the store. | Return the bars that exist (partial aggregated series). The chart renders whatever it receives; an incomplete first candle is acceptable. |
| **1m bar timestamps not on 5m boundaries** | If yfinance bars were stored with 1-minute timestamps that don't align perfectly (rounding issues), groupby-based aggregation can produce incorrect bins. | Use `pd.Grouper(freq="5min", closed="left", label="left")` with `origin="start_day"` anchored to 09:30 ET, not UTC midnight. This ensures 5m bins start at 9:30, 9:35, 9:40 etc. rather than arbitrary offsets. |
| **IFVG expiry count changes with timeframe** | IFVG expiry is defined as 10 bars. On 1m that is 10 minutes; on 1h that is 10 hours. Applying the 1m `IFVG_LOOKBACK=10` constant to a 1h aggregation is incorrect. | Pass the timeframe to the IFVG computation or derive the correct lookback: `lookback = IFVG_LOOKBACK` regardless (the constant is "10 bars" by design, which is timeframe-relative and correct). No change needed to the IFVG function. |
| **Signal overlays on higher TF may lag** | On 1m, the most recent IFVG zone is from minutes ago. On 1h, it could be from hours ago. The chart must not mislead the user into thinking the current signal state applies to the current 1h bar. | The chart endpoint already returns the full overlay computation from all available aggregated bars. No additional handling needed — the behavior is inherent to the computation. |
| **EMA warm-up period on short bar history** | EMA-20 requires at least 20 bars. If only 10 bars are available (e.g. early session on 5m), the EMA will be NaN for the first 19 bars. | Already handled: `compute_ema` returns NaN for warm-up bars. The chart endpoint already filters NaN EMA values before serializing the response. |

### Watchlist Management UI

| Edge Case | What Happens | Required Behavior |
|-----------|-------------|-------------------|
| **Duplicate symbol add** | User types "SPY" when SPY is already in the watchlist. Backend returns 409. | Show inline message: "SPY is already in your watchlist." Do not add duplicate entry to local state. |
| **Remove the currently selected symbol** | User deletes the symbol they are currently viewing on the chart. | After successful delete, auto-select the first remaining symbol. If the watchlist is now empty, show an empty state with a prompt to add a symbol. |
| **Watchlist empty state** | All symbols removed. | Disable chart loading and signal table. Show "Add a symbol to get started" message in the main content area. |
| **Case sensitivity** | User types "aapl" instead of "AAPL". | Normalize to uppercase on submit (client-side). Backend watchlist router already calls `.upper()` on the symbol parameter. |
| **Network error during add/remove** | Server unreachable. | Revert optimistic UI update. Show inline error: "Could not update watchlist. Check your connection." |
| **Alpaca feed doesn't subscribe to new symbol** | After a symbol is added to the watchlist via the UI, the Alpaca feed is already running and subscribed to the old list. | The feed must dynamically subscribe to new symbols. Alpaca's WebSocket protocol supports sending a new `{"action": "subscribe", "bars": ["AAPL"]}` message on an existing connection without reconnecting. |

---

## Feature Dependencies

```
Existing (v1.0):
  BarStore (bar_store singleton)
    → Signal engine (compute_ifvg, compute_cisd, compute_ema)
    → Chart endpoint (/chart/bars/{symbol})
    → Signal broadcaster

New (v1.1):

  Alpaca WebSocket feed (alpaca_feed.py)
    → Replaces poll_yfinance_loop for stock symbols
    → Writes to existing BarStore (same interface as Binance feed)
    → Must dynamically subscribe when watchlist changes (new: subscribe on POST /watchlist)
    → Depends on: ALPACA_API_KEY + ALPACA_SECRET_KEY env vars

  Multi-timeframe aggregation
    → Depends on: BarStore having enough 1m bars (at least 1 bar for any output)
    → Depends on: existing compute_ifvg, compute_cisd, compute_ema functions
    → Must aggregate 1m bars into target TF before passing to strategy functions
    → Chart endpoint (/chart/bars/{symbol}?timeframe=5m) extended, not replaced
    → Frontend timeframe switcher passes ?timeframe= query param to existing endpoint

  Watchlist management UI
    → Depends on: existing /watchlist REST endpoints (GET, POST, DELETE) — all already built
    → Depends on: Alpaca feed supporting dynamic subscription (new requirement)
    → After symbol add: feed subscribes to new symbol; BarStore starts accumulating
    → After symbol remove: feed unsubscribes; BarStore entry can remain (stale, but harmless)
    → Frontend sidebar replaces the static symbol selector on DashboardPage and ChartPage
```

---

## MVP Recommendation (v1.1)

All three features are required for the milestone. They are sequenced by dependency:

**Step 1 (unblocks all signal work):**
Replace `poll_yfinance_loop` with `alpaca_feed`. This is the foundation — without real-time
stock data, the multi-timeframe chart is no more useful than what exists today.

**Step 2 (new chart capability):**
Add `?timeframe=` parameter to `/chart/bars/{symbol}`. Implement pandas aggregation.
Frontend adds the timeframe switcher pill group. Overlays recomputed per TF automatically
because the backend runs the same strategy functions on aggregated data.

**Step 3 (UX completeness):**
Expose the watchlist management UI in the sidebar. The REST endpoints are already built
(GET/POST/DELETE `/watchlist`) — this is frontend work only, plus one backend change:
the Alpaca feed must subscribe dynamically when the watchlist changes.

**What to defer:**
- Alpaca test stream env var flag — low complexity, add it, it costs nothing
- Feed source indicator — low complexity, add it alongside the Alpaca feed implementation
- Timeframe persistence across symbol switches — add it as part of Step 2 (trivial React state lift)

---

## v1.0 Feature Landscape (preserved)

All v1.0 features remain valid and built. The following table remains accurate for the
existing functionality.

### Table Stakes (v1.0, all built)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Real-time price feed** | Without live data, signals are useless noise | Medium | WebSocket stream; 1-min bars from Binance (crypto) and Alpaca WebSocket (stocks, v1.1+). Latency under 2 seconds acceptable. |
| **Combined signal indicator (Long / Short / No Signal)** | The one answer the trader comes to the dashboard for | Low | Computed server-side from IFVG + CISD + EMA state. Color-coded badge: green/red/grey. |
| **Per-condition state display** | Traders need to know why a signal fired or didn't | Low | Three rows per asset: IFVG state, CISD state, EMA condition. |
| **Asset switcher** | Strategy applies to multiple instruments | Low | Dropdown or tab list; no full page reload. |
| **Historical candlestick chart** | Signals must be verified visually | Medium | OHLCV candlestick chart. Zoom/pan supported via lightweight-charts v5. |
| **Signal overlays on chart** | Where exactly did the signal fire? | Medium | IFVG zones as boxes, CISD levels as horizontal lines, entry markers at signal candles. |
| **Authentication / login gate** | Dashboard is private | Low | Single-user JWT auth. |
| **Paper trade entry (Long/Short)** | Core test loop: see signal, execute simulated trade | Medium | Market order simulation. |
| **Open positions list** | Trader needs to know what's currently open | Low | Asset, direction, entry price, stop, target, current P&L. |
| **Closed trades list** | Verify strategy over time | Low | Entry/exit price, outcome, R-multiple, date. |
| **Cumulative P&L display** | Most-watched number in any trading sim | Low | Running total in portfolio currency. |
| **Session context indicator** | NY session is the only valid signal window (9:30–10:30 AM ET) | Low | "In Session" / "Out of Session" visual indicator. |

### Anti-Features (v1.0, still applies)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Real money / broker integration** | Regulatory risk, 10x complexity | Keep paper trading only. |
| **Multiple strategy support** | This dashboard is purpose-built for IFVG+CISD+EMA | Hard-code the strategy. |
| **Custom indicator builder** | TradingView's problem space | Use fixed strategy logic. |
| **Social / copy trading / signal sharing** | Personal portfolio tool | Public demo URL is sufficient. |
| **Mobile app (native)** | Web-first is correct for a dashboard at this scale | Ensure web UI is readable on mobile. |
| **Automated alerts (email/SMS/Telegram)** | Third-party integrations, cost, infra | Display signal state clearly on dashboard. |
| **Multi-user / multi-tenant** | Single user. Tenancy means user models, scoped data, billing. | Single JWT credential. |

---

## Sources

- Alpaca WebSocket Stream docs: https://docs.alpaca.markets/docs/streaming-market-data
- Alpaca Market Data FAQ (IEX vs SIP): https://docs.alpaca.markets/docs/market-data-faq
- Alpaca Community Forum — IEX free tier limits: https://forum.alpaca.markets/t/iex-or-sip-with-a-free-account/17141
- lightweight-charts Range Switcher demo: https://tradingview.github.io/lightweight-charts/tutorials/demos/range-switcher
- CoinAPI OHLCV real-time behavior: https://www.coinapi.io/blog/ohlcv-data-explained-real-time-updates-websocket-behavior-and-trading-applications
- Databento OHLCV aggregation schemas: https://databento.com/docs/schemas-and-data-formats/ohlcv
- PROJECT.md — authoritative source of project scope and out-of-scope decisions
- Existing codebase: `backend/data/bar_store.py`, `backend/data/binance_feed.py`, `backend/data/yfinance_feed.py`, `backend/charts/router.py`, `backend/watchlist/router.py`
