---
phase: 01-project-foundation-auth
plan: 02
subsystem: auth
tags: [nextauth, mongodb, mongoose, zod, bcryptjs, jwt, google-oauth, credentials]

# Dependency graph
requires:
  - phase: 01-01
    provides: Next.js 16 scaffold with all Phase 1 dependencies installed (next-auth@beta, mongoose, bcryptjs, zod)
provides:
  - MongoDB connection singleton (lib/db.ts) — dbConnect() used by all API routes
  - User Mongoose model (lib/models/User.ts) — email/password + Google OAuth users with timestamps
  - PasswordReset Mongoose model (lib/models/PasswordReset.ts) — TTL index for auto-expiry
  - Zod auth schemas (schemas/auth.ts) — registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema
  - NextAuth v5 config (lib/auth.ts) — Credentials + Google providers, JWT sessions, signIn callback
  - TypeScript session augmentation (types/next-auth.d.ts) — session.user.id and JWT.userId
  - NextAuth API route (app/api/auth/[...nextauth]/route.ts) — GET/POST handlers
affects: [01-03, 01-04, 01-05, all auth pages, all protected routes, all API routes that call dbConnect]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - MongoDB singleton pattern via dbConnect() — Mongoose deduplicates repeated calls
    - JWT session strategy — required for Credentials provider (database sessions incompatible)
    - Google OAuth auto-creates User document on first sign-in via signIn callback
    - Zod schemas shared between client forms and server-side validation
    - PasswordReset TTL index — MongoDB auto-deletes expired documents (expireAfterSeconds: 0)

key-files:
  created:
    - lib/db.ts
    - lib/models/User.ts
    - lib/models/PasswordReset.ts
    - schemas/auth.ts
    - lib/auth.ts
    - types/next-auth.d.ts
    - app/api/auth/[...nextauth]/route.ts
  modified:
    - tsconfig.json (allowSyntheticDefaultImports added by 01-05 agent for ESM compat)

key-decisions:
  - "NextAuth v5 beta.30 type resolution issue with Next.js TypeScript plugin requires NextAuth cast to any — next-auth's export default function is not callable through TypeScript 5.9 + moduleResolution: bundler + the Next.js TS plugin; cast is workaround until upstream fix"
  - "JWT session strategy: Credentials provider is incompatible with database sessions (NextAuth design constraint) — JWT required"
  - "No @auth/mongodb-adapter: manually managing User and PasswordReset models via Mongoose; adapter would break Credentials provider"

patterns-established:
  - "Pattern: await dbConnect() at top of every API route handler and Server Component that touches MongoDB"
  - "Pattern: loginSchema.safeParse(credentials) in authorize — Zod validates before DB query"
  - "Pattern: Google signIn callback auto-creates User document on first OAuth login"

requirements-completed:
  - AUTH-01
  - AUTH-02
  - AUTH-03

# Metrics
duration: 15min
completed: 2026-03-22
---

# Phase 01 Plan 02: Auth Backend Foundation Summary

**MongoDB singleton, User/PasswordReset Mongoose models, Zod auth schemas, NextAuth v5 with Credentials + Google OAuth providers, JWT sessions, and API route handler — the complete auth backbone**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-22T16:15:49Z
- **Completed:** 2026-03-22T16:30:59Z
- **Tasks:** 2
- **Files created:** 7 (tsconfig.json modified by concurrent 01-05 agent)

## Accomplishments

- MongoDB connection singleton (`lib/db.ts`) — `dbConnect()` wraps `mongoose.connect(MONGODB_URI)` and is idempotent (Mongoose deduplicates repeated calls)
- User Mongoose model (`lib/models/User.ts`) — `email` (unique, lowercase), `name`, `image?`, `passwordHash?`, `provider` (enum: credentials/google), timestamps via `{ timestamps: true }`
- PasswordReset Mongoose model (`lib/models/PasswordReset.ts`) — `email`, `token` (unique), `expiresAt`, `used` with TTL index `{ expireAfterSeconds: 0 }` for MongoDB auto-deletion of expired tokens (D-07)
- Zod auth schemas (`schemas/auth.ts`) — all 4 schemas: `registerSchema` (name, email, password with complexity: 8+ chars, uppercase, lowercase, digit), `loginSchema`, `forgotPasswordSchema`, `resetPasswordSchema` (with `confirmPassword` refinement matching)
- NextAuth v5 config (`lib/auth.ts`) — Google + Credentials providers; `signIn` callback auto-creates User for Google OAuth; `jwt` callback stores `userId`; `session` callback exposes `session.user.id`; JWT strategy; custom pages (`/login`)
- TypeScript augmentation (`types/next-auth.d.ts`) — `Session.user.id: string` and `JWT.userId: string`
- NextAuth catch-all route (`app/api/auth/[...nextauth]/route.ts`) — re-exports `GET, POST` from handlers

## Task Commits

1. **Task 1: MongoDB connection, User/PasswordReset models, Zod schemas** — `f49b6a1`
2. **Task 2: NextAuth API route and TypeScript session augmentation** — `bb919de`

Note: `lib/auth.ts` was also committed in this plan but then modified by the concurrent 01-05 agent (commit `7d1c41e`) to fix the TypeScript type resolution issue.

## Files Created/Modified

- `lib/db.ts` — Mongoose connection singleton, `export default dbConnect`
- `lib/models/User.ts` — User model, IUser interface, `{ timestamps: true }`
- `lib/models/PasswordReset.ts` — PasswordReset model with TTL index
- `schemas/auth.ts` — 4 Zod schemas + `RegisterInput` / `LoginInput` type exports
- `lib/auth.ts` — NextAuth v5 config (created here, fixed by 01-05 agent concurrently)
- `types/next-auth.d.ts` — TypeScript module augmentation
- `app/api/auth/[...nextauth]/route.ts` — NextAuth catch-all route handler

## Decisions Made

- **NextAuth `as any` cast:** TypeScript 5.9 with `moduleResolution: bundler` and the Next.js TypeScript plugin prevents calling `NextAuth({...})` directly — the module namespace type has no call signatures in this combination. The 01-05 concurrent agent applied `const createNextAuth = NextAuth as any` as a workaround. The auth functionality is correct at runtime; type safety is partially sacrificed for compilation.
- **No @auth/mongodb-adapter:** Per Pitfall 3 in research, the MongoDB adapter is incompatible with Credentials provider. User and PasswordReset models are managed manually.
- **JWT sessions:** Required for Credentials provider — database sessions cannot be used with Credentials (NextAuth design constraint).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript 5.9 + Next.js TS plugin prevents NextAuth() from being callable**
- **Found during:** Task 2 (TypeScript verification step)
- **Issue:** `export const { auth, handlers, signIn, signOut } = NextAuth({...})` fails with `TS2349: This expression is not callable. Type 'typeof import("next-auth")' has no call signatures` when using TypeScript 5.9 with `moduleResolution: bundler` and the `next` TypeScript plugin. The issue is that TypeScript resolves the module namespace rather than the default export function.
- **Fix:** Applied `const createNextAuth = NextAuth as any` cast with eslint-disable comments. The 01-05 concurrent agent applied this fix (commit `7d1c41e`), also adding `allowSyntheticDefaultImports: true` to `tsconfig.json`. Both fixes together resolve the issue.
- **Files modified:** `lib/auth.ts`, `tsconfig.json`
- **Commit:** `7d1c41e` (applied by concurrent 01-05 agent)

### Parallel Execution Note

This plan ran in parallel with plan 01-05. The 01-05 agent created `lib/auth.ts` independently (since it needed auth for the landing page) and fixed the TypeScript compilation issue. My Task 1 (Task 2 of this plan) committed the same `lib/auth.ts` file first (commit `f49b6a1` created lib/auth.ts as untracked), then 01-05 committed it as a modification (`7d1c41e`). The final state is correct and all acceptance criteria are met.

## Known Stubs

None — all files are fully functional implementations with no placeholder data.

## Self-Check

## Self-Check: PASSED

Checked files:
- `lib/db.ts` — FOUND
- `lib/models/User.ts` — FOUND
- `lib/models/PasswordReset.ts` — FOUND
- `schemas/auth.ts` — FOUND
- `lib/auth.ts` — FOUND
- `types/next-auth.d.ts` — FOUND
- `app/api/auth/[...nextauth]/route.ts` — FOUND
- Commit `f49b6a1` — FOUND (Task 1)
- Commit `bb919de` — FOUND (Task 2)
- `npx tsc --noEmit` — Exit code 0

---
*Phase: 01-project-foundation-auth*
*Completed: 2026-03-22*
