---
phase: 02-trade-data-layer-crud-api
plan: "03"
subsystem: api
tags: [nextjs, api-routes, mongodb, mongoose, zod, pagination, filtering, sorting]

requires:
  - phase: 02-trade-data-layer-crud-api
    plan: "01"
    provides: Trade Mongoose model with pre-save hook for P&L calculation
  - phase: 02-trade-data-layer-crud-api
    plan: "02"
    provides: tradeCreateSchema Zod validator

provides:
  - POST /api/trades — create trade with Zod validation, userId scoping, pre-save hook for status/P&L
  - GET /api/trades — paginated, filtered, sorted trade list with { data, pagination } response envelope
affects: [03-trade-log-ui, phase-3-ui]

tech-stack:
  added: []
  patterns:
    - "new Trade() + .save() (not Trade.create()) to ensure Mongoose pre-save hook fires"
    - "Sort field whitelist to prevent arbitrary field injection via query params"
    - "filter: Record<string, unknown> with userId always present — user scoping at query level"
    - ".lean() for performance on GET list queries"

key-files:
  created:
    - app/api/trades/route.ts
  modified: []

key-decisions:
  - "Use new Trade() + .save() instead of Trade.create() to trigger pre-save hook for status derivation and P&L calculation"
  - "Sort field whitelist (entryDate, pnl, symbol) prevents arbitrary MongoDB field injection via sortBy param"
  - "Tags filter uses comma-separated string split into $in array — avoids complex array query param encoding"

requirements-completed: [TRADE-01, TRADE-08]

duration: 4min
completed: 2026-03-22
---

# Phase 2 Plan 03: Trade List and Create API Endpoints Summary

**POST/GET /api/trades with Zod validation, userId-scoped queries, pre-save hook integration, and paginated/filtered/sorted trade list returning { data, pagination } per D-01/D-02**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-22T20:48:35Z
- **Completed:** 2026-03-22T20:52:35Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- POST /api/trades: validates body with tradeCreateSchema (Zod), extracts userId from session (guaranteed by proxy.ts), creates trade via new Trade().save() to fire pre-save hook deriving status and calculating P&L for closed trades. Returns { data: trade } with 201.
- GET /api/trades: supports page/limit pagination (default 20, max 100), sortBy/sortDir (whitelist: entryDate, pnl, symbol; default entryDate desc), and optional filters for assetClass, direction, status, strategy, tags (comma-separated $in), and date range (from/to as $gte/$lte on entryDate). Returns { data: trades[], pagination: { page, totalPages, total } } per D-02.
- TypeScript compiles cleanly (npx tsc --noEmit passes with zero errors)
- All 26 existing tests still pass

## Task Commits

Each task was committed atomically:

1. **Tasks 1 & 2: POST handler + GET handler for /api/trades** - `9229f90` (feat)

Both handlers were implemented in a single file write as they share imports and the file was created new.

## Files Created/Modified

- `app/api/trades/route.ts` - POST create trade and GET list trades route handlers with full filtering, sorting, and pagination

## Decisions Made

- Used `new Trade({ ...parsed.data, userId })` + `.save()` instead of `Trade.create()` to ensure the pre-save hook fires for status derivation and P&L/R:R calculation on closed trades
- Whitelist `["entryDate", "pnl", "symbol"]` for sortBy prevents arbitrary MongoDB field injection via query parameter
- Tags filter accepts comma-separated string (e.g. `?tags=breakout,momentum`) split into `$in` array — simpler than repeated params

## Deviations from Plan

None — plan executed exactly as written. TypeScript compiled cleanly on first attempt with no type errors.

## Known Stubs

None — both handlers are fully wired to the Trade model and return real data.

## Self-Check: PASSED

- app/api/trades/route.ts exists at C:\Users\aleks\projects\trade-journal\app\api\trades\route.ts
- Commit 9229f90 exists in git log
- npx tsc --noEmit passes with zero errors
- npm test: 26/26 tests pass

---
*Phase: 02-trade-data-layer-crud-api*
*Completed: 2026-03-22*
