---
phase: 03-charts-backtest-deployment
plan: 01
subsystem: api
tags: [fastapi, yfinance, ifvg, cisd, ema, backtest, cors, chart]

requires:
  - phase: 02-live-signal-dashboard-paper-trading
    provides: "strategy engine (compute_ifvg, compute_cisd, compute_ema), bar_store singleton, JWT auth (get_current_user), paper engine entry/stop/target logic"

provides:
  - "GET /chart/bars/{symbol}: OHLCV bars, EMA values, IFVG zone geometry, CISD level price, entry markers"
  - "POST /backtest/run: 1-minute yfinance bars, bar-by-bar strategy simulation, equity curve, trade stats"
  - "GET /health: Render keep-alive health check"
  - "CORS middleware configured via FRONTEND_URL env var"

affects: [03-02-frontend-charts, 03-03-backtest-ui, 03-04-deployment]

tech-stack:
  added: [yfinance (existing dep, now used in backtest endpoint)]
  patterns:
    - "Helper functions replicate strategy internals to extract geometry (zones/levels) rather than just state strings"
    - "asyncio.to_thread for blocking yfinance I/O in async FastAPI handler"
    - "FRONTEND_URL via os.getenv with localhost:5173 default for dev/prod parity"

key-files:
  created:
    - backend/charts/__init__.py
    - backend/charts/router.py
    - backend/backtest/__init__.py
    - backend/backtest/router.py
  modified:
    - backend/main.py

key-decisions:
  - "extract_ifvg_zones() replicates compute_ifvg loop to return top/bottom/startTime/endTime/type geometry — not just state strings"
  - "extract_cisd_level() replicates compute_cisd loop and returns the active level price based on current_state direction"
  - "All timestamps returned as Unix epoch SECONDS (not milliseconds) — lightweight-charts requirement"
  - "Backtest simulation: max 1 open trade at a time; open trades at end of data excluded from stats (pnl=0)"
  - "CORS added via CORSMiddleware before router includes; FRONTEND_URL env var controls allowed origin"
  - "main.py already had /health endpoint before this plan — kept without duplication"

patterns-established:
  - "Strategy geometry extraction: create dedicated helpers that replicate the core loop from compute_* functions to extract internal state (fvg_array zones, cisd levels) as structured data for API responses"
  - "Backtest sim pattern: iterate bars, check open trade exit first, then check for new entry only if no open trade"

requirements-completed: [CHART-01, CHART-02, CHART-03, CHART-04, CHART-05, BT-01, BT-02, BT-03, BT-04, DEPLOY-02]

duration: 3min
completed: 2026-03-21
---

# Phase 03 Plan 01: Backend API Endpoints Summary

**Chart endpoint extracts IFVG zone geometry and CISD level prices by replicating strategy internals; backtest endpoint fetches yfinance 1m bars and simulates trades bar-by-bar with stop/target outcomes and equity curve.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T00:03:24Z
- **Completed:** 2026-03-21T00:06:30Z
- **Tasks:** 2 of 2
- **Files modified:** 5

## Accomplishments

- Created `GET /chart/bars/{symbol}` returning OHLCV bars, EMA values, IFVG zone geometry (top/bottom/startTime/endTime/type), CISD level price, and Long/Short entry markers — all computed from the existing strategy engine functions
- Created `POST /backtest/run` that fetches 1-minute yfinance data (7-day limit enforced), runs IFVG+CISD+EMA bar-by-bar, simulates stop/target trade outcomes with equity curve and win_rate/avg_r_multiple stats
- Added CORS middleware with `FRONTEND_URL` env var, and wired both new routers into main.py alongside existing `/health` endpoint

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Chart data endpoint with IFVG zones, CISD level, EMA, and entry markers | ad36487 | backend/charts/__init__.py, backend/charts/router.py |
| 2 | Backtest endpoint + health check + CORS + main.py wiring | 3cf4596 | backend/backtest/__init__.py, backend/backtest/router.py, backend/main.py |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed inverted NaN check logic in extract_cisd_level and extract_entry_markers**
- **Found during:** Task 1 implementation review
- **Issue:** Initial draft had `math.isnan(level) if not math.isnan(level) else True` which is self-contradictory (always evaluates the false branch)
- **Fix:** Simplified to `math.isnan(level)` and `try: math.isnan(float(ema_val))` with proper except for type errors
- **Files modified:** backend/charts/router.py
- **Commit:** ad36487 (included in task commit)

**2. [Rule 1 - Bug] main.py already had /health endpoint from Phase 2 planning**
- **Found during:** Task 2 — read main.py before modifying
- **Issue:** Plan said to add /health but it was already present (added during Phase 03 planning)
- **Fix:** Kept existing /health endpoint without duplication; documented in task commit message
- **Files modified:** backend/main.py
- **Commit:** 3cf4596

## Known Stubs

None. All endpoints return computed data from real strategy functions and yfinance API.

## Self-Check

**Files exist:**
- backend/charts/__init__.py: exists
- backend/charts/router.py: exists
- backend/backtest/__init__.py: exists
- backend/backtest/router.py: exists
- backend/main.py: modified (CORS + new router imports)

**Commits exist:**
- ad36487: feat(03-01): chart data endpoint
- 3cf4596: feat(03-01): backtest endpoint + CORS + wiring

**Routes verified:**
- /health: registered
- /chart/bars/{symbol}: registered
- /backtest/run: registered

## Self-Check: PASSED
