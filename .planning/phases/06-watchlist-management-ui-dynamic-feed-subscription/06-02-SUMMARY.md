---
phase: 06-watchlist-management-ui-dynamic-feed-subscription
plan: 02
subsystem: frontend
tags: [watchlist, sidebar, optimistic-ui, react, typescript]
dependency_graph:
  requires: [06-01]
  provides: [watchlist-sidebar-ui, watchlist-api-helpers]
  affects: [frontend/src/pages/DashboardPage.tsx]
tech_stack:
  added: []
  patterns: [optimistic-ui, fetch-with-auth, sonner-toast, sticky-sidebar]
key_files:
  created:
    - frontend/src/components/WatchlistSidebar.tsx
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/pages/DashboardPage.tsx
decisions:
  - WatchlistSidebar is a 240px sticky panel — matches UI-SPEC contract exactly, no elevation (same background as page)
  - signalSymbols derived from WebSocket signals in DashboardPage — passed as prop for awaiting-data detection without lifting state
  - Optimistic add then rollback on failure — keeps UI snappy; server errors shown inline, not toast
  - Remove failure uses toast (not inline) and reloads from server — consistent with UI-SPEC interaction contract
metrics:
  duration: 3min
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_modified: 3
---

# Phase 6 Plan 02: WatchlistSidebar Component Summary

**One-liner:** 240px sticky WatchlistSidebar with optimistic add/remove, client-side validation, inline errors, and awaiting-data detection via WebSocket signals.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add API helpers and build WatchlistSidebar component | c8e6daf | frontend/src/lib/api.ts, frontend/src/components/WatchlistSidebar.tsx |
| 2 | Integrate WatchlistSidebar into DashboardPage layout | aaa85da | frontend/src/pages/DashboardPage.tsx |

## What Was Built

### api.ts additions
- `WatchlistItem` interface (`symbol`, `asset_type`)
- `fetchWatchlist()` — GET /watchlist with auth
- `addWatchlistSymbol(symbol, assetType)` — POST /watchlist, throws with server `detail` message on failure
- `removeWatchlistSymbol(symbol)` — DELETE /watchlist/{symbol}, throws on failure

### WatchlistSidebar component
- 240px fixed-width sticky sidebar, positioned below 56px header, right border `#2D3148`
- Loading state on mount (fetches GET /watchlist), empty state when list is empty
- Add flow: uppercase-on-keystroke input, Enter or "+" button triggers add; client-side validation (empty no-op, duplicate → "Already in watchlist", bad format → "Invalid ticker format"); optimistic append then rollback on API failure; error shown inline with `role="alert"`
- Remove flow: optimistic remove, sonner toast + server reload on failure
- "awaiting data" inline label for symbols not yet present in WebSocket signal broadcast
- Full accessibility: `aria-label="Symbol ticker"` on input, `aria-label="Add symbol"` on add button, `aria-label="Remove {SYMBOL}"` on each remove button
- Focus returns to input after successful add

### DashboardPage layout change
- Added `import { WatchlistSidebar }`
- Derived `signalSymbols = signals.map(s => s.symbol)` from existing WebSocket hook
- Wrapped `<main>` in `<div className="flex">` with `<WatchlistSidebar signalSymbols={signalSymbols} />` as left panel
- `<main>` gets `flex-1` to fill remaining space; all existing content (SignalTable, PortfolioCard, TradesTable) unchanged

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data is wired to live API calls and WebSocket state.

## Self-Check: PASSED

Files created/modified exist:
- frontend/src/components/WatchlistSidebar.tsx: FOUND
- frontend/src/lib/api.ts: FOUND (modified)
- frontend/src/pages/DashboardPage.tsx: FOUND (modified)

Commits exist:
- c8e6daf: FOUND
- aaa85da: FOUND

TypeScript compilation: PASSED (no errors)
Vite production build: PASSED (built in 50.97s)
