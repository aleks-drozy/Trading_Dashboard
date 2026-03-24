---
phase: 03-charts-backtest-deployment
plan: 03
subsystem: frontend-charts
tags: [react, lightweight-charts, candlestick, ema, ifvg, cisd, markers, routing]

requires:
  - phase: 03-charts-backtest-deployment
    plan: 01
    provides: "GET /chart/bars/{symbol} returning bars, ema, ifvg_zones, cisd_level, markers"
  - phase: 02-live-signal-dashboard-paper-trading
    provides: "DashboardHeader component, fetchWithAuth, AuthContext, ProtectedRoute pattern"

provides:
  - "CandlestickChart component: lightweight-charts v5 canvas with candlesticks, EMA line, CISD price line, IFVG zone brackets, Long/Short entry markers"
  - "ChartPage: symbol selector, data fetching from /chart/bars/{symbol}, loading/error/empty states"
  - "DashboardHeader: nav links for Dashboard / Chart / Backtest with active state highlighting"
  - "/chart route: ProtectedRoute-wrapped in App.tsx"

affects: [03-04-backtest-ui]

tech-stack:
  added: [lightweight-charts (5.x, npm install in frontend)]
  patterns:
    - "Imperative chart pattern: useRef+useEffect, chart.remove() on cleanup, no React state for chart data"
    - "Price line pairs for IFVG zone boundaries (top + bottom createPriceLine per zone)"
    - "createSeriesMarkers standalone import for Long/Short entry arrows (v5 API)"
    - "LineStyle.Dashed for CISD horizontal level via createPriceLine on candleSeries"

key-files:
  created:
    - frontend/src/components/CandlestickChart.tsx
    - frontend/src/pages/ChartPage.tsx
  modified:
    - frontend/src/components/DashboardHeader.tsx
    - frontend/src/App.tsx

key-decisions:
  - "IFVG zones implemented as paired price lines (top + bottom) rather than ISeriesPrimitive rectangles — simpler, reliable, avoids uncertain canvas renderer signature in v5"
  - "ChartPage defaults wsStatus=disconnected and nySessionActive=false — chart page has no WebSocket connection"
  - "Symbol selector buttons inline in ChartPage; falls back to 'SPY' if watchlist fetch fails"

requirements-completed: [CHART-01, CHART-02, CHART-03, CHART-04, CHART-05]

duration: 2min
completed: 2026-03-21
---

# Phase 03 Plan 03: Frontend Candlestick Chart Summary

**Imperative lightweight-charts v5 component with 20-EMA line, yellow-dashed CISD level, IFVG zone price-line brackets, and Long/Short arrow markers; wired to /chart/bars/{symbol} via a symbol-selector ChartPage with protected routing and header nav.**

## Performance

- **Duration:** 2 min
- **Completed:** 2026-03-21
- **Tasks:** 2 of 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- Created `CandlestickChart.tsx` — lightweight-charts v5 imperative component using `useRef`+`useEffect`. Renders candlestick series (green/red), 20-EMA `LineSeries` in accent blue, CISD `createPriceLine` in yellow dashed, IFVG zone bracket pairs, and Long/Short `createSeriesMarkers` arrows. Handles resize, cleanup, loading, and error states.
- Created `ChartPage.tsx` — fetches watchlist from `/watchlist` to populate symbol selector buttons, then fetches chart data from `/chart/bars/{symbol}` on symbol change. Passes data to `CandlestickChart`. Handles loading spinner, error message, and empty-state copy.
- Updated `DashboardHeader.tsx` — added Dashboard/Chart/Backtest nav links using `react-router-dom` `Link` + `useLocation`. Active link shows accent blue `#3B82F6`, inactive muted `#6B7280`.
- Updated `App.tsx` — added `/chart` route wrapped in `ProtectedRoute` with `ChartPage`.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | CandlestickChart component with lightweight-charts v5 | a134c0c | frontend/src/components/CandlestickChart.tsx, frontend/package.json, frontend/package-lock.json |
| 2 | ChartPage, navigation links, /chart route | 8871ea1 | frontend/src/pages/ChartPage.tsx, frontend/src/components/DashboardHeader.tsx, frontend/src/App.tsx |

## Deviations from Plan

None - plan executed exactly as written.

The plan offered two options for IFVG zones (paired price lines OR ISeriesPrimitive rectangle primitive). The plan designated price lines as the "simpler, reliable" preferred approach, so that was used. No deviation.

## Known Stubs

None. CandlestickChart consumes all five data arrays from the API (`bars`, `ema`, `ifvg_zones`, `cisd_level`, `markers`). ChartPage fetches real data from `/chart/bars/{symbol}`. All fields are wired end-to-end.

## Self-Check

**Files exist:**
- frontend/src/components/CandlestickChart.tsx: created
- frontend/src/pages/ChartPage.tsx: created
- frontend/src/components/DashboardHeader.tsx: modified
- frontend/src/App.tsx: modified

**Commits exist:**
- a134c0c: feat(03-03): add CandlestickChart component with lightweight-charts v5
- 8871ea1: feat(03-03): add ChartPage, navigation links, and /chart route

**TypeScript:** npx tsc --noEmit — clean (no output)

## Self-Check: PASSED
