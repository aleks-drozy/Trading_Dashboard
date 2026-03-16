# Feature Landscape

**Domain:** Real-time algorithmic trading signal dashboard with paper trading engine
**Strategy:** ICT/SMC — IFVG + CISD + 20-EMA
**Researched:** 2026-03-16
**Confidence:** HIGH for table stakes (well-established patterns); MEDIUM for differentiators (domain-specific)

---

## Table Stakes

Features users expect from any credible trading signal dashboard. Missing any of these makes the product feel unfinished or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Real-time price feed** | Without live data, signals are useless noise | Medium | WebSocket stream; 1-min bars from Binance (crypto) and polling/WebSocket from Yahoo Finance (stocks). Latency under 2 seconds is acceptable for this strategy. |
| **Combined signal indicator (Long / Short / No Signal)** | The one answer the trader comes to the dashboard for | Low | Computed server-side from IFVG + CISD + EMA state. Color-coded badge: green/red/grey. |
| **Per-condition state display** | Traders need to know _why_ a signal fired or didn't | Low | Three rows per asset: IFVG state, CISD state, EMA condition. Each with its own status badge. |
| **Asset switcher** | Strategy applies to multiple instruments | Low | Dropdown or tab list; switching loads relevant signal state and chart. No full page reload. |
| **Historical candlestick chart** | Signals must be verified visually by the trader | Medium | OHLCV candlestick chart. Must support zoom/pan. Standard expectation from any charting product. |
| **Signal overlays on chart** | Where exactly did the signal fire? | Medium | IFVG zones rendered as boxes, CISD levels as horizontal lines, entry markers at signal candles. |
| **Authentication / login gate** | Dashboard is private; shareable URL cannot be public | Low | Single-user JWT auth. No self-registration. Hard-coded credentials or env-var secret is sufficient. |
| **Paper trade entry (Long/Short)** | The core test loop: see signal, execute simulated trade | Medium | Button triggers order creation. Requires current price lookup at click time. |
| **Open positions list** | Trader needs to know what's currently open | Low | Table: asset, direction, entry price, stop, target, current P&L. |
| **Closed trades list** | Verify strategy over time | Low | Table: entry/exit price, outcome (win/loss/stopped), R-multiple, date. |
| **Cumulative P&L display** | The single most-watched number in any trading sim | Low | Running total in portfolio currency, displayed prominently. |
| **Session context indicator** | NY session is the only valid signal window (9:30–10:30 AM ET) | Low | Visual indicator: "In Session" / "Out of Session". Prevents confusion when signals should not be taken. |

---

## Differentiators

Features that are not universally expected but add real value for this strategy and this user. These set the dashboard apart from a generic signal board.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **IFVG expiry countdown** | IFVG zones expire after 10 bars — knowing how many bars remain is operationally important | Low | Integer counter (bars remaining) shown alongside IFVG state badge. Unique to this strategy. |
| **IFVG "ghost box" overlay** | Shows where the original FVG was before inversion — critical for understanding the zone's narrative | Medium | Two overlapping rectangles on the chart: original FVG (faded) and active IFVG zone. Requires storing historical zone data. |
| **Signal alignment heatmap across assets** | Quickly see which assets have all three conditions aligned right now | Medium | Grid: assets as rows, conditions (IFVG, CISD, EMA) as columns, combined signal as last column. Color-coded cells. Replaces "chart hopping." |
| **Backtest P&L curve** | Proves the strategy has edge before paper trading begins | Medium | Line chart of cumulative equity from historical signal replays. Requires running the strategy logic over stored OHLCV data offline or on demand. |
| **R-multiple tracking per trade** | Shows trade quality independently of position size — preferred metric in ICT/SMC community | Low | Per-trade R column in closed trades table. Total avg R displayed in summary. |
| **Session filter visualization** | NY session window visually shaded on the chart | Low | Highlight 9:30–10:30 ET range on the time axis. Instantly shows where trades are valid. |
| **Signal confidence score** | Composite strength: are all three conditions strongly aligned, or marginal? | High | Requires defining partial condition states (e.g., price just touched IFVG vs. well inside). Defer to post-MVP. Flag as deeper research needed. |

---

## Anti-Features

Features to deliberately NOT build for v1. Each one is either out of scope by design, a complexity sink, or a premature optimization.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Real money / broker integration** | Regulatory risk, liability, implementation complexity is 10x | Keep paper trading. Note prominently on the UI that this is simulated only. |
| **Multiple strategy support** | This dashboard is purpose-built for IFVG+CISD+EMA. Generalizing means no strategy is well-served | Hard-code the strategy. Strategy config can live in env vars / constants, not a UI builder. |
| **Custom indicator builder** | This is TradingView's problem space. Building a Pine-equivalent engine is a multi-year project | Use the fixed strategy logic. |
| **Social / copy trading / signal sharing** | Personal portfolio tool. Sharing adds auth complexity, privacy concerns, and zero value for the user | Public demo URL is sufficient for portfolio showcase. |
| **Mobile app (native iOS/Android)** | Web-first is correct for a dashboard at this scale. Native adds a separate build surface. | Ensure the web UI is responsive enough to read on mobile (read-only is fine). |
| **Automated trade execution alerts (email/SMS/Telegram)** | Useful eventually but requires third-party integrations (Twilio, SendGrid, Telegram bot) that add infra and cost | Display signal state clearly on the dashboard. Manual monitoring is fine for v1. |
| **Order types beyond market orders** | Limit orders, stop-limit, bracket orders — all add engine complexity with no benefit when there is no real execution | Simulate market orders only. Entry = current price at button click. |
| **Multi-user / multi-tenant** | Single user. Adding tenancy means user models, scoped data, billing. Not needed. | Single JWT credential. |
| **Detailed trade notes / journal** | Trading journal apps (Tradervue, TraderSync) do this better. Building a journal is a product in itself. | Store trade outcome and R-multiple. That is enough to evaluate strategy performance. |
| **Drawdown / Sharpe / Sortino analytics panel** | Useful for a hedge fund. Premature for an MVP personal dashboard. | Show cumulative P&L and win rate. Advanced statistics can be Phase 3+. |
| **Dark/light theme toggle** | Nice-to-have UX work with zero strategy value | Ship with one good dark theme. Trading dashboards are universally dark. |

---

## Feature Dependencies

```
Real-time price feed
  → Per-condition state display (requires live OHLCV)
  → Combined signal indicator (requires per-condition state)
  → Session context indicator (requires current time + price)
  → Paper trade entry (requires current price at click time)

Historical candlestick chart
  → Signal overlays (requires chart to exist first)
  → Backtest P&L curve (requires historical OHLCV + strategy replay)
  → IFVG ghost box (requires chart + zone history)
  → Session filter visualization (requires chart time axis)

Paper trade entry
  → Open positions list (requires stored positions)
  → Closed trades list (requires position close logic: stop hit / target hit)
  → R-multiple tracking (requires closed trade data with entry/stop/target)
  → Cumulative P&L display (requires closed + open trade data)

Asset switcher
  → All per-asset features (signal state, chart, paper trades are scoped per asset)
```

---

## MVP Recommendation

The MVP is a single-user, single-session tool. The trader opens it at 9:25 AM ET, checks the signal state, executes a paper trade if conditions are met, and checks P&L at end of day.

**Prioritize (Phase 1–2):**

1. Authentication gate
2. Real-time price feed (WebSocket for crypto, polling for stocks)
3. Per-condition state display (IFVG, CISD, EMA per asset)
4. Combined signal indicator (Long / Short / No Signal)
5. Asset switcher
6. Session context indicator
7. Paper trade entry (market order simulation)
8. Open positions list with live P&L
9. Closed trades list with R-multiple
10. Cumulative portfolio value display

**Prioritize (Phase 3):**

11. Historical candlestick chart with IFVG zone + CISD level overlays
12. Entry markers on chart
13. Backtest P&L curve
14. Signal alignment heatmap across assets
15. IFVG expiry countdown
16. Session filter shading on chart

**Defer to post-MVP or never:**

- Signal confidence score (HIGH complexity, unclear definition)
- IFVG ghost box (medium complexity, minor analytical value for paper trading)
- All anti-features listed above

**Phase ordering rationale:** Signal state and paper trading are the core value loop — they can ship and be used before the charting work is complete. Charts are valuable but secondary; a trader can confirm signals visually in TradingView while the dashboard handles signal computation and paper order management.

---

## Sources

- ETNA Software — paper trading platform features: https://www.etnasoft.com/best-paper-trading-platform-for-u-s-broker-dealers-why-advanced-simulation-sets-the-2025-standard/
- Edgeful — day trading dashboard feature expectations: https://www.edgeful.com/blog/posts/what-is-trading-dashboard-real-time-data-day-traders
- MQL5 / TradingView community — IFVG and SMC dashboard patterns: https://www.mql5.com/en/blogs/post/767492
- TradingView — multi-asset signal dashboard and watchlist UX: https://www.tradingview.com/features/
- PhenLabs SMC Dashboard (TradingView) — SMC/ICT dashboard reference: https://www.tradingview.com/script/By7we6WP-Smarter-Money-Concepts-Dashboard-PhenLabs/
- PROJECT.md — authoritative source of project scope and out-of-scope decisions
