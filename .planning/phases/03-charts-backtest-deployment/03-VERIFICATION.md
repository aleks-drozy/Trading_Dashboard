---
phase: 03-charts-backtest-deployment
verified: 2026-03-21T00:00:00Z
status: human_needed
score: 11/12 must-haves verified
re_verification: false
human_verification:
  - test: "Deploy backend to Render and frontend to Vercel using the scaffolded config"
    expected: "Backend accessible at a public Render URL, frontend accessible at a public Vercel URL"
    why_human: "DEPLOY-01 requires actual live deployment — render.yaml and vercel.json are correctly scaffolded but actual deployment is a manual user action in external dashboards"
---

# Phase 3: Charts, Backtest, and Deployment Verification Report

**Phase Goal:** Candlestick charts with strategy overlays, backtesting engine, and production deployment configuration
**Verified:** 2026-03-21
**Status:** human_needed (11/12 must-haves verified; 1 requires human action)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | GET /chart/bars/{symbol} returns OHLCV bars, EMA values, IFVG zone geometry, CISD level price, and entry markers | VERIFIED | `backend/charts/router.py` lines 299-360: endpoint exists, all five response keys present (bars, ema, ifvg_zones, cisd_level, markers); Python import confirmed at runtime |
| 2  | POST /backtest/run accepts symbol + date range, returns bars + entries + equity curve + stats | VERIFIED | `backend/backtest/router.py` lines 40-266: full backtest simulation with equity_curve, stats.total_trades, stats.win_rate, stats.avg_r_multiple |
| 3  | GET /health returns 200 with {status: ok} | VERIFIED | `backend/main.py` line 76-79: `@app.get("/health")` returns `{"status": "ok"}`; confirmed in routes list at runtime |
| 4  | CORS allows configurable frontend origin | VERIFIED | `backend/main.py` lines 60-66: CORSMiddleware with `allow_origins=[FRONTEND_URL]` where `FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")` |
| 5  | Backtest rejects date ranges exceeding 7 days with 400 error | VERIFIED | `backend/backtest/router.py` lines 64-69: delta_days > MAX_DATE_RANGE_DAYS (7) raises HTTPException(400) with required message |
| 6  | render.yaml defines the web service and keep-alive cron job | VERIFIED | `render.yaml` lines 1-23: type=web, runtime=python, healthCheckPath=/health, cron at "20 13 * * 1-5" named keep-alive |
| 7  | vercel.json configures SPA routing rewrites | VERIFIED | `frontend/vercel.json`: `{"rewrites": [{"source": "/(.*)", "destination": "/index.html"}]}` |
| 8  | Frontend API base URL is configurable via VITE_API_URL environment variable | VERIFIED | `frontend/src/lib/api.ts` line 3: `export const API_BASE = import.meta.env.VITE_API_URL ?? ''`; fetchWithAuth and loginRequest both use API_BASE |
| 9  | Vite dev proxy forwards /chart and /backtest routes to backend | VERIFIED | `frontend/vite.config.ts` lines 19-21: '/chart', '/backtest', '/health' all proxy to localhost:8000 |
| 10 | User sees a candlestick chart with 20-EMA line for the selected asset | VERIFIED | `CandlestickChart.tsx`: createChart with CandlestickSeries (#22C55E/#EF4444) and LineSeries (#3B82F6); ChartPage fetches from /chart/bars/{symbol} |
| 11 | Chart displays IFVG zones as coloured semi-transparent rectangles | VERIFIED | `CandlestickChart.tsx` lines 119-138: paired createPriceLine calls per zone using rgba(34,197,94,0.5)/rgba(239,68,68,0.5) |
| 12 | Chart displays CISD level as a yellow dashed horizontal line | VERIFIED | `CandlestickChart.tsx` lines 107-116: createPriceLine with color '#F1C40F', LineStyle.Dashed |
| 13 | Chart displays Long/Short entry markers as up/down arrows | VERIFIED | `CandlestickChart.tsx` lines 141-150: createSeriesMarkers with arrowUp/arrowDown, belowBar/aboveBar positions |
| 14 | DashboardHeader has nav links to chart and backtest pages | VERIFIED | `DashboardHeader.tsx` lines 13-17: navLinks array with /dashboard, /chart, /backtest; active state uses #3B82F6 |
| 15 | User can select a date range and run a backtest for a symbol | VERIFIED | `BacktestPage.tsx`: symbol selector, from/to date inputs, handleRunBacktest POSTs to /backtest/run |
| 16 | Backtest results show entry markers on a candlestick chart | VERIFIED | `BacktestPage.tsx` lines 211-217: CandlestickChart rendered with results.markers |
| 17 | Backtest results show a cumulative P&L equity curve | VERIFIED | `BacktestPage.tsx` line 227: EquityCurve with results.equity_curve; EquityCurve.tsx: Recharts AreaChart with cumPnl dataKey |
| 18 | Backtest results show trade statistics: total trades, win rate, avg R-multiple | VERIFIED | `BacktestStatsPanel.tsx`: Trades, Win Rate, Avg R stat cards with correct formatting |
| 19 | Date range is limited to 7 days with clear UI messaging | VERIFIED | `BacktestPage.tsx` line 187: "1-minute data is limited to the last 7 days"; min/max on date inputs enforce window |
| 20 | Backend deployed on Render, frontend on Vercel, both accessible via public URL (DEPLOY-01) | NEEDS HUMAN | render.yaml and vercel.json are correctly scaffolded but actual live deployment requires manual user action in Render/Vercel dashboards |

**Score:** 19/20 truths verified (the 20th requires human deployment action)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/charts/__init__.py` | Module marker | VERIFIED | Exists (empty) |
| `backend/charts/router.py` | Chart endpoint with overlays | VERIFIED | 361 lines; exports router with GET /chart/bars/{symbol}; extract_ifvg_zones, extract_cisd_level, extract_entry_markers all present |
| `backend/backtest/__init__.py` | Module marker | VERIFIED | Exists (empty) |
| `backend/backtest/router.py` | Backtest execution endpoint | VERIFIED | 267 lines; BacktestRequest model, POST /backtest/run, 7-day validation, equity_curve, win_rate, avg_r_multiple |
| `backend/main.py` | Health endpoint, CORS, router includes | VERIFIED | CORSMiddleware before routers; charts_router and backtest_router included; GET /health present |
| `render.yaml` | Render deployment config with cron keep-alive | VERIFIED | Contains type:web, runtime:python, healthCheckPath:/health, cron keep-alive at "20 13 * * 1-5" |
| `frontend/vercel.json` | Vercel SPA routing | VERIFIED | Catch-all rewrite to /index.html |
| `frontend/vite.config.ts` | Dev proxy for chart and backtest routes | VERIFIED | /chart, /backtest, /health all proxied |
| `frontend/src/lib/api.ts` | Configurable API base URL | VERIFIED | VITE_API_URL, API_BASE export, fetchWithAuth uses API_BASE prefix |
| `frontend/src/components/CandlestickChart.tsx` | Imperative lightweight-charts component | VERIFIED | 204 lines (min 80); createChart, CandlestickSeries, LineSeries, createSeriesMarkers, createPriceLine all present |
| `frontend/src/pages/ChartPage.tsx` | Chart page with symbol selector | VERIFIED | 141 lines (min 40); fetchWithAuth to /chart/bars/{symbol}, CandlestickChart rendered, "Live Chart" heading, "No chart data available" empty state |
| `frontend/src/App.tsx` | Routes for /chart and /backtest | VERIFIED | Both routes present as ProtectedRoute wrappers |
| `frontend/src/components/EquityCurve.tsx` | Recharts AreaChart for cumulative P&L | VERIFIED | 70 lines (min 25); AreaChart, ResponsiveContainer, cumPnl dataKey, tickFormatter, "No trades to plot" empty state |
| `frontend/src/components/BacktestStatsPanel.tsx` | Three stat cards | VERIFIED | 47 lines (min 20); Trades, Win Rate, Avg R; md:grid-cols-3 responsive layout |
| `frontend/src/pages/BacktestPage.tsx` | Backtest form, results, chart | VERIFIED | 233 lines (min 80); all required elements present |
| `frontend/src/components/DashboardHeader.tsx` | Nav links for Dashboard/Chart/Backtest | VERIFIED | navLinks array, Link+useLocation, active state via #3B82F6 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/charts/router.py` | `backend/strategy/ifvg.py` | compute_ifvg for zone data | WIRED | Line 329: `ifvg_states = compute_ifvg(df)` and extract_ifvg_zones replicates the loop |
| `backend/charts/router.py` | `backend/data/bar_store.py` | bar_store.get(symbol) | WIRED | Line 309: `bars = bar_store.get(symbol.upper())` |
| `backend/backtest/router.py` | `backend/strategy/ifvg.py, cisd.py, ema.py` | compute_ifvg, compute_cisd, compute_ema | WIRED | Lines 95-97: all three called on full DataFrame |
| `render.yaml` | `backend/main.py` | uvicorn start command + health check path | WIRED | startCommand: uvicorn backend.main:app; healthCheckPath: /health matches @app.get("/health") |
| `frontend/src/lib/api.ts` | VITE_API_URL | import.meta.env | WIRED | Line 3: `import.meta.env.VITE_API_URL ?? ''` |
| `frontend/src/pages/ChartPage.tsx` | `/chart/bars/{symbol}` | fetchWithAuth | WIRED | Line 68: `fetchWithAuth(\`/chart/bars/${selectedSymbol}\`)` |
| `frontend/src/components/CandlestickChart.tsx` | `lightweight-charts` | createChart, addSeries | WIRED | Line 3: import createChart; line 70: createChart(containerRef.current, ...) |
| `frontend/src/pages/BacktestPage.tsx` | `/backtest/run` | fetchWithAuth POST | WIRED | Line 85: `fetchWithAuth('/backtest/run', { method: 'POST', ... })` |
| `frontend/src/components/EquityCurve.tsx` | `recharts` | AreaChart import | WIRED | Line 1-9: AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer all imported |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CHART-01 | 03-01, 03-03 | User can view a candlestick chart (1-min bars) for selected asset | SATISFIED | /chart/bars/{symbol} endpoint + CandlestickChart component wired in ChartPage |
| CHART-02 | 03-01, 03-03 | Chart displays 20-EMA line overlay | SATISFIED | compute_ema in charts/router.py; LineSeries #3B82F6 in CandlestickChart |
| CHART-03 | 03-01, 03-03 | Chart displays active IFVG zones as coloured rectangles | SATISFIED | extract_ifvg_zones returns geometry; paired createPriceLine per zone in CandlestickChart |
| CHART-04 | 03-01, 03-03 | Chart displays CISD level lines as horizontal lines | SATISFIED | extract_cisd_level returns price; createPriceLine with LineStyle.Dashed #F1C40F |
| CHART-05 | 03-01, 03-03 | Chart displays Long/Short signal entry markers at bar where signals fired | SATISFIED | extract_entry_markers; createSeriesMarkers with arrowUp/arrowDown in CandlestickChart |
| BT-01 | 03-01, 03-04 | User can run historical signal replay over selected date range | SATISFIED | BacktestPage form + POST /backtest/run with full bar-by-bar simulation |
| BT-02 | 03-01, 03-04 | Backtest chart shows entry markers where signals fired historically | SATISFIED | markers array in backtest response; CandlestickChart renders them in BacktestPage |
| BT-03 | 03-01, 03-04 | Backtest displays cumulative P&L equity curve | SATISFIED | equity_curve in backtest response; EquityCurve Recharts component |
| BT-04 | 03-01, 03-04 | Backtest displays trade statistics: total trades, win rate, avg R-multiple | SATISFIED | stats in backtest response; BacktestStatsPanel with correct formatting |
| DEPLOY-01 | 03-02 | Backend on Render, frontend on Vercel, both accessible via public URL | NEEDS HUMAN | Deployment configuration complete (render.yaml, vercel.json) but actual deployment is a manual user action |
| DEPLOY-02 | 03-01, 03-02 | Keep-alive cron ping to prevent sleep before NY session open (9:20 AM ET) | SATISFIED | render.yaml cron: `schedule: "20 13 * * 1-5"`, `command: curl -s $RENDER_EXTERNAL_URL/health` |

---

## Anti-Patterns Found

No anti-patterns detected across all 11 new/modified files. Specific checks run:

- TODO/FIXME/HACK/PLACEHOLDER: 0 matches
- Empty implementations (return null, return {}, return []): 0 matches in non-empty-state paths
- Hardcoded stubs: none — all data arrays populated from real API calls or real computation
- Console.log only handlers: none
- onSubmit preventDefault only: none (handleRunBacktest issues real fetch)

All empty-state returns (EquityCurve "No trades to plot", ChartPage "No chart data available") are conditional guards on genuinely empty data, not stubs.

---

## Human Verification Required

### 1. DEPLOY-01 — Live deployment to Render and Vercel

**Test:** Follow the "User Setup Required" steps from 03-02-SUMMARY.md:
1. Connect GitHub repo to Render, select render.yaml-based deployment, set SECRET_KEY / ADMIN_EMAIL / ADMIN_PASSWORD_HASH / FRONTEND_URL env vars in Render dashboard
2. Connect GitHub repo to Vercel with root directory `frontend`, set VITE_API_URL to the Render service URL
3. Trigger a deploy on both platforms

**Expected:** Backend health check at `https://<render-service>.onrender.com/health` returns `{"status": "ok"}`; frontend at `https://<vercel-app>.vercel.app` loads the login page; navigating to `/chart` and `/backtest` works (SPA rewrites active)

**Why human:** Actual cloud deployment cannot be verified programmatically from a local repo. render.yaml and vercel.json are correctly formed and all endpoints are in place — only the manual dashboard steps remain.

---

## Summary

Phase 3 goal is fully achieved in the codebase. All 11 requirements with code deliverables are satisfied:

- **Backend API (CHART-01 through CHART-05, BT-01 through BT-04, DEPLOY-02):** Three new endpoints are registered and importable. The chart endpoint correctly extracts IFVG zone geometry, CISD levels, EMA values, and entry markers from the existing strategy engine. The backtest endpoint fetches yfinance 1m bars, simulates trades bar-by-bar with stop/target/quantity logic matching the paper engine, and returns an equity curve and trade stats. Health check and CORS are present.

- **Deployment config (DEPLOY-02):** render.yaml and vercel.json are correctly structured. The keep-alive cron fires at 9:20 AM ET Mon-Fri. API_BASE in api.ts switches between empty (Vite proxy in dev) and full Render URL (production) via VITE_API_URL.

- **Frontend charts (CHART-01 through CHART-05):** CandlestickChart is a substantive 204-line imperative lightweight-charts v5 component. It renders all five overlay types (candlesticks, EMA, CISD price line, IFVG zone bracket pairs, Long/Short markers) with correct UI-SPEC colors. ChartPage fetches real data and wires it end-to-end.

- **Frontend backtest (BT-01 through BT-04):** BacktestPage presents a complete form with symbol selector, date range inputs, 7-day constraint notice, and a "Run Backtest" CTA. Results section renders CandlestickChart + BacktestStatsPanel + EquityCurve from the API response. EquityCurve properly formats dates and handles empty state.

The single remaining item (DEPLOY-01) cannot be satisfied by code alone — it requires executing the deployment in external dashboards. TypeScript compilation is clean (0 errors). All 8 commits referenced in SUMMARYs exist in git history.

---

_Verified: 2026-03-21_
_Verifier: Claude (gsd-verifier)_
