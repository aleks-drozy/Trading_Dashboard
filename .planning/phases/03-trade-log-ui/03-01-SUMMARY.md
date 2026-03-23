---
phase: 03-trade-log-ui
plan: 01
subsystem: ui-shell
tags: [sidebar, layout, route-protection, ui-primitives, tailwind]

# Dependency graph
requires:
  - phase: 02-trade-data-layer-crud-api
    provides: Trade model, API routes, auth setup
  - phase: 01-project-foundation-auth
    provides: lib/auth.ts, proxy.ts, NextAuth session
provides:
  - app/(dashboard)/layout.tsx: authenticated dashboard shell with sidebar
  - components/layout/Sidebar.tsx: navigation sidebar with active link, user info, sign-out
  - components/ui/Select.tsx: styled native select with ChevronDown arrow and error states
  - components/ui/Badge.tsx: status/direction/asset-class pill badges (9 variants)
  - components/ui/Textarea.tsx: multiline input matching Input.tsx styling
  - components/ui/Toast.tsx: auto-dismissing toast notification (4s, success/error)
  - proxy.ts: /trades path protection added
affects: [03-02, 03-03, 03-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dashboard layout pattern: server component with auth() check + redirect, passes session.user to client Sidebar"
    - "Sidebar active link: usePathname() with pathname === href || pathname.startsWith(href + '/') for nested route matching"
    - "Input/Select/Textarea pattern: identical styling contract — bg-[#0f0f0f] border, green focus ring, red error state, aria-describedby"
    - "Toast auto-dismiss: useEffect + setTimeout(onDismiss, 4000) with clearTimeout cleanup"

key-files:
  created:
    - app/(dashboard)/layout.tsx
    - components/layout/Sidebar.tsx
    - components/ui/Select.tsx
    - components/ui/Badge.tsx
    - components/ui/Textarea.tsx
    - components/ui/Toast.tsx
  modified:
    - proxy.ts
    - app/(dashboard)/dashboard/page.tsx

# Key decisions
decisions:
  - "Sidebar is a client component (uses usePathname + signOut from next-auth/react); layout.tsx is a server component (uses auth() from lib/auth)"
  - "Active link detection uses pathname.startsWith(href + '/') to correctly activate 'Trades' link on all /trades/* routes"

# Metrics
metrics:
  duration: 3min
  completed_date: 2026-03-23
  tasks_completed: 2
  files_changed: 8
---

# Phase 03 Plan 01: Dashboard Shell and UI Primitives Summary

**One-liner:** Sidebar layout with green active-link indicator protecting /dashboard and /trades routes, plus Select/Badge/Textarea/Toast UI primitives for subsequent trade log plans.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Dashboard layout, sidebar, and /trades route protection | e4ab968 | proxy.ts, app/(dashboard)/layout.tsx, components/layout/Sidebar.tsx, dashboard/page.tsx |
| 2 | New UI primitives: Select, Badge, Textarea, Toast | 4a0588a | components/ui/Select.tsx, Badge.tsx, Textarea.tsx, Toast.tsx |

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx vitest run --passWithNoTests`: 3 test files, 26 tests — all passed
- `npx next build`: compiled without errors
- All 6 new files exist
- proxy.ts protects /trades paths
- All acceptance criteria verified via grep checks

## Self-Check: PASSED

Files verified:
- FOUND: app/(dashboard)/layout.tsx
- FOUND: components/layout/Sidebar.tsx
- FOUND: components/ui/Select.tsx
- FOUND: components/ui/Badge.tsx
- FOUND: components/ui/Textarea.tsx
- FOUND: components/ui/Toast.tsx
- FOUND: /trades protection in proxy.ts

Commits verified:
- e4ab968 — feat(03-01): dashboard layout, sidebar, and /trades route protection
- 4a0588a — feat(03-01): add Select, Badge, Textarea, and Toast UI primitives
