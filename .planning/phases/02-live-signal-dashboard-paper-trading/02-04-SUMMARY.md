---
phase: 02-live-signal-dashboard-paper-trading
plan: 04
subsystem: ui
tags: [react, typescript, websocket, shadcn, tailwind, lucide-react, sonner]

requires:
  - phase: 02-01
    provides: WebSocket broadcaster at /ws/signals with JWT auth and signal_update messages
  - phase: 02-02
    provides: AuthContext, fetchWithAuth, JWT token storage, login/logout flow
  - phase: 02-03
    provides: /paper/trades and /paper/portfolio REST endpoints with auth

provides:
  - DashboardPage with sticky header, live signal table, portfolio card, and closed trades table
  - useSignalWebSocket hook connecting to /ws/signals with exponential backoff reconnect
  - SignalPill component mapping IFVG/CISD/EMA states to colored pills per UI-SPEC
  - SessionIndicator and WSStatusDot header components
  - DashboardHeader composing session, WS status, and logout
  - SignalTable rendering one row per watchlist symbol
  - PortfolioCard displaying current balance and cumulative P&L
  - TradesTable with direction color, decimal formatting, Win/Loss pills
  - PaperTrade and Portfolio TypeScript interfaces + fetchTrades/fetchPortfolio in api.ts

affects: [phase-03-backtest-charts]

tech-stack:
  added: [sonner@2.0.7, shadcn table, shadcn separator, shadcn sonner]
  patterns:
    - useSignalWebSocket hook owns all WS lifecycle (connect, reconnect, message parse)
    - Components receive data as props — no internal fetching in presentational components
    - Inline style for design tokens (not Tailwind classes) for precise hex control
    - DashboardPage polls REST every 60s via setInterval in useEffect with cleanup

key-files:
  created:
    - frontend/src/hooks/useSignalWebSocket.ts
    - frontend/src/components/SignalPill.tsx
    - frontend/src/components/SessionIndicator.tsx
    - frontend/src/components/WSStatusDot.tsx
    - frontend/src/components/DashboardHeader.tsx
    - frontend/src/components/SignalTable.tsx
    - frontend/src/components/PortfolioCard.tsx
    - frontend/src/components/TradesTable.tsx
    - frontend/src/pages/DashboardPage.tsx
    - frontend/src/components/ui/table.tsx
    - frontend/src/components/ui/separator.tsx
    - frontend/src/components/ui/sonner.tsx
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/App.tsx
    - frontend/src/.gitignore
    - backend/strategy/ema.py

key-decisions:
  - "Sonner imported directly from 'sonner' package in DashboardPage — shadcn sonner.tsx wrapper had circular self-import bug"
  - "frontend/@/ added to .gitignore — shadcn CLI on Windows creates files in wrong path (known issue from Plan 02)"
  - "Toaster/toast from 'sonner' directly in DashboardPage — avoids next-themes dependency from shadcn wrapper"
  - "wasConnectedRef guards disconnect toast — only fires when established connection drops, not on initial connecting state"
  - "pandas ewm(adjust=False) replaces pandas_ta to fix llvmlite version mismatch; recursive EMA formula is mathematically identical"
  - "SignalTable empty state is session-aware: Awaiting market open — signals appear during NY session (9:30-10:30 AM ET)"

patterns-established:
  - "useSignalWebSocket: single hook owns connect/reconnect lifecycle, exposes {signals, nySessionActive, wsStatus}"
  - "SignalPill: state string -> COLOR_MAP lookup -> inline style pill (not Tailwind bg classes for opacity control)"
  - "DashboardPage: fetches REST on mount + 60s interval, shows toast on WS disconnect, passes data down as props"

requirements-completed: [SIG-01, SIG-02, SIG-03, SIG-04, SIG-05, ASSET-03, PAPER-02, PAPER-03]

duration: 35min
completed: 2026-03-20
---

# Phase 02 Plan 04: Live Signal Dashboard Summary

**React dashboard with real-time WebSocket signal table (IFVG/CISD/EMA pills per symbol), portfolio value card, and closed trades table — fully wired to backend /ws/signals and /paper/* REST endpoints**

## Performance

- **Duration:** ~35 min (tasks 1-2 execution + visual verification checkpoint + fixes)
- **Started:** 2026-03-20T21:30:00Z
- **Completed:** 2026-03-20T22:10:00Z
- **Tasks:** 3 of 3 complete (including visual verification checkpoint, approved)
- **Files modified:** 15

## Accomplishments

- useSignalWebSocket hook with JWT auth, exponential backoff (1s→30s cap, 10 retries max)
- Complete signal table showing live IFVG/CISD/EMA state per watchlist symbol as colored pills
- DashboardHeader with sticky positioning, NY session indicator, WS status dot, and logout
- PortfolioCard showing current balance and P&L delta with sign and percentage
- TradesTable with direction coloring, stock/crypto decimal formatting, and Win/Loss outcome pills
- DashboardPage composing all sections with 60s REST polling and disconnect toast notification
- App.tsx wired: /dashboard route now renders real DashboardPage (not placeholder)
- Production build succeeds (1882 modules, 315kB JS, 0 errors)

## Task Commits

1. **Task 1: WebSocket hook, SignalPill, DashboardHeader, and SignalTable** - `2967bca` (feat)
2. **Task 2: PortfolioCard, TradesTable, DashboardPage, and App wiring** - `577fd03` (feat)
3. **Task 3: Visual verification checkpoint** — approved by user
4. **Verification fixes (post-approval)** - `fd2ab59` (fix)

## Files Created/Modified

- `frontend/src/hooks/useSignalWebSocket.ts` - WS hook with JWT auth and exponential backoff reconnect
- `frontend/src/components/SignalPill.tsx` - Colored pill component for IFVG/CISD/EMA states
- `frontend/src/components/SessionIndicator.tsx` - NY session active/closed indicator with dot
- `frontend/src/components/WSStatusDot.tsx` - WS connection status dot (connecting/connected/disconnected)
- `frontend/src/components/DashboardHeader.tsx` - Sticky header with app name, indicators, logout
- `frontend/src/components/SignalTable.tsx` - Signal table with one row per watchlist symbol
- `frontend/src/components/PortfolioCard.tsx` - Portfolio value card with balance and P&L
- `frontend/src/components/TradesTable.tsx` - Closed trades table with all required columns
- `frontend/src/pages/DashboardPage.tsx` - Main dashboard page composing all sections
- `frontend/src/components/ui/table.tsx` - shadcn Table component
- `frontend/src/components/ui/separator.tsx` - shadcn Separator component
- `frontend/src/components/ui/sonner.tsx` - shadcn Sonner wrapper (fixed circular import)
- `frontend/src/lib/api.ts` - Added PaperTrade/Portfolio interfaces and fetch functions
- `frontend/src/App.tsx` - Replaced dashboard placeholder with DashboardPage
- `backend/strategy/ema.py` - Replaced pandas_ta with pandas ewm(adjust=False) to fix llvmlite mismatch

## Decisions Made

- Sonner imported directly from `sonner` package in DashboardPage — shadcn's generated `sonner.tsx` had a circular self-import (`from "@/components/ui/sonner"`) causing TypeScript errors. Fixed the wrapper to import from `sonner` package and removed `next-themes` dependency.
- `frontend/@/` directory added to `.gitignore` — shadcn CLI on Windows creates files in wrong path (documented in STATE.md from Plan 02). Generated files were manually moved to correct location.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed shadcn sonner.tsx circular self-import**
- **Found during:** Task 2 (DashboardPage, production build)
- **Issue:** shadcn CLI generated `sonner.tsx` with `import { Toaster as Sonner, type ToasterProps } from "@/components/ui/sonner"` — importing from itself. Production build failed with circular definition TypeScript errors.
- **Fix:** Rewrote `sonner.tsx` to import `Toaster` and `ToasterProps` directly from the `sonner` npm package. Removed `next-themes` dependency (not needed when hardcoding `theme="dark"`).
- **Files modified:** `frontend/src/components/ui/sonner.tsx`
- **Verification:** `npm run build` passed with exit 0
- **Committed in:** `577fd03` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed "Connection lost" toast firing on initial page load**
- **Found during:** Task 3 (visual verification)
- **Issue:** wsStatus starts as 'disconnected' before WS ever connects, causing the useEffect to fire the error toast immediately on mount
- **Fix:** Added `wasConnectedRef = useRef(false)` — set to true on first 'connected' event; toast only fires when `wasConnectedRef.current === true && wsStatus === 'disconnected'`
- **Files modified:** `frontend/src/pages/DashboardPage.tsx`
- **Verification:** Dashboard loads without spurious toast; toast fires only on real connection drop
- **Committed in:** `fd2ab59` (post-verification fix commit)

**3. [Rule 1 - Bug] Replaced pandas_ta EMA with pandas ewm(adjust=False)**
- **Found during:** Task 3 (visual verification — backend strategy import failed at runtime)
- **Issue:** `pandas_ta` triggers `numba->llvmlite` import chain; llvmlite version mismatch on this machine caused an ImportError when the strategy engine was actually invoked (lazy import deferred the error to runtime)
- **Fix:** Replaced `df.ta.ema(length=period, adjust=False)` with `df["close"].ewm(span=period, adjust=False).mean()` — mathematically identical recursive EMA formula, zero external dependencies
- **Files modified:** `backend/strategy/ema.py`
- **Verification:** Backend starts cleanly; strategy engine runs without ImportError
- **Committed in:** `fd2ab59` (post-verification fix commit)

**4. [Rule 2 - Missing Critical] Improved SignalTable empty state message**
- **Found during:** Task 3 (visual verification)
- **Issue:** "No symbols in watchlist. Add symbols to begin tracking signals." shown even when watchlist has symbols — empty state during NY session closed hours misled users into thinking no symbols were configured
- **Fix:** Changed to "Awaiting market open — signals will appear during the NY session (9:30–10:30 AM ET)." — contextually accurate for session-gated signal delivery
- **Files modified:** `frontend/src/components/SignalTable.tsx`
- **Verification:** Empty state message is now session-aware and does not imply missing watchlist config
- **Committed in:** `fd2ab59` (post-verification fix commit)

---

**Total deviations:** 4 auto-fixed (2 Rule 1 bugs, 1 Rule 1 runtime bug, 1 Rule 2 UX clarity)
**Impact on plan:** All fixes required for correct UX and reliable backend operation. No scope creep.

## Issues Encountered

- shadcn CLI on Windows places component files in `frontend/@/components/ui/` instead of `frontend/src/components/ui/` — known issue per STATE.md. Files manually moved with `cp` after generation.

## Known Stubs

None — all components receive real data from backend endpoints. SignalTable shows empty state when no watchlist symbols are seeded, which is expected behavior (not a stub).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All Phase 2 requirements implemented: SIG-01 through SIG-05, ASSET-03, PAPER-02, PAPER-03
- Dashboard ready for visual verification (Task 3 checkpoint)
- Phase 3 (backtest/charts) can build on DashboardPage layout and existing component patterns

---
*Phase: 02-live-signal-dashboard-paper-trading*
*Completed: 2026-03-20*

## Self-Check: PASSED

Files verified:
- frontend/src/hooks/useSignalWebSocket.ts: FOUND
- frontend/src/components/SignalPill.tsx: FOUND
- frontend/src/components/SignalTable.tsx: FOUND
- frontend/src/components/PortfolioCard.tsx: FOUND
- frontend/src/components/TradesTable.tsx: FOUND
- frontend/src/pages/DashboardPage.tsx: FOUND
- frontend/src/App.tsx: FOUND (DashboardPage import present)

Commits verified:
- 2967bca: FOUND (Task 1)
- 577fd03: FOUND (Task 2)
- fd2ab59: FOUND (verification fixes)
