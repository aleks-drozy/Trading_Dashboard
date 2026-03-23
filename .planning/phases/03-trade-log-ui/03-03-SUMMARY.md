---
phase: 03-trade-log-ui
plan: 03
subsystem: ui
tags: [react, nextjs, zod, tailwind, form, validation, upload]

# Dependency graph
requires:
  - phase: 03-01
    provides: UI components (Input, Select, Textarea, Button, Card, Toast), dashboard layout
  - phase: 02-trade-data-layer-crud-api
    provides: Trade model, calculations.ts, Zod schemas, /api/trades and /api/upload endpoints
provides:
  - Unified TradeForm component (create/edit modes) with all fields and live P&L preview
  - PnlPreviewBar sticky bottom bar showing P&L, P&L%, R:R in green/red
  - /trades/new page (add trade form)
  - /trades/[id]/edit page (pre-populated edit form)
affects: [04-dashboard-analytics, trade-log-list-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "All number fields stored as strings in form state — parseFloat on submit (avoids controlled input NaN)"
    - "useMemo for live P&L preview — no useEffect, no subscriptions"
    - "Date inputs stored as YYYY-MM-DD strings, converted to ISO on submit"
    - "Options fields cleared when assetClass changes away from options"
    - "await params in Next.js 16 server components (Promise-based params)"

key-files:
  created:
    - components/trades/PnlPreviewBar.tsx
    - components/trades/TradeForm.tsx
    - app/(dashboard)/trades/new/page.tsx
    - app/(dashboard)/trades/[id]/edit/page.tsx
  modified: []

key-decisions:
  - "PnlPreviewBar is a pure presentational component (no use client) — rendered inside TradeForm which is already a client component"
  - "Live P&L preview uses useMemo with string parse guards — returns null if any required value is missing or NaN"
  - "Image upload failure is non-blocking — trade saves without chart, toast shown to user"
  - "Edit page serializes all Dates to ISO strings before passing to client component"

patterns-established:
  - "Form state: all fields as strings, parseFloat/toISO on submit"
  - "Zod safeParse error mapping: result.error.issues.forEach → fieldErrors Record"
  - "Conditional section: assetClass === 'options' gate for options fields card"

requirements-completed: [TRADE-10]

# Metrics
duration: 3min
completed: 2026-03-23
---

# Phase 3 Plan 03: Trade Form Summary

**Unified add/edit trade form with live P&L preview bar (useMemo), Zod field validation, conditional options fields, image upload with thumbnail, and tag chip UI**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T11:18:53Z
- **Completed:** 2026-03-23T11:21:51Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- TradeForm (310 lines) handles all 4 form sections, Zod validation, image upload, tags, and P&L preview
- PnlPreviewBar sticky bottom bar updates live on every keystroke via useMemo — no useEffect needed
- /trades/new page and /trades/[id]/edit page wired up with correct auth, serialization, and 404 handling

## Task Commits

1. **Task 1: PnlPreviewBar and TradeForm components** - `537a9ab` (feat)
2. **Task 2: Add and edit trade page routes** - `3b2a609` (feat)

## Files Created/Modified
- `components/trades/PnlPreviewBar.tsx` - Sticky bottom bar with green/red P&L, P&L%, and optional R:R display
- `components/trades/TradeForm.tsx` - Unified create/edit form with live preview, validation, image upload, tags
- `app/(dashboard)/trades/new/page.tsx` - Empty form page at /trades/new ("Log a Trade")
- `app/(dashboard)/trades/[id]/edit/page.tsx` - Server component fetching trade, pre-populating form ("Edit Trade")

## Decisions Made
- PnlPreviewBar has no "use client" directive — it is a presentational child of TradeForm which is already a client component; no extra boundary needed
- Live preview uses useMemo with NaN guards instead of useEffect to avoid stale closure issues
- Image upload failure is non-blocking: toast shown, trade saved without chart URL

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- /trades/new and /trades/[id]/edit are fully functional
- TradeForm is ready for integration with the trade log list page (plan 03-04 or similar)
- PnlPreviewBar can be reused in analytics views

---
*Phase: 03-trade-log-ui*
*Completed: 2026-03-23*

## Self-Check: PASSED
- components/trades/PnlPreviewBar.tsx: FOUND
- components/trades/TradeForm.tsx: FOUND
- app/(dashboard)/trades/new/page.tsx: FOUND
- app/(dashboard)/trades/[id]/edit/page.tsx: FOUND
- Commit 537a9ab: FOUND
- Commit 3b2a609: FOUND
