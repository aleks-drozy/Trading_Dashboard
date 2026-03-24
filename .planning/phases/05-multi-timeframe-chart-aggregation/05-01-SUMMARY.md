---
phase: 05-multi-timeframe-chart-aggregation
plan: 01
subsystem: api
tags: [pandas, fastapi, resample, ohlcv, timeframe, charts]

# Dependency graph
requires:
  - phase: 04-alpaca-real-time-feed
    provides: backfill_bars + AlpacaFeed populating bar_store with 1m bars

provides:
  - resample_bars() helper in backend/charts/router.py with pandas DataFrame.resample
  - timeframe query param (1|5|15|60) on GET /chart/bars/{symbol}
  - 422 on invalid timeframe, 404 on insufficient resampled bars
  - backfill_bars called with n_bars=500 so 1h timeframe has enough history
  - 8 unit tests covering all resample and endpoint timeframe behaviours

affects:
  - 05-02 (frontend timeframe switcher connects to this endpoint param)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pandas resample OHLCV: df.resample(f'{minutes}min').agg(RESAMPLE_RULES).dropna().iloc[:-1]"
    - "iloc[:-1] guard applied after resample to drop in-progress aggregated bar (established lookahead-prevention convention)"
    - "422 raised in endpoint before bar fetch for invalid query param; 404 raised after resample for insufficient bars"

key-files:
  created:
    - tests/test_resample.py
  modified:
    - backend/charts/router.py
    - backend/main.py

key-decisions:
  - "resample_bars uses df.resample(f'{minutes}min').agg().dropna().iloc[:-1] — dropna removes empty market-gap buckets; iloc[:-1] drops in-progress bar"
  - "timeframe validation in endpoint before bar_store.get() call — invalid timeframe returns 422 immediately without touching BarStore"
  - "pd.to_datetime(b.timestamp, utc=True) used when building DataFrame to ensure timezone-aware DatetimeIndex required by pandas resample"

patterns-established:
  - "resample_bars(df, timeframe) called immediately after df.set_index('timestamp') and before any strategy function"
  - "MIN_BARS_REQUIRED=22 guard (20 EMA warm-up + 2 IFVG window) after resample before strategy computation"

requirements-completed:
  - CHART-07

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 05 Plan 01: Multi-Timeframe Chart Aggregation (Backend) Summary

**On-demand pandas OHLCV resample in charts/router.py with timeframe query param, 422/404 guards, and backfill depth increase to 500 bars for 1h support**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T17:45:23Z
- **Completed:** 2026-03-21T17:47:35Z
- **Tasks:** 1 (TDD: test + implement)
- **Files modified:** 3

## Accomplishments

- Added `resample_bars(df, minutes)` helper to `backend/charts/router.py` using `pandas.DataFrame.resample().agg().dropna().iloc[:-1]`
- Added `timeframe: int = 1` query param to `GET /chart/bars/{symbol}` with 422 for invalid values and 404 for insufficient resampled bars
- Updated `backfill_bars` call in `main.py` to `n_bars=500` ensuring the 1h timeframe has enough 1-minute history
- All 8 TDD tests pass (7 specified + 1 extra for valid timeframe acceptance)

## Task Commits

Each task was committed atomically (TDD):

1. **RED — failing tests** - `0b5b3b5` (test)
2. **GREEN — implementation** - `cda097a` (feat)

## Files Created/Modified

- `tests/test_resample.py` - 8 unit tests: resample identity, 5m OHLCV aggregation, dropna with gaps, invalid timeframe ValueError, endpoint 422, endpoint 5m resampled bars, endpoint 404 insufficient bars, valid timeframes accepted
- `backend/charts/router.py` - Added VALID_TIMEFRAMES, MIN_BARS_REQUIRED, RESAMPLE_RULES, resample_bars() helper; updated get_chart_bars() with timeframe param, validation, and resample+guard
- `backend/main.py` - Added n_bars=500 to backfill_bars call

## Decisions Made

- Used `pd.to_datetime(b.timestamp, utc=True)` when building the DataFrame to produce a timezone-aware DatetimeIndex, which pandas requires when calling `.resample()` on UTC-timestamped Alpaca data
- Timeframe validation guard runs before `bar_store.get()` — invalid timeframes return 422 without touching the BarStore
- The detail message for insufficient bars includes the actual count to aid debugging: "Insufficient bars for 60m timeframe — need 22, got N"

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — all endpoint responses are computed from real BarStore data (no hardcoded values or placeholders).

## User Setup Required

None - no external service configuration required. The n_bars=500 change takes effect automatically on next app startup when Alpaca credentials are configured.

## Next Phase Readiness

- Backend timeframe endpoint complete; Plan 02 (frontend timeframe switcher) can now add `?timeframe=N` to the fetch call and render the pill group
- The endpoint returns 422 for invalid timeframe and 404 for insufficient data — the existing frontend empty state handles both correctly

---
*Phase: 05-multi-timeframe-chart-aggregation*
*Completed: 2026-03-21*
