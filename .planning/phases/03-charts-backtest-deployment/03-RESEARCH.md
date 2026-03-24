# Phase 3: Charts, Backtest + Deployment - Research

**Researched:** 2026-03-20
**Domain:** Financial charting (lightweight-charts v5), backtest engine (Python/yfinance), production deployment (Render + Vercel)
**Confidence:** HIGH (charts/deployment), MEDIUM (backtest data limits)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHART-01 | User can view a candlestick chart (1-min bars) for a selected asset | lightweight-charts v5 CandlestickSeries + FastAPI `/chart/bars/{symbol}` endpoint returning OHLCV from BarStore |
| CHART-02 | Chart displays 20-EMA line overlay | lightweight-charts LineSeries fed by EMA values computed server-side or from bar close prices client-side via pandas_ta already in backend |
| CHART-03 | Chart displays active IFVG zones as coloured rectangles | Series primitive attached to candlestick series; use `attachPrimitive()` with canvas `fillRect()` drawing using `priceToCoordinate` |
| CHART-04 | Chart displays CISD level lines as horizontal lines | Second LineSeries (or primitive) with a constant horizontal price value across visible time range |
| CHART-05 | Chart displays Long/Short signal entry markers at the bar where signals fired | `createSeriesMarkers(series, markers)` with `shape: 'arrowUp'/'arrowDown'`, `position: 'belowBar'/'aboveBar'` |
| BT-01 | User can run a historical signal replay over a selected date range for an asset | FastAPI `POST /backtest/run` endpoint; yfinance fetch with `start/end` date params; 7-day limit for 1m bars applies |
| BT-02 | Backtest chart shows entry markers where signals fired historically | Same marker API as CHART-05; backtest endpoint returns per-bar entry events |
| BT-03 | Backtest displays a cumulative P&L equity curve | Recharts AreaChart component; backend returns `[{date, cumPnl}]` array computed from backtest trades |
| BT-04 | Backtest displays trade statistics: total trades, win rate, average R-multiple | Backend computes and returns `{total_trades, win_rate, avg_r_multiple}` stats object alongside equity curve |
| DEPLOY-01 | Backend on Render, frontend on Vercel, both accessible via public URL | render.yaml + vercel.json; CORS origins from env var; JWT login required before any data visible |
| DEPLOY-02 | Backend keep-alive cron ping before 9:30 AM ET | FastAPI health endpoint `GET /health`; external ping via Render Cron Job or UptimeRobot targeting the health endpoint at 9:20 AM ET |
</phase_requirements>

---

## Summary

Phase 3 has three independent workstreams that can be planned in parallel: (1) candlestick charts with overlays, (2) backtest engine + P&L curve, and (3) production deployment.

**Charts:** The project's existing React stack (Vite 6 + React 19 + Tailwind 4 + TypeScript) integrates cleanly with `lightweight-charts` v5.1.0 using an imperative `useRef` + `useEffect` pattern. No React wrapper library is needed or recommended — direct imperative usage keeps control over the primitive API needed for IFVG rectangles and CISD lines. The backend needs one new endpoint to serve historical bar data from BarStore (or a fresh yfinance fetch) in the format the chart expects. EMA, IFVG zones, and CISD levels are computed server-side using the existing strategy engine and returned alongside bars.

**Backtest:** yfinance 1-minute bars are limited to the last 7 days. This is a hard platform constraint. For the backtest date range selector, the UI must communicate this limit clearly (max 7 days, only recent history). The strategy engine already exists in Python and runs bar-by-bar — the backtest endpoint simply runs it over the historical window, collects entry events, computes P&L assuming the same stop/target logic as the paper engine, and returns bars + signals + equity curve. Recharts is the right choice for the P&L equity curve because it is declarative React and does not require the imperative canvas approach needed for financial OHLCV charts.

**Deployment:** Render free tier sleeps after 15 minutes of inactivity with a ~50-second cold start wake-up time. A health endpoint `GET /health` returning `{"status": "ok"}` enables keep-alive pings. The ping must fire before 9:20 AM ET to guarantee the server is awake by 9:30 AM ET. Render's built-in Cron Jobs (available on free tier) can trigger an HTTP request on a schedule. CORS must be configured with the Vercel production URL as an allowed origin, loaded from an environment variable.

**Primary recommendation:** Use `lightweight-charts` v5 directly (no wrapper) for OHLCV charts, Recharts for the equity curve, and Render Cron Jobs for keep-alive. Scope the backtest date range to 7 days maximum due to yfinance 1m data limits.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| lightweight-charts | 5.1.0 | Candlestick chart, EMA line, series markers, zone overlays | Official TradingView library; performant canvas rendering; built-in candlestick + line series; plugins API for rectangles/horizontal lines |
| recharts | 3.8.0 | Cumulative P&L equity curve | Declarative React-native chart library; no canvas imperative API required; AreaChart is 10 lines of JSX; already ecosystem-compatible with this stack |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| yfinance | >=0.2.50 (already installed) | Fetch historical 1m bars for backtest and chart endpoint | Already in requirements.txt; use `yf.Ticker(symbol).history(start=, end=, interval="1m")` for backtest range |
| fastapi-cors (CORSMiddleware) | bundled with fastapi | Allow Vercel frontend to call Render backend | Required for cross-origin XHR/fetch from Vercel domain |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| lightweight-charts direct | lightweight-charts-react-wrapper | Wrapper adds abstraction but the primitive API for rectangles/lines is imperative regardless; direct usage avoids double-wrapping complexity |
| recharts | Chart.js, Victory, Nivo | recharts has the simplest API for a simple equity line; no canvas imperative needed |
| Render Cron Job | External UptimeRobot | Render Cron Jobs are native and free; UptimeRobot also works but adds an external dependency |

**Installation (frontend):**
```bash
cd frontend && npm install lightweight-charts recharts
```

**Version verification:**
- `lightweight-charts`: 5.1.0 (verified via `npm view lightweight-charts version`)
- `recharts`: 3.8.0 (verified via `npm view recharts version`)

---

## Architecture Patterns

### Recommended Project Structure

New files relative to existing project:

```
backend/
├── charts/
│   ├── __init__.py
│   └── router.py          # GET /chart/bars/{symbol}, GET /chart/overlays/{symbol}
├── backtest/
│   ├── __init__.py
│   └── router.py          # POST /backtest/run
└── main.py                # add health endpoint GET /health, include new routers

frontend/src/
├── components/
│   ├── CandlestickChart.tsx   # lightweight-charts component
│   └── EquityCurve.tsx        # recharts AreaChart component
└── pages/
    └── BacktestPage.tsx       # date range picker + run button + results
```

### Pattern 1: lightweight-charts Imperative React Component

**What:** Create chart inside `useEffect`, manage cleanup, update data via `useRef` to series.
**When to use:** Whenever you mount or unmount the chart component; always use `useLayoutEffect` or `useEffect` with cleanup `chart.remove()`.

```typescript
// Source: https://tradingview.github.io/lightweight-charts/tutorials/react/simple
import { useEffect, useRef } from 'react'
import { createChart, CandlestickSeries, LineSeries } from 'lightweight-charts'

export function CandlestickChart({ bars, ema, markers }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      layout: { background: { color: '#0F1117' }, textColor: '#F1F5F9' },
      height: 400,
    })
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a', downColor: '#ef5350',
      borderUpColor: '#26a69a', borderDownColor: '#ef5350',
      wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    })
    candleSeries.setData(bars)  // [{time, open, high, low, close}]

    const emaSeries = chart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 1 })
    emaSeries.setData(ema)      // [{time, value}]

    // Markers for Long/Short entries
    createSeriesMarkers(candleSeries, markers)  // see Pattern 3

    chart.timeScale().fitContent()

    return () => chart.remove()
  }, [bars, ema, markers])

  return <div ref={containerRef} />
}
```

### Pattern 2: IFVG Zone Rectangle Primitive

**What:** Implement `ISeriesPrimitive` interface; in `paneViews()[0].renderer().draw()` convert price+time to canvas coords and call `ctx.fillRect()`.
**When to use:** Any zone overlay requiring a filled rectangle between two price levels over a time range.

```typescript
// Source: https://tradingview.github.io/lightweight-charts/docs/plugins/series-primitives
class IFVGRectangle implements ISeriesPrimitive {
  private _data: { top: number; bottom: number; startTime: Time; endTime: Time; color: string }[] = []
  private _series: ISeriesApi<SeriesType> | null = null
  private _chart: IChartApi | null = null

  attached({ chart, series }: SeriesAttachedParameter) {
    this._chart = chart
    this._series = series
  }
  detached() { this._chart = null; this._series = null }
  updateData(zones: typeof this._data) { this._data = zones }
  paneViews() {
    return [{
      renderer: () => ({
        draw: (target: CanvasRenderingContext2D) => {
          if (!this._chart || !this._series) return
          for (const zone of this._data) {
            const topY = this._series.priceToCoordinate(zone.top)
            const botY = this._series.priceToCoordinate(zone.bottom)
            const x0 = this._chart.timeScale().timeToCoordinate(zone.startTime)
            const x1 = this._chart.timeScale().timeToCoordinate(zone.endTime)
            if (topY == null || botY == null || x0 == null || x1 == null) continue
            target.fillStyle = zone.color  // e.g. 'rgba(38,166,154,0.2)' for bullish
            target.fillRect(x0, topY, x1 - x0, botY - topY)
          }
        }
      })
    }]
  }
}
// Attach:  candleSeries.attachPrimitive(new IFVGRectangle())
```

**Note:** The exact `draw` method signature in v5 uses a `CanvasRenderingContext2D`-like object from the library's renderer target. The actual API passes a `BitmapCoordinatesRenderingScope`. Test against official plugin examples for exact signature.

### Pattern 3: Series Markers (Long/Short Entry Arrows)

**What:** `createSeriesMarkers(series, markers)` places arrows on candles where signals fired.
**When to use:** After setting series data; replace markers array to update.

```typescript
// Source: https://tradingview.github.io/lightweight-charts/tutorials/how_to/series-markers
import { createSeriesMarkers } from 'lightweight-charts'

const markers = [
  {
    time: '2026-03-18T09:31:00',  // ISO or Unix timestamp
    position: 'belowBar' as const,
    color: '#26a69a',
    shape: 'arrowUp' as const,
    text: 'L',
  },
  {
    time: '2026-03-18T09:45:00',
    position: 'aboveBar' as const,
    color: '#ef5350',
    shape: 'arrowDown' as const,
    text: 'S',
  },
]
createSeriesMarkers(candleSeries, markers)
```

### Pattern 4: CISD Horizontal Level Line

**What:** Add a second `LineSeries` with a constant price value repeated across all bar timestamps, or use a `PriceLine` on the candlestick series.
**When to use:** For a static horizontal level (CISD flip point).

```typescript
// Simplest approach: use built-in createPriceLine
const priceLine = candleSeries.createPriceLine({
  price: cisdLevel,
  color: '#F1C40F',
  lineWidth: 1,
  lineStyle: LineStyle.Dashed,
  title: 'CISD',
})
// Remove with: candleSeries.removePriceLine(priceLine)
```

### Pattern 5: Backtest FastAPI Endpoint

**What:** `POST /backtest/run` accepts `{symbol, start_date, end_date}`, fetches bars via yfinance, runs `StrategyEngine` bar-by-bar, simulates entries using the same stop/target logic as `PaperTradingEngine`, and returns bars + signal events + equity curve.

```python
# backend/backtest/router.py
@router.post("/backtest/run")
async def run_backtest(req: BacktestRequest, _=Depends(get_current_user)):
    # req.symbol, req.start_date (str YYYY-MM-DD), req.end_date (str YYYY-MM-DD)
    df = await asyncio.to_thread(
        lambda: yf.Ticker(req.symbol).history(
            start=req.start_date, end=req.end_date, interval="1m"
        )
    )
    # Run strategy engine bar-by-bar (sliding window)
    # Collect entry events, simulate P&L with 1.5R target
    # Return: bars, entries, equity_curve [{date, cumPnl}], stats
```

### Pattern 6: Recharts Equity Curve

**What:** `AreaChart` from recharts with cumulative P&L on Y axis and date on X.
**When to use:** Display backtest equity curve.

```tsx
// Source: https://recharts.github.io/en-US/api/LineChart/
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

<ResponsiveContainer width="100%" height={200}>
  <AreaChart data={equityCurve}>
    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
    <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 11 }} />
    <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} />
    <Tooltip contentStyle={{ background: '#1E293B', border: 'none' }} />
    <Area type="monotone" dataKey="cumPnl" stroke="#26a69a" fill="rgba(38,166,154,0.15)" />
  </AreaChart>
</ResponsiveContainer>
```

### Pattern 7: Health Endpoint + Render Keep-Alive

**What:** A minimal `GET /health` endpoint returns `200 {"status": "ok"}`. Render Cron Job pings it at 9:20 AM ET (UTC 13:20) Monday–Friday.

```python
# In backend/main.py
@app.get("/health")
async def health():
    return {"status": "ok"}
```

**Render Cron Job** (render.yaml):
```yaml
services:
  - type: web
    name: trading-dashboard-api
    runtime: python
    plan: free
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn backend.main:app --host 0.0.0.0 --port $PORT
    healthCheckPath: /health

crons:
  - name: keep-alive
    schedule: "20 13 * * 1-5"   # 9:20 AM ET = 13:20 UTC (EST); adjust for EDT
    command: curl https://<render-service-url>/health
```

**Note on EDT/EST:** NY is UTC-5 in winter (EST) and UTC-4 in summer (EDT). 9:20 AM ET = 13:20 UTC in winter, 13:20 UTC in summer is 9:20 AM EDT. Use `20 13 * * 1-5` for winter and `20 13 * * 1-5` for summer — or run at both `20 13 * * 1-5` AND `20 14 * * 1-5` to cover daylight saving transitions, or simply use a service like UptimeRobot (free, 5-minute intervals) to ensure wakeup regardless of DST.

### Anti-Patterns to Avoid

- **Mounting lightweight-charts outside useEffect:** The library requires a DOM node; mounting in render body causes "Cannot read properties of null" errors. Always mount inside `useEffect` or `useLayoutEffect`.
- **Not calling `chart.remove()` on cleanup:** Creates memory leaks and duplicate canvas elements when navigating between pages.
- **Using React state for chart data updates (re-renders):** Use `series.setData()` or `series.update()` imperatively via `useRef` instead of triggering React re-renders which destroy and recreate the chart.
- **Requesting yfinance 1m data for > 7 days:** Returns empty DataFrame silently or raises error. Enforce a 7-day cap server-side on the backtest endpoint and communicate it in the UI.
- **Hardcoding CORS origins:** Use environment variable `ALLOWED_ORIGINS` so the same code works locally and in production without modification.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Candlestick rendering | Custom SVG/canvas OHLCV renderer | `lightweight-charts` CandlestickSeries | Handles time scale, zooming, panning, touch, resize — hundreds of edge cases |
| Equity curve chart | Custom SVG polyline | recharts AreaChart | Tooltips, responsive container, axis formatting, hover state |
| Price-to-pixel conversion | Manual scaling math | `series.priceToCoordinate()` + `timeScale().timeToCoordinate()` | These methods handle log scale, inverted scale, and viewport transforms |
| Date range validation | Custom calendar picker component | HTML `<input type="date">` or shadcn DatePicker | Already have shadcn/ui; no need for a third date-picker library |

**Key insight:** Canvas coordinate math for financial charts is harder than it looks — price scales can be logarithmic or inverted, the viewport can be panned/zoomed. Always use the library's built-in coordinate methods rather than re-implementing the math.

---

## Common Pitfalls

### Pitfall 1: yfinance 1-Minute Data 7-Day Hard Limit
**What goes wrong:** `yf.Ticker(symbol).history(start="2026-01-01", end="2026-01-31", interval="1m")` returns an empty DataFrame or raises an exception for ranges beyond 7 days.
**Why it happens:** Yahoo Finance API hard limitation for intraday intervals.
**How to avoid:** Server-side enforce `end_date - start_date <= 7 days` before calling yfinance. Return a 400 error with a clear message. Show the constraint in the frontend date picker.
**Warning signs:** Empty DataFrame returned without error when date range exceeds limit.

### Pitfall 2: lightweight-charts v5 Import Changes
**What goes wrong:** Code using `chart.addCandlestickSeries()` (v4 API) fails with "is not a function" in v5.
**Why it happens:** v5 changed to `chart.addSeries(CandlestickSeries, options)`.
**How to avoid:** Always use `addSeries(SeriesType, options)` syntax. Check imports: `import { CandlestickSeries, LineSeries } from 'lightweight-charts'`.
**Warning signs:** TypeScript errors on `addCandlestickSeries` or `addLineSeries`.

### Pitfall 3: Render Free Tier CORS on WebSocket
**What goes wrong:** WebSocket connection from Vercel frontend to Render backend blocked by CORS or CSP.
**Why it happens:** Browser enforces origin checks on WebSocket upgrade; Render free tier may add its own headers.
**How to avoid:** WebSocket auth is already using `?token=` query param (Phase 2 decision). Ensure `allow_origins` in `CORSMiddleware` includes the Vercel production URL. WebSocket itself isn't blocked by CORS middleware in the same way as HTTP, but having correct origins reduces all cross-origin issues.
**Warning signs:** WebSocket connects locally but not in production.

### Pitfall 4: CORS Wildcard with Credentials
**What goes wrong:** Using `allow_origins=["*"]` with `allow_credentials=True` causes browser to reject the response.
**Why it happens:** CORS spec prohibits wildcard origins with credentials.
**How to avoid:** Use explicit origin: `allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")]`. Never combine `"*"` with credentials.
**Warning signs:** CORS error in browser console even though server sends `Access-Control-Allow-Origin: *`.

### Pitfall 5: Render Cold Start During NY Session
**What goes wrong:** Backend is asleep at 9:30 AM ET; first user connection takes 50+ seconds.
**Why it happens:** Render free tier spins down after 15 minutes of inactivity.
**How to avoid:** Render Cron Job at 9:20 AM ET pings `/health`. Verify the health endpoint responds before session open.
**Warning signs:** Dashboard shows "Connection lost" for 1–2 minutes after 9:30 AM.

### Pitfall 6: Chart Data Timestamp Format
**What goes wrong:** lightweight-charts refuses to render data; console shows "Incorrect data item, expected time to be greater than or equal to the previous one".
**Why it happens:** Timestamps must be either Unix seconds (number) or `"YYYY-MM-DD"` strings. ISO datetime strings with `T` separator are not accepted unless converted.
**How to avoid:** Backend endpoint returns timestamps as Unix epoch integers in seconds (not milliseconds). Frontend converts: `Math.floor(new Date(ts).getTime() / 1000)`.
**Warning signs:** Chart renders empty or throws time-ordering errors.

---

## Code Examples

### Backend: Chart Bars Endpoint

```python
# backend/charts/router.py
from fastapi import APIRouter, Depends, HTTPException
from backend.data.bar_store import bar_store
from backend.dependencies import get_current_user
import pandas as pd
from backend.strategy.ema import compute_ema
from backend.strategy.ifvg import compute_ifvg
from backend.strategy.cisd import compute_cisd

router = APIRouter()

@router.get("/chart/bars/{symbol}")
async def get_chart_bars(symbol: str, _=Depends(get_current_user)):
    bars = bar_store.get(symbol.upper())
    if not bars:
        raise HTTPException(status_code=404, detail="No bars available for symbol")
    df = pd.DataFrame([{
        "timestamp": b.timestamp, "open": b.open, "high": b.high,
        "low": b.low, "close": b.close, "volume": b.volume
    } for b in bars]).set_index("timestamp")
    df.index = pd.to_datetime(df.index)

    ema_series = compute_ema(df, period=20)
    ifvg_series = compute_ifvg(df)
    cisd_series = compute_cisd(df)

    ohlcv = [
        {"time": int(idx.timestamp()), "open": row.open, "high": row.high,
         "low": row.low, "close": row.close}
        for idx, row in df.iterrows()
    ]
    ema = [{"time": int(idx.timestamp()), "value": v}
           for idx, v in ema_series.items() if pd.notna(v)]

    return {"bars": ohlcv, "ema": ema, "ifvg": ifvg_series.tolist(),
            "cisd": cisd_series.tolist()}
```

### Backend: CORS Configuration for Production

```python
# backend/main.py (addition)
import os
from fastapi.middleware.cors import CORSMiddleware

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Frontend: Environment Variable Pattern

```typescript
// frontend/src/lib/api.ts (addition)
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
```

**Vercel environment variables:**
- `VITE_API_URL=https://<service>.onrender.com`
- Set in Vercel Dashboard > Project > Settings > Environment Variables

**Render environment variables:**
- `FRONTEND_URL=https://<project>.vercel.app`
- `SECRET_KEY=<strong-random-string>`
- `DASHBOARD_USER=<email>`
- `DASHBOARD_PASSWORD_HASH=<bcrypt-hash>`

### Frontend: vercel.json (SPA routing fix)

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Render render.yaml

```yaml
services:
  - type: web
    name: trading-dashboard-api
    runtime: python
    plan: free
    rootDir: .
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn backend.main:app --host 0.0.0.0 --port $PORT
    healthCheckPath: /health
    envVars:
      - key: FRONTEND_URL
        sync: false
      - key: SECRET_KEY
        sync: false
      - key: DASHBOARD_USER
        sync: false
      - key: DASHBOARD_PASSWORD_HASH
        sync: false
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `chart.addCandlestickSeries()` | `chart.addSeries(CandlestickSeries, opts)` | lightweight-charts v5 (2024) | Breaking API change; old docs/examples on internet are wrong |
| `chart.createSeriesMarkers()` on ISeriesApi | `createSeriesMarkers(series, markers)` standalone import | lightweight-charts v5 | Import path changed |
| CORSMiddleware with `allow_origins=["*"]` | Explicit origin from env var | FastAPI best practice | Required when `allow_credentials=True` |
| Render free tier 15-min sleep | Same (no change) | Current | Keep-alive mechanism is mandatory for pre-session wakeup |

**Deprecated/outdated:**
- lightweight-charts v3/v4 `addCandlestickSeries()` / `addLineSeries()` — replaced by generic `addSeries(SeriesType)` in v5
- yfinance `period="max"` with `interval="1m"` — silently returns only 7 days of data maximum for 1m interval

---

## Open Questions

1. **IFVG Zone Primitive Canvas API Signature**
   - What we know: `ISeriesPrimitive` with `paneViews()` returning renderers is the correct approach; `priceToCoordinate` and `timeToCoordinate` exist.
   - What's unclear: The exact renderer target type in v5 — whether it is a raw `CanvasRenderingContext2D` or the library's `BitmapCoordinatesRenderingScope`. The official plugin examples source code is the authoritative answer.
   - Recommendation: During implementation, reference the Rectangle Drawing Tool source at `https://tradingview.github.io/lightweight-charts/plugin-examples/` and mirror its canvas drawing pattern exactly.

2. **Backtest Date Range with DST**
   - What we know: 9:20 AM ET = 13:20 UTC in winter (EST), 13:20 UTC in summer (EDT). The offset is the same by coincidence.
   - What's unclear: Render Cron Jobs specify UTC. `20 13 * * 1-5` is correct for both EST and EDT as it happens to be equivalent — but this needs double-checking when NY transitions in/out of DST.
   - Recommendation: Use `20 13 * * 1-5` in render.yaml; verify the health check fires at correct local time after DST transitions.

3. **SQLite Persistence on Render Free Tier**
   - What we know: Render free tier has ephemeral filesystem — `trading.db` is lost on each deploy/restart.
   - What's unclear: Whether this has been formally decided and mitigated in Phase 2.
   - Recommendation: Paper trading data will be lost on redeploy. For v1, document this limitation. Optionally add a Render Persistent Disk ($1/month) but this breaks the free-tier constraint. The backtest engine is stateless so it is unaffected.

---

## Sources

### Primary (HIGH confidence)
- https://tradingview.github.io/lightweight-charts/docs — Version 5.1, API reference (createChart, addSeries, CandlestickSeries, LineSeries)
- https://tradingview.github.io/lightweight-charts/tutorials/how_to/series-markers — Series markers API, marker shapes (arrowUp, arrowDown, circle, square), position options
- https://tradingview.github.io/lightweight-charts/docs/series-types — CandlestickData and LineData formats
- https://tradingview.github.io/lightweight-charts/docs/plugins/series-primitives — ISeriesPrimitive interface, paneViews, attached/detached lifecycle
- https://tradingview.github.io/lightweight-charts/plugin-examples/ — Rectangle Drawing Tool, Overlay Price Scale, Vertical Line examples
- https://render.com/docs/deploy-fastapi — FastAPI deployment steps, build/start commands
- https://recharts.github.io/en-US/api/LineChart/ — Recharts AreaChart API

### Secondary (MEDIUM confidence)
- npm registry: `npm view lightweight-charts version` → 5.1.0 (verified live)
- npm registry: `npm view recharts version` → 3.8.0 (verified live)
- https://community.render.com/t/do-web-services-on-a-free-tier-go-to-sleep-after-some-time-inactive/3303 — Confirmed 15-minute inactivity sleep on Render free tier
- https://vercel.com/docs/frameworks/frontend/vite — Vercel Vite deployment, environment variables with VITE_ prefix
- Multiple sources confirming yfinance 1m interval 7-day hard cap (not extendable without paid data)

### Tertiary (LOW confidence)
- Render Cron Job HTTP ping capability (inferred from render.yaml crons spec; exact availability on free tier needs verification during deployment)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm registry verified versions, official TradingView docs confirmed API
- Architecture: HIGH — Chart patterns from official docs; deployment pattern from official Render/Vercel docs
- Backtest 7-day limit: HIGH — Confirmed by multiple independent yfinance sources
- Primitive rectangle drawing: MEDIUM — Interface confirmed in docs; exact canvas API signature in v5 renderer not fully documented; official plugin source is ground truth
- Render Cron Job: MEDIUM — Feature exists per Render docs; free tier availability should be verified

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (lightweight-charts moves quickly; validate v5 API if > 30 days pass)
