# Requirements: Trading Dashboard

**Defined:** 2026-03-16
**Core Value:** Open the dashboard during the NY session and instantly see whether IFVG + CISD + EMA conditions align for a trade — without TradingView open.

## v1 Requirements

### Authentication

- [x] **AUTH-01**: User can log in with email and password
- [x] **AUTH-02**: User session persists across browser refresh (JWT)
- [x] **AUTH-03**: User can log out from any page

### Signal Display

- [x] **SIG-01**: Dashboard shows live IFVG state (Bullish / Bearish / None / Expired) per asset
- [x] **SIG-02**: Dashboard shows live CISD state (Bullish / Bearish) per asset
- [x] **SIG-03**: Dashboard shows 20-EMA condition (price above / below) per asset
- [x] **SIG-04**: Signal state updates in real-time via WebSocket (1-minute bar cadence)
- [x] **SIG-05**: Dashboard shows NY session status (active / inactive)

### Market Data

- [x] **DATA-01**: Backend fetches 1-minute OHLCV bars for US stock symbols via yfinance
- [x] **DATA-02**: Backend streams 1-minute crypto bars from Binance WebSocket
- [x] **DATA-03**: Data layer validates bar recency and handles stale/missing data gracefully
- [x] **DATA-04**: Backend auto-reconnects to Binance WebSocket on drop (including 24h forced disconnect)

### Charts

- [x] **CHART-01**: User can view a candlestick chart (1-min bars) for a selected asset
- [x] **CHART-02**: Chart displays 20-EMA line overlay
- [x] **CHART-03**: Chart displays active IFVG zones as coloured rectangles
- [x] **CHART-04**: Chart displays CISD level lines as horizontal lines
- [x] **CHART-05**: Chart displays Long/Short signal entry markers at the bar where signals fired

### Backtest

- [x] **BT-01**: User can run a historical signal replay over a selected date range for an asset
- [x] **BT-02**: Backtest chart shows entry markers where signals fired historically
- [x] **BT-03**: Backtest displays a cumulative P&L equity curve
- [x] **BT-04**: Backtest displays trade statistics: total trades, win rate, average R-multiple

### Paper Trading

- [x] **PAPER-01**: Strategy engine automatically places a paper trade when entry conditions are met during live session
- [x] **PAPER-02**: User can view a closed trades list with entry price, exit price, stop, target, and win/loss outcome
- [x] **PAPER-03**: User can view overall portfolio value (starting balance + cumulative paper P&L)

### Asset Management

- [x] **ASSET-01**: User can add symbols (stocks and crypto pairs) to their watchlist via the dashboard
- [x] **ASSET-02**: User can remove symbols from the watchlist
- [x] **ASSET-03**: Dashboard streams and displays signal state for all watchlist symbols

### Deployment

- [x] **DEPLOY-01**: Backend deployed on Render, frontend on Vercel, both accessible via public URL
- [x] **DEPLOY-02**: Backend has a keep-alive mechanism (cron ping) to prevent sleep before NY session open (9:20 AM ET)

## v1.1 Requirements

### Market Data

- [x] **DATA-05**: Backend streams 1-minute OHLCV bars for US stocks via Alpaca WebSocket (replaces yfinance polling)
- [x] **DATA-06**: Backend seeds BarStore with 100+ historical bars via Alpaca REST API on startup (EMA warm-up — prevents 50-min signal blind spot after Render cold start)
- [x] **DATA-07**: Backend auto-reconnects to Alpaca WebSocket with exponential backoff on connection loss

### Charts

- [x] **CHART-06**: Chart page has a timeframe switcher (1m / 5m / 15m / 1h) that changes the bar resolution displayed
- [x] **CHART-07**: Chart overlays (IFVG zones, CISD levels, entry markers) are recomputed for the selected timeframe

### Asset Management

- [ ] **ASSET-04**: User can add symbols to the watchlist from the dashboard sidebar UI
- [ ] **ASSET-05**: User can remove symbols from the watchlist using the dashboard sidebar UI
- [ ] **ASSET-06**: Alpaca feed automatically picks up watchlist changes and streams data for newly added symbols without a backend restart

## v2 Requirements

### Signal Display

- **SIG-V2-01**: Combined signal indicator (Long / Short / No Signal) per asset — single-glance decision helper
- **SIG-V2-02**: Multi-asset signal heatmap — all watchlist symbols at a glance on one screen

### Paper Trading

- **PAPER-V2-01**: Manual paper trade entry from dashboard (one-click long/short)
- **PAPER-V2-02**: Open positions panel with live unrealised P&L updating in real-time

### Notifications

- **NOTIF-V2-01**: Browser notification when a signal fires during NY session

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real money trading / broker integration | Regulatory complexity, safety risk — out of scope permanently for v1 |
| Mobile app | Web-first; mobile can be added later |
| Multiple strategy support | Dashboard is purpose-built for IFVG+CISD+EMA |
| Multi-user / teams | Single-user personal tool for v1 |
| Alert bots (Telegram, Discord) | Notification scope creep — v2+ |
| Trade journal / notes | Separate concern, adds complexity |
| OAuth login (Google, GitHub) | Email/password sufficient for single user |

## Traceability

Updated during roadmap creation: 2026-03-16; v1.1 phases added: 2026-03-21

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| DATA-01 | Phase 1 | Complete |
| DATA-02 | Phase 1 | Complete |
| DATA-03 | Phase 1 | Complete |
| DATA-04 | Phase 1 | Complete |
| ASSET-01 | Phase 1 | Complete |
| ASSET-02 | Phase 1 | Complete |
| SIG-01 | Phase 2 | Complete |
| SIG-02 | Phase 2 | Complete |
| SIG-03 | Phase 2 | Complete |
| SIG-04 | Phase 2 | Complete |
| SIG-05 | Phase 2 | Complete |
| ASSET-03 | Phase 2 | Complete |
| PAPER-01 | Phase 2 | Complete |
| PAPER-02 | Phase 2 | Complete |
| PAPER-03 | Phase 2 | Complete |
| CHART-01 | Phase 3 | Complete |
| CHART-02 | Phase 3 | Complete |
| CHART-03 | Phase 3 | Complete |
| CHART-04 | Phase 3 | Complete |
| CHART-05 | Phase 3 | Complete |
| BT-01 | Phase 3 | Complete |
| BT-02 | Phase 3 | Complete |
| BT-03 | Phase 3 | Complete |
| BT-04 | Phase 3 | Complete |
| DEPLOY-01 | Phase 3 | Complete |
| DEPLOY-02 | Phase 3 | Complete |
| DATA-05 | Phase 4 | Complete |
| DATA-06 | Phase 4 | Complete |
| DATA-07 | Phase 4 | Complete |
| CHART-06 | Phase 5 | Complete |
| CHART-07 | Phase 5 | Complete |
| ASSET-04 | Phase 6 | Pending |
| ASSET-05 | Phase 6 | Pending |
| ASSET-06 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 28 total — mapped to phases: 28 ✓
- v1.1 requirements: 8 total — mapped to phases: 8 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-16*
*Last updated: 2026-03-21 — v1.1 requirements added (DATA-05..07, CHART-06..07, ASSET-04..06); Phases 4–6 assigned*
