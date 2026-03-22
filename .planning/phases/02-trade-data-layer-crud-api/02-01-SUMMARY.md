---
phase: 02-trade-data-layer-crud-api
plan: 01
subsystem: database
tags: [mongoose, mongodb, typescript, calculations, pnl]

# Dependency graph
requires:
  - phase: 01-project-foundation-auth
    provides: lib/models/User.ts pattern, lib/db.ts baseline, mongoose setup
provides:
  - lib/db.ts with global connection cache (no duplicate connections per serverless container)
  - lib/models/Trade.ts with full field spec, pre-save hook, and P&L auto-calculation
  - lib/calculations.ts with calculatePnl, calculatePnlPercent, calculateRiskReward, calculateTradeMetrics
affects: [02-02, 02-03, 02-04, 02-05, 02-06, 02-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Global mongoose cache: global.mongoose on MongooseCache interface prevents duplicate connections in serverless"
    - "Pre-save hook pattern: derive status from exitPrice+exitDate presence, calculate metrics for closed trades"
    - "Direction-aware calculations: long/short branches for P&L and R:R with options 100-share multiplier"

key-files:
  created:
    - lib/calculations.ts
    - lib/models/Trade.ts
  modified:
    - lib/db.ts

key-decisions:
  - "Promise-based pre-save hook (no next() parameter) — Mongoose 8.x types do not expose next as callable"
  - "options calculatePnl uses premium as entryPremium and exitPrice as exitPremium per spec — entryPrice is informational"
  - "riskRewardRatio undefined when stopLoss not provided, and when denominator <= 0 (not an error)"

patterns-established:
  - "Pre-save hook: derive status before calculating metrics so status check is correct"
  - "calculateTradeMetrics wrapper: single call site in pre-save hook, test-friendly"

requirements-completed: [TRADE-01, TRADE-03]

# Metrics
duration: 10min
completed: 2026-03-22
---

# Phase 02 Plan 01: Trade Data Foundation Summary

**Mongoose Trade model with direction-aware P&L/R:R pre-save calculation and serverless-safe global connection cache**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-22T20:35:31Z
- **Completed:** 2026-03-22T20:45:22Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Upgraded `lib/db.ts` with global connection cache — promise reused across serverless invocations, no duplicate connects
- Created `lib/calculations.ts` — four exported functions (calculatePnl, calculatePnlPercent, calculateRiskReward, calculateTradeMetrics) covering stocks/crypto/forex/options with correct 100-share multiplier and direction-aware R:R
- Created `lib/models/Trade.ts` — full 24-field ITrade interface, TradeSchema with userId index, pre-save hook that derives status and auto-calculates P&L metrics for closed trades

## Task Commits

Each task was committed atomically:

1. **Task 1: Upgrade db.ts and create calculations.ts** - `1544a0c` (feat)
2. **Task 2: Create Trade Mongoose model with pre-save hook** - `014cbcf` (feat)

**Plan metadata:** (final commit hash recorded after state update)

## Files Created/Modified

- `lib/db.ts` - MongoDB connection singleton with global cache (MongooseCache interface, global.mongoose)
- `lib/calculations.ts` - P&L, pnlPercent, and R:R calculation functions with TradeMetrics and TradeForCalculation interfaces
- `lib/models/Trade.ts` - Mongoose Trade model, ITrade interface, pre-save hook calling calculateTradeMetrics

## Decisions Made

- Promise-based pre-save hook (no `next()` parameter) — Mongoose 8.x declares `next` as `SaveOptions` type (not callable); async/promise pattern is the correct approach
- Options P&L uses `premium` as entry cost and `exitPrice` field as exit premium — per spec, `entryPrice` for options is the underlying price (informational), not the contract cost
- `riskRewardRatio` returns `undefined` (not an error/throw) when denominator <= 0 — valid state when stop loss is on wrong side of entry

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed next() call from pre-save hook**
- **Found during:** Task 2 (Trade model verification)
- **Issue:** TypeScript error TS2349 — Mongoose 8.x types declare the `next` parameter of `.pre("save")` as `SaveOptions` (no call signatures), making `next()` a type error
- **Fix:** Switched to promise-based pre hook signature `function()` with no `next` parameter — Mongoose resolves the hook when the function returns/resolves
- **Files modified:** lib/models/Trade.ts
- **Verification:** `npx tsc --noEmit` passes with no errors; 26 tests pass
- **Committed in:** 014cbcf (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — type-safe hook signature)
**Impact on plan:** Fix required for TypeScript compilation. Runtime behavior unchanged.

## Issues Encountered

- Pre-existing TypeScript error in `__tests__/schemas/trade.test.ts` (Zod $ZodIssue path type mismatch) confirmed pre-existing from prior commit `test(02-02)` — out of scope for this plan, not introduced by these changes

## Next Phase Readiness

- All three foundation modules ready: db.ts, calculations.ts, Trade.ts
- Plans 02-02 through 02-07 can all import from these modules
- 26 existing tests pass; calculations.ts test suite (14 tests) fully validates P&L and R:R formulas

---
*Phase: 02-trade-data-layer-crud-api*
*Completed: 2026-03-22*
