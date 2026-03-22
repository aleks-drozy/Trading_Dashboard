---
phase: 02-trade-data-layer-crud-api
plan: "04"
subsystem: api
tags: [trades, crud, api, mongoose, nextjs]
dependency_graph:
  requires: ["02-01", "02-02"]
  provides: ["single-trade-get", "single-trade-put", "single-trade-delete"]
  affects: []
tech_stack:
  added: []
  patterns: ["Next.js 15+ async params", "findOne+set+save for pre-save hook", "userId ownership scoping"]
key_files:
  created:
    - app/api/trades/[id]/route.ts
  modified: []
key_decisions:
  - "Used findOne + set + save (not findOneAndUpdate) to ensure pre-save hook fires for P&L recalculation"
  - "DELETE returns 204 with no body via new NextResponse(null, { status: 204 })"
  - "GET uses .lean() for performance (plain object, not Mongoose document)"
metrics:
  duration: "2min"
  completed_date: "2026-03-22"
  tasks: 2
  files: 1
requirements:
  - TRADE-08
  - TRADE-09
---

# Phase 02 Plan 04: Single Trade CRUD Endpoints Summary

**One-liner:** GET/PUT/DELETE route handlers for /api/trades/[id] with userId ownership scoping and pre-save hook-based P&L recalculation on update.

## What Was Built

Single-trade route handlers at `app/api/trades/[id]/route.ts` completing the trade CRUD surface:

- **GET /api/trades/[id]** — Returns `{ data: trade }` for trades owned by the authenticated user (`.lean()` for performance)
- **DELETE /api/trades/[id]** — Removes owned trade, returns 204 No Content with no body
- **PUT /api/trades/[id]** — Validates partial updates with `tradeUpdateSchema`, uses `findOne + set + save` pattern to fire the Mongoose pre-save hook which recalculates P&L, pnlPercent, and riskRewardRatio

All handlers:
- Validate ObjectId via `isValidObjectId(id)` — return 400 for invalid IDs
- Scope queries to `{ _id: id, userId }` — enforces ownership, returns 404 for missing or unowned trades
- Use Next.js 15+ async params pattern: `{ params }: { params: Promise<{ id: string }> }` with `await params`

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | GET and DELETE handlers | 8ac6429 | app/api/trades/[id]/route.ts |
| 2 | PUT handler with P&L recalculation | 8074027 | app/api/trades/[id]/route.ts |

## Verification

- `npx tsc --noEmit` passes with no errors
- `npm test` — 26/26 tests pass (3 test files)
- File exports GET, PUT, DELETE
- PUT uses `.findOne()` + `.set()` + `.save()` pattern (NOT findOneAndUpdate)
- All handlers scope queries to userId

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- app/api/trades/[id]/route.ts: FOUND
- Commit 8ac6429: verified via git log
- Commit 8074027: verified via git log
