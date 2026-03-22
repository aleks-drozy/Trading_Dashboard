---
phase: 02-trade-data-layer-crud-api
plan: "02"
subsystem: api
tags: [zod, validation, vitest, typescript, testing]

requires:
  - phase: 01-project-foundation-auth
    provides: Zod pattern from schemas/auth.ts used as template for trade schema

provides:
  - Zod tradeCreateSchema with D-12 (exitPrice/exitDate both-or-neither) and D-13 (options fields required) cross-field validation
  - Zod tradeUpdateSchema as partial with same refinements
  - TradeCreateInput and TradeUpdateInput TypeScript types
  - Wave 0 test scaffolds for calculations, schemas, and upload validation
affects: [02-03-trade-model, 02-04-trade-crud-api, 02-05-calculations, testing]

tech-stack:
  added: []
  patterns:
    - "superRefine for multi-field cross-validation in Zod v4 (returns ZodObject not ZodEffects)"
    - "Separate base object + .partial().superRefine() pattern for update schemas in Zod v4"
    - "Wave 0 test scaffolds with real assertions — tests pass before implementation in later plans"

key-files:
  created:
    - schemas/trade.ts
    - __tests__/lib/calculations.test.ts
    - __tests__/schemas/trade.test.ts
    - __tests__/api/upload.test.ts
  modified: []

key-decisions:
  - "Zod v4 superRefine on ZodObject returns ZodObject (not ZodEffects) — .innerType() not needed; .partial().superRefine() works directly on base object"
  - "Separate refinement functions for create vs update — update rules only apply when fields are present in payload"
  - "Zod v4 issue paths use PropertyKey[] (not string[] | number[]) — type annotation removed from map callback in test"

patterns-established:
  - "D-12: exitPrice and exitDate both-or-neither enforced via superRefine"
  - "D-13: options fields (strikePrice, expirationDate, contractType, premium) required when assetClass=options"

requirements-completed: [TRADE-02, TRADE-04, TRADE-05, TRADE-06]

duration: 9min
completed: 2026-03-22
---

# Phase 2 Plan 02: Trade Schemas and Wave 0 Test Scaffolds Summary

**Zod tradeCreateSchema/tradeUpdateSchema with D-12 exit-field pairing and D-13 options-field requirements, plus Wave 0 vitest scaffolds covering calculations (14 assertions), schema validation (10 assertions), and upload constants (2 assertions)**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-22T20:35:37Z
- **Completed:** 2026-03-22T20:45:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- tradeCreateSchema validates all required fields, enforces D-12 (exitPrice/exitDate both-or-neither), D-13 (options fields required when assetClass=options), and provides strategy/tags/notes defaults
- tradeUpdateSchema allows partial updates with same cross-field rules applied when relevant fields are present
- Three Wave 0 test files scaffolded — calculations.test.ts (14 tests), schemas/trade.test.ts (10 tests), api/upload.test.ts (2 tests) — all 26 pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Zod trade schemas with conditional validation** - `5dbc0ff` (feat)
2. **Task 2: Scaffold Wave 0 test files** - `6892ade` (test)

**Deviation fix:** `c38e218` (fix: Zod v4 path type in trade schema test)

## Files Created/Modified

- `schemas/trade.ts` - Zod create and update schemas with superRefine cross-field rules, TradeCreateInput and TradeUpdateInput types
- `__tests__/lib/calculations.test.ts` - 14 assertions for calculatePnl (stocks + options), calculatePnlPercent, calculateRiskReward, calculateTradeMetrics
- `__tests__/schemas/trade.test.ts` - 10 assertions covering D-12 (exit field pairing), D-13 (options fields), and defaults for strategy/tags
- `__tests__/api/upload.test.ts` - 2 placeholder assertions for 5MB limit constant and MIME type list

## Decisions Made

- Zod v4 superRefine on ZodObject returns ZodObject, not ZodEffects — .innerType() does not exist; used separate base object with .partial().superRefine() for update schema instead
- Created two refinement functions (applyCreateRefinements, applyUpdateRefinements) to handle different partial logic without code duplication
- Zod v4 issue paths use PropertyKey[] including symbol — removed explicit type annotation in test map callback to let TypeScript infer correctly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Zod v4 incompatibility with .innerType() pattern**
- **Found during:** Task 1 (Create Zod trade schemas)
- **Issue:** Plan specified `tradeCreateSchema.innerType().partial()` but Zod v4 superRefine returns ZodObject (not ZodEffects), so .innerType() does not exist
- **Fix:** Defined separate `tradeBaseObject` without superRefine, called `.partial().superRefine()` on it for the update schema
- **Files modified:** schemas/trade.ts
- **Verification:** `npx tsc --noEmit` passes, schema tests pass
- **Committed in:** 5dbc0ff (Task 1 commit)

**2. [Rule 1 - Bug] Fixed Zod v4 PropertyKey path type in test**
- **Found during:** Verification after Task 2
- **Issue:** `tsc --noEmit` error: Zod v4 uses `PropertyKey[]` for issue paths (includes symbol), incompatible with explicit `(string | number)[]` annotation in test map callback
- **Fix:** Removed explicit type annotation to let TypeScript infer correctly
- **Files modified:** __tests__/schemas/trade.test.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** c38e218

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs — Zod v4 API differences from plan's Zod 3.x assumptions)
**Impact on plan:** Both fixes adapt plan's Zod 3.x API calls to Zod v4 equivalents. Schema behavior is identical; no scope changes.

## Issues Encountered

- Zod v4 changed the superRefine return type and issue path type compared to v3 — both resolved via auto-fix Rule 1

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- tradeCreateSchema and tradeUpdateSchema ready for use in trade API routes (Plan 03+)
- Wave 0 test scaffolds in place — vitest now discovers and runs all three test files
- lib/calculations.ts already exists and passes the 14 calculation tests
- TSC passes clean with zero errors

---
*Phase: 02-trade-data-layer-crud-api*
*Completed: 2026-03-22*
