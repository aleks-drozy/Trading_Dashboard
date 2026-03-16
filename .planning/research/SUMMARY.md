# Project Research Summary

**Project:** Trading Signal Dashboard (IFVG + CISD + 20-EMA)
**Domain:** Real-time algorithmic trading signal dashboard with paper trading engine
**Researched:** 2026-03-16
**Confidence:** HIGH

## Executive Summary

This is a single-user, personal trading dashboard purpose-built for a specific ICT/SMC strategy — IFVG detection, CISD structure identification, and 20-EMA confluence. The correct approach is a FastAPI backend serving a React + Vite frontend over WebSockets, with Binance's native kline stream for crypto and yfinance polling for US stocks. Deployment on Render (backend) and Vercel (frontend) is viable at zero cost for this scale. The entire system runs in a single asyncio event loop with in-memory indicator state — no queues, no Redis, no workers are needed.

The strategy engine is the critical path and the highest-risk component. IFVG and CISD are custom indicators with no library implementation — they must be manually translated from PineScript to Python and validated bar-by-bar against TradingView output before any UI work begins. The core value loop (signal state + paper trade entry) can be built and used before charting work is complete; charts are valuable but secondary to the signal computation and trade tracking, and the feature dependency graph confirms this ordering.

The three most operationally significant risks are: (1) lookahead bias from computing signals on the live unclosed bar — a silent correctness bug that makes backtests appear better than live performance; (2) Render's free tier sleep behavior breaking WebSocket connections at the exact time the dashboard is needed most (session open at 9:30 AM ET); and (3) yfinance being an unofficial scraper that can fail silently with stale or missing data. All three have documented mitigations that must be built in from day one, not retrofitted later.

---

## Key Findings

### Recommended Stack

The stack is mature, well-documented, and appropriate for a single-developer deployment. FastAPI 0.115+ is the correct backend choice — async-native with first-class WebSocket support requiring no additional plugins. The frontend uses Vite + React 18 + TypeScript with TradingView Lightweight Charts v5 for financial charting (canvas-based, handles dense 1m bar data without performance degradation). Zustand handles frontend state with minimal boilerplate. One critical gotcha: `python-jose` is abandoned (no releases since 2021, known security vulnerabilities) and must not be used — FastAPI's own docs were updated in mid-2024 to replace it with `PyJWT`. Similarly, Create React App is unmaintained; Vite is the current standard. TA-Lib requires C binary compilation that is unreliable on Render free tier; `pandas-ta` (pure Python) is the correct alternative.

**Core technologies:**
- **FastAPI 0.115+ (`fastapi[standard]`)**: Backend framework — async-native, native WebSocket, zero extra config
- **websockets 12.0+**: Binance stream — 10 lines to connect to `data-stream.binance.vision`, no API keys required
- **yfinance 0.2.40+**: US stock data — only free no-key option; must use `asyncio.to_thread()` to avoid blocking the event loop; validate freshness on every call
- **pandas 2.1+ + pandas-ta 0.3.14b+**: Signal computation — EMA via `ewm(span=20, adjust=False)` to match PineScript; IFVG/CISD as custom Python functions
- **SQLAlchemy 2.0 async + aiosqlite**: Paper trade persistence — WAL mode required; ephemeral on Render free tier (design around this)
- **PyJWT 2.8+ + passlib[bcrypt]**: Auth — single hashed password in env var, no user table needed; do NOT use `python-jose`
- **Vite + React 18 + TypeScript**: Frontend scaffolding — auto-detected by Vercel, sub-200ms dev server
- **TradingView Lightweight Charts v5**: Charting — MIT licensed, canvas-based, financial primitives first-class; do NOT use Recharts (SVG, no native OHLC)
- **Zustand 4.x**: Frontend state — ~30 lines for full signal + trade store; Redux Toolkit is overkill
- **TanStack Query v5**: HTTP caching — REST calls for backtest history, trade records, initial data fetch
- **Render (free tier)**: Backend hosting — 512MB RAM, ephemeral filesystem, 15-minute inactivity spin-down
- **Vercel (Hobby)**: Frontend hosting — static SPA, zero config for Vite, 100GB bandwidth

### Expected Features

Research confirms a two-tier feature structure. The signal computation and paper trading loop must ship before charting. All "table stakes" features are required for the product to feel credible; "differentiators" are strategy-specific and add genuine operational value.

**Must have (table stakes):**
- Real-time price feed (WebSocket for crypto, 60s polling for stocks) — signals are useless without live data
- Combined signal indicator (Long / Short / No Signal) — the primary reason the dashboard exists
- Per-condition state display (IFVG state, CISD state, EMA condition per asset) — traders need to understand why a signal fired or did not
- Asset switcher — strategy applies to multiple instruments; no full page reload on switch
- Session context indicator (In Session / Out of Session, 9:30–10:30 AM ET) — prevents confusion when signals should not be taken
- Authentication gate — single JWT credential, no self-registration flow
- Paper trade entry (market order simulation at next bar open, not signal bar close)
- Open positions list with live P&L
- Closed trades list with R-multiple
- Cumulative P&L display

**Should have (differentiators for this strategy):**
- Historical candlestick chart with IFVG zone + CISD level overlays
- Entry markers on chart
- IFVG expiry countdown (bars remaining, 10-bar limit) — operationally critical for this strategy
- Signal alignment heatmap across assets — see all conditions without chart-hopping
- Backtest P&L curve — demonstrates strategy edge
- Session filter shading on chart (9:30–10:30 ET highlighted on time axis)

**Defer (v2+ or never):**
- Signal confidence score — HIGH complexity, unclear partial-condition definition; defer post-MVP
- IFVG ghost box overlay — medium complexity, minor analytical value for paper trading
- Automated alerts (email/SMS/Telegram) — third-party integrations, cost, not needed for v1
- Real money / broker integration — regulatory risk, 10x implementation complexity; keep paper only
- Drawdown / Sharpe / Sortino analytics — premature for MVP personal dashboard
- Dark/light theme toggle — ship one dark theme; toggles add work with no strategy value

### Architecture Approach

The entire system runs in a single FastAPI process on Render's free tier. One non-negotiable constraint drives every architectural decision: a single server process handles two upstream WebSocket feeds, one strategy engine, one SQLite database, and one browser client — all in the same asyncio event loop. The architecture has five distinct backend layers with clear boundaries: Data Ingest normalizes all sources to a common `OHLCVBar` format and filters to closed bars only; Strategy Engine maintains stateful `AssetState` objects per symbol in memory with a rolling deque, reconstructed from yfinance backfill on startup; Connection Manager broadcasts signal updates to browser clients via WebSocket fan-out; REST API handles stateless operations (auth, history, CRUD); SQLite via aiosqlite persists only paper trades and cached backtest results (live bar data is in-memory only). The frontend is a pure client-side SPA with no SSR.

**Major components:**
1. **Data Ingest Layer** — normalizes Binance WS and yfinance poll output into `OHLCVBar`; publishes to Strategy Engine on `is_closed == True` only; handles reconnection and validation
2. **Strategy Engine** — stateful per-asset `AssetState` with `deque(maxlen=50)`; incremental updates only (never recalculates from scratch per bar); reconstructed from backfill on server restart
3. **Connection Manager** — holds active browser WebSocket connections; broadcasts signal update dicts after each bar; prunes dead connections post-iteration to avoid mutating set mid-loop
4. **REST API** — JWT-protected endpoints for auth, asset history, backtest results, paper trade CRUD, portfolio summary; initial state snapshot sent to browser on WS connect
5. **SQLite / aiosqlite** — WAL mode; paper trades and backtest signals only; no live bar storage; single-writer discipline to avoid contention

### Critical Pitfalls

1. **Lookahead bias on the live (unclosed) bar** — strategy runs on partially-formed candle data; signals fire and disappear when the bar closes (repainting). Prevention: slice `df.iloc[:-1]` before all strategy logic; only process bars where `is_closed == True`; write unit tests comparing Python output against TradingView bar-by-bar for the same date range. Must be resolved in Phase 1 before any UI or paper trading work.

2. **PineScript-to-Python logic translation bugs** — IFVG (3-candle imbalance) and CISD (structure flip) both require multi-bar lookback comparisons that are commonly mis-indexed by one bar; EMA diverges from TradingView when `adjust=True` (pandas default). Prevention: use `ewm(span=20, adjust=False, min_periods=20)`; export TradingView data window output for a specific date range and diff against Python row-by-row; treat the PineScript file as the specification.

3. **Render free tier sleep kills WebSocket connections at session open** — service sleeps after 15 minutes of inactivity; cold start takes 2-3 minutes; a sleeping server cannot accept WebSocket upgrade requests (only HTTP triggers wake-up). Prevention: keep-alive cron (cron-job.org free tier or UptimeRobot) pinging health endpoint at 9:20 AM ET before session open; frontend exponential backoff reconnect; explicit "Reconnecting..." UI state, never blank data.

4. **Binance WebSocket 24-hour hard disconnect** — Binance forcibly closes every connection at the 24-hour mark regardless of keep-alive pings. Prevention: track last-message timestamp per subscription; proactive reconnect scheduled at T+23h; on reconnect, fetch REST snapshot to fill any gap before resuming stream.

5. **yfinance unofficial, rate-limited, and occasionally delayed** — HTTP 429 errors on burst polling; up to 15-minute delays on 1m intraday data; endpoint can break without notice. Prevention: validate dataframe freshness after every call (timestamp within 5 minutes during market hours); cache last successful response; retry with exponential backoff on 429; never let a fetch failure blank the UI.

---

## Implications for Roadmap

Based on the dependency graph in FEATURES.md and the build order in ARCHITECTURE.md, seven phases are recommended. The strategy engine is the critical path and must be isolated and tested before anything depends on it. The signal + paper trading core loop ships before charting.

### Phase 1: Foundation + Strategy Engine

**Rationale:** The strategy engine is the most failure-prone component (lookahead bias, PineScript translation bugs, timezone errors, IFVG off-by-one expiry). It must be built and validated in isolation — with unit tests diffed against TradingView output — before any WebSocket, UI, or paper trading work begins. FastAPI scaffold and JWT auth are included here as the minimum needed to run the backend at all.
**Delivers:** FastAPI project structure, JWT auth (REST only, no WS yet), `OHLCVBar` dataclass, `AssetState` dataclass, IFVG / CISD / EMA logic, NY session filter (timezone-aware, `ZoneInfo("America/New_York")`), startup backfill from yfinance, unit tests validated against TradingView export for known date ranges
**Features addressed:** Authentication gate, per-condition state computation
**Pitfalls avoided:** Lookahead bias (Pitfall 1), PineScript translation bugs (Pitfall 2), timezone mismatch (minor Pitfall 10), IFVG off-by-one (minor Pitfall 11)
**Research flag:** NEEDS DEEPER RESEARCH — the PineScript source file (`FYP_BOT_1_3.pine`) must be read line-by-line to extract the exact IFVG expiry condition, CISD structure-flip definition, and bar-indexing boundaries before implementation

### Phase 2: Data Feeds

**Rationale:** Data ingest depends on the `OHLCVBar` contract defined in Phase 1. Both feeds must be live and validated before the WebSocket layer can broadcast real signals.
**Delivers:** Binance kline WebSocket client (`data-stream.binance.vision`) with reconnect loop and proactive 23h reconnect, yfinance polling with `asyncio.to_thread()` wrapper, data freshness validation (timestamp recency check, NaN detection), retry with exponential backoff on 429, in-memory `AssetState` updates on closed bars only, startup backfill for EMA warmup (last 50 bars)
**Features addressed:** Real-time price feed
**Pitfalls avoided:** Binance 24h hard disconnect (Pitfall 5), yfinance stale/rate-limit failures (Pitfall 4)
**Research flag:** Skip — patterns are well-documented; implementation is mechanical

### Phase 3: WebSocket Layer + Signal Broadcasting

**Rationale:** Connection Manager and the `/ws` endpoint depend on a working strategy engine (Phase 1) and live data feeds (Phase 2). This phase completes the real-time signal pipeline to the browser and introduces the Render keep-alive cron.
**Delivers:** `ConnectionManager` with broadcast fan-out and dead-connection pruning, `/ws?token=<jwt>` endpoint with JWT validation on upgrade, immediate state snapshot sent on connect (no waiting for next bar), delta-only updates over WebSocket (not full history), Render keep-alive cron documented and configured
**Features addressed:** Combined signal indicator, per-condition state display, session context indicator
**Pitfalls avoided:** Render cold start / session open failure (Pitfall 3), React WebSocket connection leak (Pitfall 6)
**Research flag:** Skip — standard FastAPI ConnectionManager pattern; well-documented

### Phase 4: Paper Trading Engine + Database

**Rationale:** Paper trading depends on live prices (Phase 2) and signal state (Phase 1). SQLite with aiosqlite is introduced here; WAL mode and write-safety must be in scope from the start, not added later.
**Delivers:** aiosqlite setup with WAL mode enabled, `paper_trades` table, REST endpoints (POST open trade, PATCH close trade, GET portfolio), fill simulation at open of next bar (not signal-bar close), R-multiple calculation per trade, SQLite persistence decision made (accept ephemeral / add `/api/trades/export` endpoint / add Render Persistent Disk), open positions list with live P&L, closed trades list, cumulative P&L display
**Features addressed:** Paper trade entry, open positions list, closed trades list, cumulative P&L, R-multiple tracking
**Pitfalls avoided:** Optimistic fill price (Pitfall 7), SQLite write contention in async context (Pitfall 8)
**Research flag:** Skip — standard aiosqlite patterns; schema is minimal and well-defined

### Phase 5: React Frontend (Signal + Trade UI)

**Rationale:** The frontend depends on all backend endpoints being functional (Phases 1-4). The signal panel and paper trade panel complete the MVP — the full core value loop ships before any charting work. Charting is valuable but secondary.
**Delivers:** Vite + React 18 + TypeScript scaffold, `useWebSocket` hook with exponential backoff and "Reconnecting..." state, Zustand signal store keyed by symbol, LoginPage + AuthGate (JWT in localStorage), AssetSelector, SignalPanel (IFVG / CISD / EMA badges + Combined signal), session context indicator, PaperTradePanel (NewTradeForm, OpenPositions, TradeHistory), cumulative P&L display
**Features addressed:** All table stakes features except historical chart
**Pitfalls avoided:** WebSocket connection leak on re-render (Pitfall 6); cold start UX handled with explicit reconnecting state (Pitfall 3)
**Research flag:** Skip — established React patterns; `useWebSocket` hook with exponential backoff is documented

### Phase 6: Charting + Backtest

**Rationale:** Charts depend on historical OHLCV data (fetched at startup via yfinance) and a working signal engine. This phase delivers the visual confirmation layer that traders expect and the strategy-edge demonstration via backtest P&L curve.
**Delivers:** TradingView Lightweight Charts v5 integration (ref-based React component, `useEffect` + `useRef` pattern), candlestick series, IFVG zone overlays (price-band series), CISD level overlays (horizontal lines), entry signal markers, session filter shading on time axis, backtest P&L curve (line chart of cumulative equity), signal alignment heatmap across assets, IFVG expiry countdown, `/assets/{symbol}/history` and `/assets/{symbol}/backtest` REST endpoints, backtest result caching in SQLite (invalidated once per day)
**Features addressed:** Historical candlestick chart, signal overlays, backtest P&L curve, signal alignment heatmap, IFVG expiry countdown, session filter visualization
**Pitfalls avoided:** Repeated backtest data fetches on page load (minor Pitfall 12)
**Research flag:** Skip — Lightweight Charts has official React tutorials; backtest caching is a standard pattern

### Phase 7: Deployment + Production Hardening

**Rationale:** Deployment is the final step after a fully functional local system. CORS, env vars, and production config require real deployed URLs that cannot be fully tested locally.
**Delivers:** `render.yaml` backend config, Vercel deployment with `VITE_API_URL`, `ALLOWED_ORIGINS` env var on Render (production Vercel domain, not wildcard), WebSocket `Origin` header validation in route handler (separate from HTTP CORS middleware), keep-alive cron scheduled at 9:20 AM ET, CORS smoke test with actual deployed Vercel URL, final SQLite persistence decision confirmed
**Features addressed:** Production deployment, data persistence
**Pitfalls avoided:** CORS misconfiguration (Pitfall 9), Render cold start at session open (Pitfall 3)
**Research flag:** Skip — Render and Vercel deployment patterns are thoroughly documented

### Phase Ordering Rationale

- Strategy engine before data feeds: the `OHLCVBar` and `AssetState` contracts define what data ingest must produce; the wrong order means constant interface churn and no way to test the engine in isolation
- Data feeds before WebSocket: cannot broadcast real signals without validated live data
- WebSocket before frontend: the `useWebSocket` hook needs a real WS endpoint to integrate against; building the hook against a mock forces maintaining two implementations simultaneously
- Signal + trade UI before charts: charts are valuable but not required for the core trading loop; Phase 5 delivers a fully usable product; charting work in Phase 6 does not block trading
- All backend phases before full frontend: the frontend is a thin display layer — building it on incomplete endpoints forces constant rework
- Deployment last: CORS and production config require real deployed URLs; doing it earlier creates temporary config that needs revisiting

### Research Flags

Phases requiring deeper research during planning:
- **Phase 1 (Strategy Engine):** The PineScript source for IFVG and CISD must be read line-by-line before coding begins. The exact expiry condition, structure-flip definition, and bar-indexing boundaries need to be extracted as a written specification. Recommend a dedicated research sub-task: export TradingView data window values for 2-3 known test dates and write them as fixed test fixtures before implementing the Python logic.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Data Feeds):** Binance WS reconnect and yfinance `asyncio.to_thread()` patterns are fully documented with working examples
- **Phase 3 (WebSocket Layer):** Standard FastAPI `ConnectionManager` pattern; official docs include full working example
- **Phase 4 (Paper Trading + DB):** aiosqlite + WAL mode is documented; schema is minimal
- **Phase 5 (React Frontend):** Standard Vite + Zustand + useWebSocket patterns; Lightweight Charts has official React tutorials
- **Phase 6 (Charting + Backtest):** Lightweight Charts React integration is officially documented with overlay examples
- **Phase 7 (Deployment):** Render + Vercel configuration is thoroughly documented for this exact stack

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All core libraries verified via official docs and multiple 2025/2026 sources; version constraints are specific and sourced; anti-recommendations (python-jose, CRA, TA-Lib) confirmed against official sources |
| Features | HIGH | Table stakes verified against multiple trading dashboard references; differentiators are domain-specific but well-reasoned from strategy mechanics |
| Architecture | HIGH | FastAPI WebSocket patterns and ConnectionManager verified against official docs; strategy engine structure is MEDIUM (custom indicator logic not library-sourced) |
| Pitfalls | HIGH | All critical pitfalls sourced to GitHub issues, official Binance docs, and FastAPI docs; not inferred from first principles |

**Overall confidence:** HIGH

### Gaps to Address

- **IFVG / CISD PineScript source validation:** Research identifies what the logic should do but the exact bar-indexing rules and CISD structure-flip definition require reading the specific PineScript file (`FYP_BOT_1_3.pine`). This is the single most important implementation gap. Resolve in Phase 1 before writing any strategy engine code — treat the Pine source as the specification, not documentation.

- **yfinance latency for US stocks during NY session open:** Research confirms up to 15-minute delays on 1m intraday data in some configurations. If stock signal latency proves unacceptable during Phase 2 integration testing, an alternative data source (Polygon.io free tier, Alpaca market data) should be evaluated. No action needed until Phase 2 reveals actual latency in practice.

- **SQLite persistence decision:** Render free tier ephemeral filesystem means paper trade history is wiped on redeploy. The three options (accept ephemeral + document it in UI, add `/api/trades/export` endpoint for manual backup, add $1/month Render Persistent Disk) are all viable. The decision should be made before Phase 4, as it affects the schema design and what the UI communicates to the user about data persistence.

- **Symbol universe configuration:** Research assumes the strategy runs on a defined list of assets (some stocks, some crypto). The exact symbol list and how it is configured (env var, config file, hardcoded constants) was not specified. This is a low-stakes decision but should be settled during Phase 1 scaffold to avoid ambiguity in the data ingest and strategy engine layers.

---

## Sources

### Primary (HIGH confidence)
- FastAPI WebSocket official docs: https://fastapi.tiangolo.com/advanced/websockets/
- FastAPI PyJWT migration (PR #11589): https://github.com/fastapi/fastapi/pull/11589
- Binance public WebSocket streams (official): https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams
- Binance WebSocket limits (official Binance Academy): https://academy.binance.com/en/articles/what-are-binance-websocket-limits
- TradingView Lightweight Charts React tutorial (official): https://tradingview.github.io/lightweight-charts/tutorials/react/simple
- Render free tier limitations (official): https://render.com/docs/free
- Render persistent disks (official): https://render.com/docs/disks
- Vercel Vite deployment (official): https://vercel.com/docs/frameworks/frontend/vite
- aiosqlite docs (official): https://aiosqlite.omnilib.dev/en/stable/

### Secondary (MEDIUM confidence)
- yfinance rate limiting — GitHub issues #2422, #2125, #1050: confirm 429 errors and 1m data delays in 2025
- python-jose abandonment — FastAPI discussions #11345: community-confirmed, reflected in official PR #11589
- FastAPI WebSocket JWT auth pattern (Hex Shift, Medium): https://hexshift.medium.com/authenticating-websocket-clients-in-fastapi-with-jwt-and-dependency-injection-d636d48fdf48
- SQLite WAL mode for concurrent FastAPI access (Piccolo ORM docs): https://piccolo-orm.readthedocs.io/en/1.1.1/piccolo/tutorials/using_sqlite_and_asyncio_effectively.html
- Zustand vs Redux Toolkit 2025 comparison: https://medium.com/@msmt0452/zustand-vs-redux-toolkit-the-complete-guide-to-state-management-in-react-4dce420741b4
- Keep FastAPI active on Render free tier: https://medium.com/@saveriomazza/how-to-keep-your-fastapi-server-active-on-renders-free-tier-93767b70365c
- PineScript-to-Python conversion guide (Pineify, 2026): https://pineify.app/resources/blog/converting-pine-script-to-python-a-comprehensive-guide

### Tertiary (supporting context)
- PhenLabs SMC Dashboard (TradingView script) — reference UX for SMC/ICT signal dashboard: https://www.tradingview.com/script/By7we6WP-Smarter-Money-Concepts-Dashboard-PhenLabs/
- Edgeful — trading dashboard feature expectations: https://www.edgeful.com/blog/posts/what-is-trading-dashboard-real-time-data-day-traders
- QuantInsti — common backtesting mistakes (fill price accuracy): https://blog.quantinsti.com/common-mistakes-backtesting/
- Binance avoid stale WS connections (Binance Dev Community): https://dev.binance.vision/t/avoiding-detecting-stale-websocket-user-data-stream-connections/4248

---
*Research completed: 2026-03-16*
*Ready for roadmap: yes*
