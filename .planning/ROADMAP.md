# Roadmap: Trading Dashboard

## Overview

Three phases that build the IFVG + CISD + 20-EMA trading signal dashboard from the ground up. Phase 1 establishes the backend, auth, data feeds, and — most critically — a validated Python strategy engine that mirrors the PineScript source bar-by-bar before any UI work begins. Phase 2 wires the engine to a live React dashboard with WebSocket signal streaming and the paper trading loop, delivering the core value of the product. Phase 3 adds historical charts, backtest P&L curves, and production deployment.

Milestone v1.1 extends the roadmap with three further phases: Phase 4 replaces yfinance polling with a real-time Alpaca WebSocket feed, Phase 5 adds multi-timeframe chart aggregation, and Phase 6 delivers watchlist management in the dashboard UI with live feed synchronisation.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation + Strategy Engine** - FastAPI scaffold, JWT auth, data feeds, and a validated Python IFVG/CISD/EMA engine unit-tested against TradingView output (completed 2026-03-16)
- [x] **Phase 2: Live Signal Dashboard + Paper Trading** - WebSocket signal streaming to a React frontend with signal state display, asset switcher, and automated paper trading engine (completed 2026-03-20)
- [x] **Phase 3: Charts, Backtest + Deployment** - Historical candlestick charts with strategy overlays, backtest P&L curve, and public production deployment on Render + Vercel (completed 2026-03-21)
- [x] **Phase 4: Alpaca Real-time Feed** - Replace yfinance 60s polling with Alpaca WebSocket for real-time US stock bars, seed BarStore via REST backfill on startup, and auto-reconnect with exponential backoff (completed 2026-03-21)
- [x] **Phase 5: Multi-Timeframe Chart Aggregation** - Add a timeframe switcher (1m / 5m / 15m / 1h) to the chart page with IFVG/CISD overlays recomputed per timeframe using server-side pandas resample (completed 2026-03-21)
- [ ] **Phase 6: Watchlist Management UI + Dynamic Feed Subscription** - Watchlist sidebar UI for adding and removing symbols, with AlpacaFeed automatically restarting its stream to track watchlist changes

## Phase Details

### Phase 1: Foundation + Strategy Engine
**Goal**: A validated Python strategy engine that computes IFVG, CISD, and 20-EMA state correctly — tested against TradingView output — with FastAPI running, JWT auth working, and live data flowing from both Binance and yfinance into the engine
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, DATA-01, DATA-02, DATA-03, DATA-04, ASSET-01, ASSET-02
**Success Criteria** (what must be TRUE):
  1. User can log in with email/password, stay logged in across browser refresh, and log out from any page
  2. Backend fetches 1-minute OHLCV bars for a US stock symbol from yfinance and a crypto symbol from Binance WebSocket without errors or stale data
  3. Strategy engine computes IFVG state (Bullish / Bearish / None / Expired), CISD state (Bullish / Bearish), and 20-EMA condition for a given symbol and produces output that matches TradingView Data Window values for the same date range (bar-by-bar diff passes)
  4. Binance WebSocket reconnects automatically on drop and on the proactive 23-hour schedule without manual intervention
  5. User can add and remove symbols from a watchlist via the API and the engine tracks state for all watchlist symbols
**Plans**: 5 plans

Plans:
- [x] 01-01-PLAN.md — FastAPI scaffold, pydantic-settings config, SQLModel database, JWT auth endpoints with tests
- [x] 01-02-PLAN.md — WatchlistSymbol SQLModel model, repository layer, GET/POST/DELETE API with SPY+BTCUSDT seed
- [x] 01-03-PLAN.md — BarStore singleton, yfinance 60-s poller, BinanceFeed with 23-hour restart, lifespan wiring
- [x] 01-04-PLAN.md — Commit FYP_BOT_1_3.pine to docs/reference/, export TradingView reference CSVs to tests/fixtures/
- [x] 01-05-PLAN.md — TDD strategy engine: compute_ifvg, compute_cisd, compute_ema validated bar-by-bar vs TradingView fixtures

### Phase 2: Live Signal Dashboard + Paper Trading
**Goal**: A trader opens the dashboard, logs in, and immediately sees live IFVG / CISD / EMA signal state for all watchlist symbols updating in real-time via WebSocket — and when a signal fires during the NY session the engine automatically places a paper trade and the trader can review the resulting positions and P&L
**Depends on**: Phase 1
**Requirements**: SIG-01, SIG-02, SIG-03, SIG-04, SIG-05, ASSET-03, PAPER-01, PAPER-02, PAPER-03
**Success Criteria** (what must be TRUE):
  1. Dashboard displays live IFVG state, CISD state, and 20-EMA condition per asset, updating at 1-minute bar cadence via WebSocket without a page refresh
  2. Dashboard shows NY session status (active / inactive) and the asset switcher changes displayed signal state without a full page reload
  3. When IFVG and CISD conditions align during the NY session (9:30-10:30 AM ET), the engine automatically records a paper trade at the open of the next bar
  4. User can view a closed trades list showing entry price, exit price, stop, target, and win/loss outcome for each paper trade
  5. User can view overall portfolio value (starting balance + cumulative paper P&L) on the dashboard
**Plans**: 4 plans

Plans:
- [x] 02-01-PLAN.md — Backend WebSocket signal broadcaster: NY session utility, SignalBroadcaster class, /ws/signals endpoint, lifespan wiring
- [x] 02-02-PLAN.md — Frontend scaffold: Vite + React + TypeScript + Tailwind + shadcn/ui + login page with JWT auth
- [x] 02-03-PLAN.md — Backend paper trading engine: PaperTrade model, entry detection, stop/target auto-close, REST endpoints
- [x] 02-04-PLAN.md — Frontend dashboard: SignalTable, PortfolioCard, TradesTable, WebSocket hook, DashboardHeader

### Phase 3: Charts, Backtest + Deployment
**Goal**: The dashboard has a live candlestick chart with IFVG zone and CISD level overlays, a backtest view showing where signals fired historically and the resulting P&L curve, and the application is deployed publicly on Render and Vercel with a keep-alive mechanism ensuring it is awake before the NY session open
**Depends on**: Phase 2
**Requirements**: CHART-01, CHART-02, CHART-03, CHART-04, CHART-05, BT-01, BT-02, BT-03, BT-04, DEPLOY-01, DEPLOY-02
**Success Criteria** (what must be TRUE):
  1. User can view a candlestick chart for a selected asset with 20-EMA line, coloured IFVG zone rectangles, CISD horizontal level lines, and Long/Short entry markers overlaid
  2. User can run a historical signal replay over a selected date range and see entry markers on the chart plus trade statistics (total trades, win rate, average R-multiple) and a cumulative P&L equity curve
  3. Application is accessible via a public shareable URL with the backend on Render and frontend on Vercel, both requiring login before any data is visible
  4. Backend wakes up before 9:30 AM ET via a keep-alive cron ping, confirmed by the health endpoint responding before session open
**Plans**: 4 plans

Plans:
- [x] 03-01-PLAN.md — Backend chart + backtest endpoints, health check, CORS middleware
- [x] 03-02-PLAN.md — Deployment configs (render.yaml, vercel.json) + frontend env var setup
- [x] 03-03-PLAN.md — Frontend candlestick chart page with EMA, IFVG zones, CISD level, entry markers
- [x] 03-04-PLAN.md — Frontend backtest page with equity curve and trade statistics

### Phase 4: Alpaca Real-time Feed
**Goal**: US stock bars arrive in BarStore in real time from Alpaca WebSocket instead of yfinance polling, BarStore is pre-seeded with 100+ historical bars on every backend startup so signals compute immediately, and the feed recovers from connection loss without manual intervention
**Depends on**: Phase 3
**Requirements**: DATA-05, DATA-06, DATA-07
**Success Criteria** (what must be TRUE):
  1. After backend startup, BarStore contains at least 100 bars per watchlist stock symbol sourced from Alpaca REST backfill — signal state is computed and visible in the dashboard within 2 minutes of cold start without waiting for live bars to accumulate
  2. During market hours, new 1-minute stock bars appear in the dashboard at the close of each bar (within ~2 seconds), replacing the previous 60-second yfinance polling cadence
  3. When the Alpaca WebSocket connection drops, the backend reconnects automatically with exponential backoff and resumes delivering bars — no manual restart required and no alert is shown to the user unless the feed remains stale for more than 3 minutes
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md — AlpacaFeed class, backfill_bars function, config settings, alpaca-py dependency, tests 13-20
- [x] 04-02-PLAN.md — Lifespan wiring: replace poll_yfinance_loop with backfill_bars + AlpacaFeed.run(), update lifespan tests

### Phase 5: Multi-Timeframe Chart Aggregation
**Goal**: The chart page lets the trader switch between 1m, 5m, 15m, and 1h bar resolutions, with IFVG zones, CISD levels, and EMA recomputed for the selected timeframe on every switch, and the chosen timeframe persists when the trader selects a different symbol
**Depends on**: Phase 4
**Requirements**: CHART-06, CHART-07
**Success Criteria** (what must be TRUE):
  1. Chart page shows a pill group switcher with four options (1m / 5m / 15m / 1h); clicking a pill immediately reloads the chart at the selected bar resolution without a full page reload
  2. When the timeframe is 5m, 15m, or 1h, the IFVG zones, CISD level lines, and 20-EMA overlay on the chart match what would be computed by running the strategy engine on bars aggregated to that resolution — not the 1m computation repainted at a higher resolution
  3. After switching the active symbol, the timeframe stays on the last-selected pill (does not reset to 1m)
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md — Backend resample_bars helper, timeframe query param on chart endpoint, backfill depth increase to 500, unit tests
- [x] 05-02-PLAN.md — Frontend timeframe pill switcher in ChartPage with state persistence and insufficient-data empty state

### Phase 6: Watchlist Management UI + Dynamic Feed Subscription
**Goal**: The trader can add and remove watchlist symbols directly in the dashboard sidebar without touching the API, and AlpacaFeed automatically adjusts which symbols it streams within 30 seconds of any watchlist change — no backend restart required
**Depends on**: Phase 4
**Requirements**: ASSET-04, ASSET-05, ASSET-06
**Success Criteria** (what must be TRUE):
  1. Dashboard sidebar shows all current watchlist symbols with an add field and a remove button per symbol; adding a valid symbol or removing an existing one updates the list immediately with optimistic UI and shows an inline error on failure (duplicate, invalid format, or network error)
  2. Within 30 seconds of adding a new stock symbol via the sidebar, the dashboard starts displaying signal state for that symbol — without restarting the backend
  3. Within 30 seconds of removing a symbol via the sidebar, the dashboard stops displaying signal state for that symbol and BarStore no longer holds bars for it
**Plans**: 2 plans

Plans:
- [ ] 06-01-PLAN.md — Backend: BarStore.remove(), AlpacaFeed dynamic restart with asyncio.Event, async watchlist router, lifespan wiring
- [ ] 06-02-PLAN.md — Frontend: WatchlistSidebar component with optimistic add/remove, DashboardPage layout integration

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Strategy Engine | 5/5 | Complete | 2026-03-16 |
| 2. Live Signal Dashboard + Paper Trading | 4/4 | Complete | 2026-03-20 |
| 3. Charts, Backtest + Deployment | 4/4 | Complete | 2026-03-21 |
| 4. Alpaca Real-time Feed | 2/2 | Complete   | 2026-03-21 |
| 5. Multi-Timeframe Chart Aggregation | 2/2 | Complete   | 2026-03-21 |
| 6. Watchlist Management UI + Dynamic Feed Subscription | 0/2 | Not started | - |
