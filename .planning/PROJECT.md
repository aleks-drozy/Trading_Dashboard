# Trading Dashboard

## What This Is

A live trading signal dashboard that implements the IFVG + CISD + 20-EMA strategy from Aleksandrs' final year project. It shows real-time signal state for US stocks and crypto, historical backtest results with a P&L curve, and includes a paper trading engine for simulated order execution and portfolio tracking. Private dashboard requiring login, deployed publicly for portfolio demonstration.

## Core Value

A trader can open the dashboard during the NY session (9:30–10:30 AM) and instantly see whether IFVG, CISD, and EMA conditions are aligned for a long or short entry — without needing TradingView open.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can log in and access a private dashboard
- [ ] Dashboard shows live IFVG state (Bullish / Bearish / None / Expired) per asset
- [ ] Dashboard shows live CISD state (Bullish / Bearish) per asset
- [ ] Dashboard shows whether 20-EMA condition is met (price above/below)
- [ ] Dashboard shows a combined signal indicator (Long / Short / No Signal)
- [ ] Price data streams in real-time via WebSocket (1-minute bars)
- [ ] Historical chart shows candlesticks with IFVG zones and CISD levels overlaid
- [ ] Historical view shows where signals fired (entry markers on chart)
- [ ] Backtest P&L curve shows cumulative performance over time
- [ ] User can place simulated paper trades (long/short) from the dashboard
- [ ] Paper trading engine tracks open positions with entry price, stop, and target
- [ ] Paper trading engine shows P&L per trade and cumulative portfolio value
- [ ] Dashboard supports US stocks/indices (Yahoo Finance) and crypto (Binance)
- [ ] User can switch between assets on the dashboard
- [ ] Application is deployed publicly with a shareable URL

### Out of Scope

- Real money trading / broker integration — not safe for v1, regulatory complexity
- Mobile app — web-first
- Multiple strategy support — this dashboard is purpose-built for IFVG+CISD+EMA
- Social/sharing features — personal portfolio tool

## Context

- Strategy is implemented in PineScript v6 (`FYP_BOT_1_3.pine`) — the dashboard re-implements the logic in Python
- **IFVG** (Inverted Fair Value Gap): 3-candle imbalance zone; becomes "inverted" when price breaks back through it; expires after 10 bars
- **CISD** (Change in State of Delivery): horizontal level drawn at structure flip points; tracks whether market is in bullish or bearish delivery
- **Entry signal**: IFVG state + CISD state must align (both bullish = Long signal, both bearish = Short signal), confirmed by price above/below 20-EMA
- **Session filter**: NY session only, 9:30–10:30 AM ET, weekdays
- **Risk management**: swing high/low stops, 1.5:1 R:R, max 1 trade per day
- Stock data: Yahoo Finance (free, no API key needed via `yfinance`)
- Crypto data: Binance WebSocket API (free, no key needed for public market data)

## Constraints

- **Tech Stack**: Python (FastAPI) backend, React frontend, WebSockets for streaming — decided by user
- **Cost**: Free tier only — Render (backend), Vercel (frontend), no paid APIs
- **Data Latency**: Real-time means ~1-second delay acceptable (not HFT)
- **Auth**: JWT-based, single user (personal dashboard — no multi-tenancy needed for v1)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Yahoo Finance for stocks | Free, no API key, solid Python library (`yfinance`) | — Pending |
| Binance WebSocket for crypto | Free public market data, native WebSocket support | — Pending |
| FastAPI over Django/Flask | Async-native, WebSocket support built-in, fast to build | — Pending |
| Re-implement strategy in Python | Can't run PineScript server-side; Python logic mirrors Pine logic | — Pending |
| SQLite for v1 (paper trading data) | No infra cost, simple, sufficient for single user | — Pending |

---
*Last updated: 2026-03-16 after initialization*
