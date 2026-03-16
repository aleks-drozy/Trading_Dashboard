# Requirements: Trading Dashboard

**Defined:** 2026-03-16
**Core Value:** Open the dashboard during the NY session and instantly see whether IFVG + CISD + EMA conditions align for a trade — without TradingView open.

## v1 Requirements

### Authentication

- [ ] **AUTH-01**: User can log in with email and password
- [ ] **AUTH-02**: User session persists across browser refresh (JWT)
- [ ] **AUTH-03**: User can log out from any page

### Signal Display

- [ ] **SIG-01**: Dashboard shows live IFVG state (Bullish / Bearish / None / Expired) per asset
- [ ] **SIG-02**: Dashboard shows live CISD state (Bullish / Bearish) per asset
- [ ] **SIG-03**: Dashboard shows 20-EMA condition (price above / below) per asset
- [ ] **SIG-04**: Signal state updates in real-time via WebSocket (1-minute bar cadence)
- [ ] **SIG-05**: Dashboard shows NY session status (active / inactive)

### Market Data

- [ ] **DATA-01**: Backend fetches 1-minute OHLCV bars for US stock symbols via yfinance
- [ ] **DATA-02**: Backend streams 1-minute crypto bars from Binance WebSocket
- [ ] **DATA-03**: Data layer validates bar recency and handles stale/missing data gracefully
- [ ] **DATA-04**: Backend auto-reconnects to Binance WebSocket on drop (including 24h forced disconnect)

### Charts

- [ ] **CHART-01**: User can view a candlestick chart (1-min bars) for a selected asset
- [ ] **CHART-02**: Chart displays 20-EMA line overlay
- [ ] **CHART-03**: Chart displays active IFVG zones as coloured rectangles
- [ ] **CHART-04**: Chart displays CISD level lines as horizontal lines
- [ ] **CHART-05**: Chart displays Long/Short signal entry markers at the bar where signals fired

### Backtest

- [ ] **BT-01**: User can run a historical signal replay over a selected date range for an asset
- [ ] **BT-02**: Backtest chart shows entry markers where signals fired historically
- [ ] **BT-03**: Backtest displays a cumulative P&L equity curve
- [ ] **BT-04**: Backtest displays trade statistics: total trades, win rate, average R-multiple

### Paper Trading

- [ ] **PAPER-01**: Strategy engine automatically places a paper trade when entry conditions are met during live session
- [ ] **PAPER-02**: User can view a closed trades list with entry price, exit price, stop, target, and win/loss outcome
- [ ] **PAPER-03**: User can view overall portfolio value (starting balance + cumulative paper P&L)

### Asset Management

- [ ] **ASSET-01**: User can add symbols (stocks and crypto pairs) to their watchlist via the dashboard
- [ ] **ASSET-02**: User can remove symbols from the watchlist
- [ ] **ASSET-03**: Dashboard streams and displays signal state for all watchlist symbols

### Deployment

- [ ] **DEPLOY-01**: Backend deployed on Render, frontend on Vercel, both accessible via public URL
- [ ] **DEPLOY-02**: Backend has a keep-alive mechanism (cron ping) to prevent sleep before NY session open (9:20 AM ET)

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

Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| DATA-01 | Phase 2 | Pending |
| DATA-02 | Phase 2 | Pending |
| DATA-03 | Phase 2 | Pending |
| DATA-04 | Phase 2 | Pending |
| SIG-01 | Phase 3 | Pending |
| SIG-02 | Phase 3 | Pending |
| SIG-03 | Phase 3 | Pending |
| SIG-04 | Phase 3 | Pending |
| SIG-05 | Phase 3 | Pending |
| CHART-01 | Phase 4 | Pending |
| CHART-02 | Phase 4 | Pending |
| CHART-03 | Phase 4 | Pending |
| CHART-04 | Phase 4 | Pending |
| CHART-05 | Phase 4 | Pending |
| BT-01 | Phase 4 | Pending |
| BT-02 | Phase 4 | Pending |
| BT-03 | Phase 4 | Pending |
| BT-04 | Phase 4 | Pending |
| PAPER-01 | Phase 3 | Pending |
| PAPER-02 | Phase 3 | Pending |
| PAPER-03 | Phase 3 | Pending |
| ASSET-01 | Phase 1 | Pending |
| ASSET-02 | Phase 1 | Pending |
| ASSET-03 | Phase 3 | Pending |
| DEPLOY-01 | Phase 5 | Pending |
| DEPLOY-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-16*
*Last updated: 2026-03-16 after initial definition*
