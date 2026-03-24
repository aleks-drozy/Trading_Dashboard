---
phase: 06-watchlist-management-ui-dynamic-feed-subscription
verified: 2026-03-21T22:00:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 6: Watchlist Management UI and Dynamic Feed Subscription — Verification Report

**Phase Goal:** Watchlist management UI and dynamic feed subscription — traders can add/remove symbols from the dashboard sidebar; the AlpacaFeed dynamically restarts with the updated symbol list within 30 seconds without a backend restart.
**Verified:** 2026-03-21T22:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                         | Status     | Evidence                                                                                          |
|----|-----------------------------------------------------------------------------------------------|------------|---------------------------------------------------------------------------------------------------|
| 1  | AlpacaFeed restarts within 30 seconds of a watchlist change                                   | VERIFIED   | `asyncio.wait(FIRST_COMPLETED)` races stream vs `_wait_for_restart`; no sleep delay on restart path; `feed_restart_event.set()` called in router immediately after DB mutation |
| 2  | Newly added stock symbols get backfilled before the new stream starts                         | VERIFIED   | `alpaca_feed.py:121` — `await backfill_bars(...)` called for `added` set before `self.symbols = fresh_symbols` assignment |
| 3  | Removed symbols have their bars cleared from BarStore                                         | VERIFIED   | `alpaca_feed.py:118` — `self._bar_store.remove(sym)` for each removed symbol; also called immediately in router at `router.py:63` |
| 4  | Watchlist router handlers are `async def` so `asyncio.Event.set()` works in the event loop   | VERIFIED   | `router.py:23,32,51` — all three handlers (`list_watchlist`, `add_to_watchlist`, `remove_from_watchlist`) are `async def` |
| 5  | User can add a stock symbol from the sidebar and it appears immediately                       | VERIFIED   | `WatchlistSidebar.tsx:42` — optimistic append before `await addWatchlistSymbol()`; rollback on failure |
| 6  | User can remove a symbol from the sidebar and it disappears immediately                       | VERIFIED   | `WatchlistSidebar.tsx:54` — optimistic filter before `await removeWatchlistSymbol()`; reload + toast on failure |
| 7  | Adding a duplicate or invalid symbol shows an inline error below the input                    | VERIFIED   | `WatchlistSidebar.tsx:32-38` — "Already in watchlist" and "Invalid ticker format" set to `addError`; rendered with `role="alert"` at line 109 |
| 8  | Removing a symbol that fails server-side shows a sonner toast and restores the list           | VERIFIED   | `WatchlistSidebar.tsx:58-59` — `fetchWatchlist().then(setItems)` + `toast.error(...)` in catch block |
| 9  | Sidebar is a fixed 240px left panel that does not overlay main content                        | VERIFIED   | `WatchlistSidebar.tsx:67` — `width: 240` with `position: sticky`; `DashboardPage.tsx:48-50` — `<div className="flex">` wrapping sidebar + `<main className="flex-1 ...">` |

**Score:** 9/9 truths verified

---

## Required Artifacts

### Plan 01 Artifacts (ASSET-06 — backend dynamic feed)

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `backend/data/bar_store.py` | `BarStore.remove(symbol)` method | VERIFIED | Lines 35-38: thread-safe `dict.pop` under `_lock` |
| `backend/data/alpaca_feed.py` | Module-level `feed_restart_event`, `AlpacaFeed` with `get_symbols` callable and restart event race | VERIFIED | Line 22: `feed_restart_event = asyncio.Event()`; lines 46-47: `get_symbols` and `restart_event` params; lines 144-147: `asyncio.wait(FIRST_COMPLETED)` |
| `backend/watchlist/router.py` | Async route handlers that trigger `feed_restart_event` on stock symbol changes | VERIFIED | All three handlers are `async def`; line 46: `feed_restart_event.set()` guarded by `asset_type == "stock"`; line 64: unconditional on delete |
| `backend/main.py` | Lifespan wires `get_symbols` callable and `feed_restart_event` into `AlpacaFeed` | VERIFIED | Line 13: `feed_restart_event` in import; lines 67-68: `get_symbols=get_stock_symbols, restart_event=feed_restart_event`; `symbols=stock_symbols` absent from constructor |

### Plan 02 Artifacts (ASSET-04, ASSET-05 — frontend UI)

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `frontend/src/lib/api.ts` | `addWatchlistSymbol` and `removeWatchlistSymbol` helpers | VERIFIED | Lines 64-93: `WatchlistItem` interface, `fetchWatchlist`, `addWatchlistSymbol`, `removeWatchlistSymbol` all exported |
| `frontend/src/components/WatchlistSidebar.tsx` | Full sidebar component with optimistic add/remove, inline errors, loading state | VERIFIED | 157 lines (exceeds 60-line minimum); contains all required UI patterns |
| `frontend/src/pages/DashboardPage.tsx` | Flex layout with `WatchlistSidebar` as left panel | VERIFIED | Lines 48-69: `<div className="flex">` with `<WatchlistSidebar signalSymbols={signalSymbols} />` + `<main className="flex-1 ...">` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `backend/watchlist/router.py` | `backend/data/alpaca_feed.py` | `feed_restart_event.set()` | WIRED | `router.py:11` imports `feed_restart_event`; `router.py:46` (add, stock guard) and `router.py:64` (delete) call `.set()` |
| `backend/data/alpaca_feed.py` | `backend/data/bar_store.py` | `bar_store.remove()` for deleted symbols | WIRED | `alpaca_feed.py:118` calls `self._bar_store.remove(sym)` inside the diff loop for removed symbols |
| `backend/main.py` | `backend/data/alpaca_feed.py` | `get_symbols` callable + `feed_restart_event` passed to constructor | WIRED | `main.py:67-68` — both args present; no static `symbols=` arg passed |
| `frontend/src/components/WatchlistSidebar.tsx` | `frontend/src/lib/api.ts` | `addWatchlistSymbol` and `removeWatchlistSymbol` calls | WIRED | `WatchlistSidebar.tsx:7-10` imports both helpers; called at lines 45 and 56 with real awaits |
| `frontend/src/pages/DashboardPage.tsx` | `frontend/src/components/WatchlistSidebar.tsx` | Import and render in flex layout | WIRED | `DashboardPage.tsx:7` imports; line 49 renders `<WatchlistSidebar signalSymbols={signalSymbols} />` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| ASSET-04 | 06-02-PLAN.md | User can add symbols to the watchlist from the dashboard sidebar UI | SATISFIED | `WatchlistSidebar.tsx` `handleAdd` function with optimistic UI, client-side validation, and `addWatchlistSymbol` API call |
| ASSET-05 | 06-02-PLAN.md | User can remove symbols from the watchlist using the dashboard sidebar UI | SATISFIED | `WatchlistSidebar.tsx` `handleRemove` function with optimistic remove, sonner toast + server reload on failure |
| ASSET-06 | 06-01-PLAN.md | Alpaca feed automatically picks up watchlist changes and streams data for newly added symbols without a backend restart | SATISFIED | `feed_restart_event.set()` in router triggers `asyncio.wait(FIRST_COMPLETED)` race in `AlpacaFeed.run()`; `get_symbols` callable reads DB fresh on each restart; backfill runs for added symbols |

**Orphaned requirements:** None. All three IDs declared in plan frontmatter; all map to Phase 6 in REQUIREMENTS.md traceability table.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| None | — | — | — | — |

No stub patterns found. All state variables (`items`, `addError`, `addValue`) are populated via real API calls or user input. No hardcoded empty arrays flow to rendering without a data-fetch path. `loading` initial state is overwritten by `useEffect` mount fetch. No TODO/FIXME comments detected in modified files.

---

## Human Verification Required

### 1. Visual sidebar layout — does it avoid overlapping content

**Test:** Open the dashboard in a browser at ≥1280px width. Confirm the 240px sidebar is flush left and the main content (signal table, portfolio card, trades) starts to the right with no overlap.
**Expected:** Two-column layout; sidebar occupies left 240px, main content fills remaining width.
**Why human:** CSS sticky + flex rendering requires a live browser to confirm no overflow or z-index collision.

### 2. "Awaiting data" label lifecycle

**Test:** Add a new symbol (e.g. NVDA) via the sidebar input. The "awaiting data" label should appear next to it. After the next WebSocket signal broadcast that includes NVDA, the label should disappear.
**Expected:** Label visible immediately after add; disappears when signal arrives.
**Why human:** Depends on live WebSocket data from the backend — cannot be verified statically.

### 3. Feed restart timing — 30-second SLA

**Test:** Add a new stock symbol via the sidebar. Monitor the backend logs. Confirm a "AlpacaFeed: restart event received, reconnecting with updated symbols" log entry appears within 30 seconds and includes the new symbol in the subscription.
**Expected:** Feed restarts within a few seconds (event fires immediately; 1s teardown sleep is the only delay).
**Why human:** Requires live Alpaca credentials and a running backend.

### 4. Add input focus management after successful add

**Test:** Add a valid symbol. Confirm the input field regains focus immediately after the symbol is appended to the list.
**Expected:** Cursor is back in the input field without clicking.
**Why human:** Focus behavior requires a live browser interaction.

---

## Commits Verified

All four task commits from SUMMARY files confirmed in git history:

| Commit | Message |
|--------|---------|
| `63a2e54` | feat(06-01): add BarStore.remove() and refactor AlpacaFeed for dynamic symbols with restart event |
| `ccf651b` | feat(06-01): wire watchlist router to trigger feed restart and update lifespan |
| `c8e6daf` | feat(06-02): add watchlist API helpers and WatchlistSidebar component |
| `aaa85da` | feat(06-02): integrate WatchlistSidebar into DashboardPage flex layout |

---

## Summary

Phase 6 goal is fully achieved. All nine observable truths are satisfied by substantive, wired implementations — no stubs, placeholders, or disconnected pieces were found.

**Backend (Plan 01 / ASSET-06):** `BarStore.remove()` exists and is used. `feed_restart_event` is a module-level `asyncio.Event` singleton. `AlpacaFeed.run()` races the stream task against the restart event using `asyncio.wait(FIRST_COMPLETED)`, diffs old vs new symbol sets on every restart, backfills additions, and clears bars for removals. All three watchlist router handlers are `async def` and call `feed_restart_event.set()` after mutations. `main.py` passes the `get_stock_symbols` callable and `feed_restart_event` to the AlpacaFeed constructor — no static symbol snapshot at startup.

**Frontend (Plan 02 / ASSET-04, ASSET-05):** `WatchlistSidebar` is a 157-line fully wired component with optimistic add/remove, client-side validation (duplicate check + regex), inline errors with `role="alert"`, loading state, empty state, "awaiting data" label, focus management, and full accessibility (`aria-label` on input, add button, and each remove button). `DashboardPage` wraps sidebar and main content in a flex layout; `signalSymbols` is derived from the existing WebSocket hook and passed as a prop.

Four items are flagged for human verification due to their dependence on live browser rendering, real-time WebSocket data, or live Alpaca credentials — these are normal for a UI + real-time-feed phase and do not block the automated verdict.

---

_Verified: 2026-03-21T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
