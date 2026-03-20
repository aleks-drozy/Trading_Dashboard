# Roadmap: Trading Dashboard

## Overview

Three phases that build the IFVG + CISD + 20-EMA trading signal dashboard from the ground up. Phase 1 establishes the backend, auth, data feeds, and — most critically — a validated Python strategy engine that mirrors the PineScript source bar-by-bar before any UI work begins. Phase 2 wires the engine to a live React dashboard with WebSocket signal streaming and the paper trading loop, delivering the core value of the product. Phase 3 adds historical charts, backtest P&L curves, and production deployment.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation + Strategy Engine** - FastAPI scaffold, JWT auth, data feeds, and a validated Python IFVG/CISD/EMA engine unit-tested against TradingView output (completed 2026-03-16)
- [x] **Phase 2: Live Signal Dashboard + Paper Trading** - WebSocket signal streaming to a React frontend with signal state display, asset switcher, and automated paper trading engine (completed 2026-03-20)
- [ ] **Phase 3: Charts, Backtest + Deployment** - Historical candlestick charts with strategy overlays, backtest P&L curve, and public production deployment on Render + Vercel

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
- [ ] 03-01-PLAN.md — Backend chart + backtest endpoints, health check, CORS middleware
- [ ] 03-02-PLAN.md — Deployment configs (render.yaml, vercel.json) + frontend env var setup
- [ ] 03-03-PLAN.md — Frontend candlestick chart page with EMA, IFVG zones, CISD level, entry markers
- [ ] 03-04-PLAN.md — Frontend backtest page with equity curve and trade statistics

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Strategy Engine | 5/5 | Complete   | 2026-03-16 |
| 2. Live Signal Dashboard + Paper Trading | 4/4 | Complete   | 2026-03-20 |
| 3. Charts, Backtest + Deployment | 0/4 | In progress | - |
