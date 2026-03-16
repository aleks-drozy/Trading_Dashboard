---
phase: 01-foundation-strategy-engine
plan: "04"
subsystem: testing
tags: [pinescript, tradingview, fixtures, strategy-validation, csv]

# Dependency graph
requires: []
provides:
  - "PineScript source FYP_BOT_1_3.pine committed as read-only strategy specification"
  - "tests/fixtures/spy_1min_tv_reference.csv placeholder with correct column headers"
  - "tests/fixtures/btcusdt_1min_tv_reference.csv placeholder with correct column headers"
affects:
  - "01-05 — strategy engine tests depend on Pine source and CSV fixtures"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pine source treated as read-only specification — never modified or reformatted"
    - "TradingView CSV fixtures in tests/fixtures/ serve as bar-by-bar test oracle"
    - "Fixture CSV column schema: timestamp,open,high,low,close,volume,ifvg_state,cisd_state,ema_20"

key-files:
  created:
    - docs/reference/FYP_BOT_1_3.pine
    - tests/fixtures/spy_1min_tv_reference.csv
    - tests/fixtures/btcusdt_1min_tv_reference.csv
  modified: []

key-decisions:
  - "FYP_BOT_1_3.pine copied from user's Downloads/Code/ directory — found at known path without prompting"
  - "Pine source committed as-is, no reformatting or modification"
  - "Placeholder CSV fixtures accepted — user will replace with real TradingView exports before bar-by-bar validation tests run; visual spot check deferred"
  - "Fixture column schema locked: timestamp,open,high,low,close,volume,ifvg_state,cisd_state,ema_20"

patterns-established:
  - "Pine source as specification: docs/reference/FYP_BOT_1_3.pine is the authoritative strategy spec"
  - "Fixture CSVs loaded via pd.read_csv in strategy test suite from tests/fixtures/"

requirements-completed: [DATA-01, DATA-02]

# Metrics
duration: 5min
completed: 2026-03-16
---

# Phase 1 Plan 04: Reference Artifacts Summary

**FYP_BOT_1_3.pine (542-line PineScript v6 strategy) committed as read-only spec; placeholder fixture CSVs with locked column headers committed — awaiting real TradingView export before bar-by-bar validation**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-16T21:18:51Z
- **Completed:** 2026-03-16T21:23:00Z
- **Tasks:** 2 of 2
- **Files modified:** 3

## Accomplishments

- Located FYP_BOT_1_3.pine at `/c/Users/aleks/Downloads/Code/FYP_BOT_1_3.pine` and committed it to `docs/reference/` as read-only strategy specification (542 lines, PineScript v6)
- Created `tests/fixtures/` directory with placeholder CSVs for SPY and BTCUSDT 1-minute reference data
- Locked fixture column schema: timestamp,open,high,low,close,volume,ifvg_state,cisd_state,ema_20 — strategy engine and test suite can be built against this schema immediately

## Task Commits

Each task was committed atomically:

1. **Task 1: Commit PineScript source to docs/reference/** - `b24416f` (docs)
2. **Task 2: Export TradingView reference CSV fixtures (placeholder)** - `91a79df` (chore)

## Files Created/Modified

- `docs/reference/FYP_BOT_1_3.pine` - PineScript v6 strategy source (542 lines), read-only specification for IFVG/CISD/EMA logic
- `tests/fixtures/spy_1min_tv_reference.csv` - Placeholder with correct headers; comment block documents real export requirements
- `tests/fixtures/btcusdt_1min_tv_reference.csv` - Placeholder with correct headers; comment block documents real export requirements

## Decisions Made

- Pine file located automatically at `/c/Users/aleks/Downloads/Code/FYP_BOT_1_3.pine` — no user prompt needed
- File copied verbatim, not reformatted
- Placeholder CSVs used for Task 2: user will do visual spot check and replace with real TradingView exports after the strategy engine is built. The fixture loader has valid importable files with the correct schema from the start.

## Deviations from Plan

Task 2 was a `checkpoint:human-action` requiring the user to manually export TradingView CSVs. The user directed: skip CSV validation for now, create placeholder files with correct headers, mark complete. This is a deliberate user-directed scope deferral.

**Total deviations:** 1 scope deferral (user decision)
**Impact:** Strategy engine (Plan 05) can be built and tested structurally. Bar-by-bar value validation is deferred until real fixture data is provided. No correctness risk at this stage.

## Issues Encountered

None.

## User Setup Required

**Before running strategy bar-by-bar validation tests:** Replace placeholder fixtures with real TradingView exports.

Steps:
1. Load FYP_BOT_1_3 on TradingView SPY 1-min chart; export Data Window values covering 2+ weeks with 100 warmup bars
2. Save to `tests/fixtures/spy_1min_tv_reference.csv`
3. Repeat for BTCUSDT 1-min — save to `tests/fixtures/btcusdt_1min_tv_reference.csv`
4. Both files need 500+ rows with columns: timestamp,open,high,low,close,volume,ifvg_state,cisd_state,ema_20
5. Verify: `python -c "import pandas as pd; df=pd.read_csv('tests/fixtures/spy_1min_tv_reference.csv'); assert len(df)>500"`

## Next Phase Readiness

- Plan 05 (strategy engine) can start: Pine spec and fixture column schema are both locked
- Bar-by-bar value validation tests will be skipped/deferred until real CSV fixtures are provided
- No blockers for beginning strategy engine implementation

## Self-Check: PASSED

- `docs/reference/FYP_BOT_1_3.pine` — exists (committed b24416f)
- `tests/fixtures/spy_1min_tv_reference.csv` — exists (committed 91a79df)
- `tests/fixtures/btcusdt_1min_tv_reference.csv` — exists (committed 91a79df)

---
*Phase: 01-foundation-strategy-engine*
*Completed: 2026-03-16*
