---
phase: 03-charts-backtest-deployment
plan: 04
subsystem: frontend
tags: [backtest, recharts, equity-curve, backtest-stats, react-page]
dependency_graph:
  requires: [03-01, 03-02, 03-03]
  provides: [backtest-frontend, equity-curve-component, backtest-stats-panel, backtest-route]
  affects: [frontend/src/App.tsx]
tech_stack:
  added: [recharts@3.8.0]
  patterns: [recharts-area-chart, date-range-form, sonner-toast-errors, protected-route]
key_files:
  created:
    - frontend/src/components/EquityCurve.tsx
    - frontend/src/components/BacktestStatsPanel.tsx
    - frontend/src/pages/BacktestPage.tsx
  modified:
    - frontend/src/App.tsx
    - frontend/package.json
    - frontend/package-lock.json
decisions:
  - recharts AreaChart used for equity curve — declarative React, no imperative canvas API needed
  - Native input[type=date] for date range — shadcn DatePicker not needed, simpler constraint enforcement via min/max attributes
  - colorScheme dark on date inputs — prevents white flash on dark-themed inputs in Chrome/Edge
key_decisions:
  - recharts AreaChart for equity curve — declarative React, no imperative canvas API
  - Native date inputs with min/max for 7-day constraint enforcement
metrics:
  duration: "2 min"
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_modified: 6
---

# Phase 03 Plan 04: Backtest Frontend — Summary

**One-liner:** Backtest page with Recharts equity curve, three-stat panel, and candlestick chart with entry markers, wired to POST /backtest/run with 7-day date range constraint.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Install recharts, create EquityCurve and BacktestStatsPanel | 7f15268 | EquityCurve.tsx, BacktestStatsPanel.tsx, package.json |
| 2 | Create BacktestPage with form, chart, and results | 6c2274f | BacktestPage.tsx, App.tsx |

## What Was Built

### EquityCurve component (`frontend/src/components/EquityCurve.tsx`)
- Recharts `AreaChart` with `ResponsiveContainer` at 200px height
- Area stroke `#22C55E` (bullish green), fill `rgba(34, 197, 94, 0.15)`
- CartesianGrid stroke `#2D3148` (border token), tooltip background `#1A1D27`
- `tickFormatter` converts backend `YYYY-MM-DD HH:MM` to `MM/DD HH:mm` display
- Empty state: "No trades to plot." when data array is empty

### BacktestStatsPanel component (`frontend/src/components/BacktestStatsPanel.tsx`)
- Three stat cards: Trades (integer), Win Rate (% to 1dp), Avg R (2dp + "R" suffix)
- Responsive grid: `grid-cols-1 md:grid-cols-3` — stacks on mobile, 3 columns on desktop
- Section heading "Results" at 20px/600, stat labels at 12px/400 uppercase

### BacktestPage (`frontend/src/pages/BacktestPage.tsx`)
- DashboardHeader + `max-w-[1280px]` content container matching Phase 2/3 layout
- Symbol selector row (watchlist from GET /watchlist on mount, falls back to 'SPY')
- Date range form with native `input[type="date"]` — "From" / "To" labels, `min`/`max` attrs enforce 7-day window
- Constraint notice: "1-minute data is limited to the last 7 days"
- "Run Backtest" CTA button — accent `#3B82F6`, disabled during loading, text changes to "Running backtest..."
- POST /backtest/run via `fetchWithAuth`, Sonner `toast.error()` for server errors
- Results section: CandlestickChart (bars + EMA + markers, no IFVG/CISD), BacktestStatsPanel, EquityCurve

### App.tsx
- Added `/backtest` route as `ProtectedRoute` wrapping `BacktestPage`
- Preserved existing `/chart` route from Plan 03-03

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data flows are wired to live API endpoints.

## Self-Check: PASSED

Files verified:
- `frontend/src/components/EquityCurve.tsx` — EXISTS
- `frontend/src/components/BacktestStatsPanel.tsx` — EXISTS
- `frontend/src/pages/BacktestPage.tsx` — EXISTS
- `frontend/src/App.tsx` — contains `/backtest` and `/chart` routes

Commits verified:
- 7f15268 — feat(03-04): install recharts, create EquityCurve and BacktestStatsPanel components
- 6c2274f — feat(03-04): create BacktestPage with form, chart, and results; add /backtest route

TypeScript: `npx tsc --noEmit` — PASS (0 errors)
