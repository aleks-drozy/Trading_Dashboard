---
phase: 01-project-foundation-auth
plan: 01
subsystem: infra
tags: [next.js, typescript, tailwind, eslint, prettier, husky, lint-staged, vitest, mongoose, next-auth, bcryptjs, resend, zod, lucide-react]

# Dependency graph
requires: []
provides:
  - Next.js 16.2.1 App Router project scaffold with TypeScript and Tailwind CSS
  - All Phase 1 production dependencies installed (next-auth@beta, mongoose, bcryptjs, resend, zod, lucide-react)
  - Husky pre-commit hook running lint-staged + tsc --noEmit + vitest
  - lint-staged config targeting **/*.{ts,tsx} with eslint --fix and prettier --write
  - Vitest 2.x test runner configured for __tests__ directory with @ path alias
  - .env.example documenting all 6 required environment variables
  - Dark theme CSS variables established in globals.css
  - Inter + JetBrains Mono fonts loaded via next/font/google
affects: [01-02, 01-03, 01-04, 01-05, all future phases]

# Tech tracking
tech-stack:
  added:
    - next@16.2.1 (App Router)
    - react@19.2.4 + react-dom@19.2.4
    - typescript@5
    - tailwindcss@4
    - next-auth@5.0.0-beta.30
    - mongoose@9.3.1
    - bcryptjs@3.0.3
    - resend@6.9.4
    - zod@4.3.6
    - lucide-react@0.577.0
    - husky@9.1.7
    - lint-staged@16.4.0
    - prettier@3.8.1
    - vitest@2.1.9 (downgraded from 4.x for Node 21 compatibility)
  patterns:
    - Pre-commit hook: lint-staged (ESLint+Prettier on staged TS files) + tsc --noEmit globally + vitest
    - CSS variables for dark theme colors in globals.css
    - Font loading via next/font/google with CSS variable assignment

key-files:
  created:
    - package.json
    - tsconfig.json
    - next.config.ts
    - app/layout.tsx
    - app/globals.css
    - app/page.tsx
    - .husky/pre-commit
    - lint-staged.config.js
    - .prettierrc
    - .prettierignore
    - vitest.config.ts
    - .env.example
    - .gitignore
  modified: []

key-decisions:
  - "Vitest downgraded from 4.x to 2.x: vitest 4.x depends on rolldown which requires Node 18/20/22+ native bindings; system runs Node 21.7.1 which is incompatible. Vitest 2.x works on Node 21."
  - "tsc --noEmit runs outside lint-staged per D-16: prevents lint-staged from appending staged file paths as args, which would break project-level type checking"
  - ".env.local added to .gitignore via .env* pattern with !.env.example exception to keep docs committed"

patterns-established:
  - "Pattern: Pre-commit hook order: lint-staged first (fast staged-file checks), then tsc (global type check), then vitest (unit tests)"
  - "Pattern: CSS custom properties for all theme colors — use var(--accent), var(--background) etc. throughout"

requirements-completed:
  - INFRA-04
  - INFRA-05

# Metrics
duration: 7min
completed: 2026-03-22
---

# Phase 01 Plan 01: Project Scaffold & Dev Tooling Summary

**Next.js 16.2.1 project scaffolded from scratch with full dev tooling: Husky pre-commit hooks (lint-staged + tsc + vitest), Prettier auto-format, Vitest 2.x test runner, dark theme CSS variables, and Inter/JetBrains Mono fonts**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-22T16:05:48Z
- **Completed:** 2026-03-22T16:12:54Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Next.js 16.2.1 App Router project scaffolded with all Phase 1 dependencies installed (next-auth@beta, mongoose, bcryptjs, resend, zod, lucide-react, husky, lint-staged, prettier, vitest)
- Pre-commit hook configured per D-14/D-15/D-16: lint-staged (ESLint + Prettier on staged .ts/.tsx files) + tsc --noEmit globally + vitest run
- .env.example documents all 6 required env vars (MONGODB_URI, NEXTAUTH_SECRET, NEXTAUTH_URL, AUTH_TRUST_HOST, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, RESEND_API_KEY)
- Dark theme CSS variables (#0f0f0f background, #00ff88 accent, #ef4444 destructive) in globals.css
- Inter and JetBrains Mono fonts loaded via next/font/google with CSS variable names

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next.js 16 project and install all dependencies** - `e9efdd5` (feat)
2. **Task 2: Configure Husky, lint-staged, Prettier, Vitest, and .env.example** - `fddb153` (chore)

## Files Created/Modified

- `package.json` - All Phase 1 dependencies + test/lint/build scripts
- `tsconfig.json` - TypeScript config (create-next-app default, strict mode)
- `next.config.ts` - Next.js 16 config (create-next-app default)
- `app/layout.tsx` - Inter + JetBrains Mono fonts, TradeJournal metadata, dark class
- `app/globals.css` - Dark theme CSS variables, body font assignment
- `app/page.tsx` - Minimal placeholder (to be replaced in plan 01-05)
- `.husky/pre-commit` - lint-staged + tsc --noEmit + vitest run --passWithNoTests
- `lint-staged.config.js` - eslint --fix + prettier --write on **/*.{ts,tsx}
- `.prettierrc` - semi=false, tabWidth=2, trailingComma=es5, printWidth=100
- `.prettierignore` - node_modules, .next, dist, coverage
- `vitest.config.ts` - node environment, __tests__ include pattern, @ alias
- `.env.example` - All 6 required environment variable keys with documentation
- `.gitignore` - .env* excluded, !.env.example exception added

## Decisions Made

- **Vitest 2.x instead of 4.x:** vitest 4.1.0 depends on rolldown which requires a Windows native binding (`@rolldown/binding-win32-x64-msvc`) that fails on Node.js 21.7.1 (odd-numbered non-LTS release). Downgraded to vitest@2 which works correctly.
- **tsc --noEmit outside lint-staged:** Per D-16, running tsc inside lint-staged causes it to receive staged file paths as arguments, breaking project-level analysis. Runs separately in pre-commit hook.
- **.env.example committed, .env.local ignored:** Used `.env*` with `!.env.example` exception in .gitignore so documentation is versioned but secrets are not.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest 4.x incompatible with Node 21.7.1 — downgraded to vitest@2**
- **Found during:** Task 2 (Vitest verification step)
- **Issue:** vitest 4.1.0 uses rolldown which requires `@rolldown/binding-win32-x64-msvc` native Node.js binding. The rolldown package has engine requirements of Node 18/20/22+ but the system runs Node 21.7.1 (odd-numbered current release). The `styleText` API also fails with an incompatible array format in Node 21.
- **Fix:** Ran `npm install -D vitest@2` to pin to vitest 2.1.9 which uses Vite (not rolldown) and is compatible with Node 21.
- **Files modified:** package.json, package-lock.json
- **Verification:** `npx vitest run --passWithNoTests` exits with code 0
- **Committed in:** fddb153 (Task 2 commit)

**2. [Rule 3 - Blocking] create-next-app refuses non-empty directory — scaffolded in temp dir**
- **Found during:** Task 1 (scaffold step)
- **Issue:** `npx create-next-app@latest .` refuses to run when the directory contains .planning/ subdirectory
- **Fix:** Scaffolded in `/tmp/next-scaffold/trade-journal`, then copied all generated files to project root
- **Files modified:** All scaffolded files
- **Verification:** `npm run build` exits with code 0
- **Committed in:** e9efdd5 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both were environment/tooling constraints, not design changes. Plan intent fully achieved.

## Known Stubs

- `app/page.tsx` — Minimal placeholder page (`<p>TradeJournal</p>`). Intentional per plan Task 1 step 6. Will be replaced with full landing page (Nav + Hero + Features) in plan 01-05 per D-09/D-10.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required at this stage. Environment variables will be needed in later plans when MongoDB, NextAuth, Google OAuth, and Resend are configured.

## Next Phase Readiness

- Project builds and starts with `npm run dev`
- Pre-commit hooks are active and configured correctly
- All Phase 1 production dependencies installed and ready to import
- Dark theme CSS tokens available globally
- Vitest runner ready — tests can be added to `__tests__/` directory
- Plan 01-02 can begin immediately (NextAuth v5 config + MongoDB connection)

---
*Phase: 01-project-foundation-auth*
*Completed: 2026-03-22*
