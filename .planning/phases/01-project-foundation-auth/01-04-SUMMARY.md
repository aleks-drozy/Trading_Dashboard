---
phase: 01-project-foundation-auth
plan: 04
subsystem: auth-password-reset
tags: [nextjs, react, zod, bcryptjs, resend, mongodb, password-reset, email]

# Dependency graph
requires:
  - phase: 01-03
    provides: Shared UI components (Button, Input, Card), auth schemas (forgotPasswordSchema, resetPasswordSchema), PasswordReset model, User model, dbConnect
provides:
  - Forgot password page (/forgot-password) with email form and success state
  - Reset password page (/reset-password?token=...) with form, success, and invalid-token states
  - Forgot password API (POST /api/auth/forgot-password) — token creation + Resend email
  - Reset password API (POST /api/auth/reset-password) — token validation + password update
affects: [complete AUTH-04 requirement, user account recovery flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Resend client instantiated inside handler (not at module level) to avoid build-time missing API key error
    - Anti-enumeration: forgot-password always returns 200 with same message regardless of email existence
    - PasswordReset token validated with used:false AND expiresAt:gt:now (one-time use + expiry)
    - async searchParams in Next.js 16 page — must await props.searchParams (Promise type)
    - Three-state form pattern: "form" | "success" | "invalid" for reset-password flow

key-files:
  created:
    - app/api/auth/forgot-password/route.ts
    - app/api/auth/reset-password/route.ts
    - components/auth/ForgotPasswordForm.tsx
    - components/auth/ResetPasswordForm.tsx
    - app/(auth)/forgot-password/page.tsx
    - app/(auth)/reset-password/page.tsx
  modified: []

key-decisions:
  - "Resend client moved inside POST handler — module-level instantiation throws during build when RESEND_API_KEY is absent in environment"
  - "forgot-password always returns HTTP 200 with identical message — no account enumeration per D-08"
  - "PasswordReset token lookup requires both used:false and expiresAt.$gt:now — prevents replay of used tokens AND expired tokens"

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 01 Plan 04: Password Reset Flow Summary

**Complete password reset via email link: forgot-password form sends Resend email with crypto-secure token, reset-password form validates token and updates bcrypt-hashed password, with anti-enumeration protection and expired/used token error states**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-22
- **Completed:** 2026-03-22
- **Tasks:** 2
- **Files created:** 6

## Accomplishments

- **Forgot password API** (`app/api/auth/forgot-password/route.ts`): Validates email with forgotPasswordSchema, generates 32-byte hex token, stores in PasswordReset collection with 1-hour expiry, sends reset email via Resend SDK, always returns same 200 response regardless of user existence (D-08 anti-enumeration)
- **Reset password API** (`app/api/auth/reset-password/route.ts`): Validates resetPasswordSchema on password fields, looks up token checking `used: false` AND `expiresAt: { $gt: new Date() }`, hashes new password with bcryptjs (rounds 12), updates user.passwordHash, marks resetRecord.used = true
- **ForgotPasswordForm** (`components/auth/ForgotPasswordForm.tsx`): "use client", two states (form/success), onBlur Zod validation, POST to /api/auth/forgot-password, CheckCircle icon in success state, generic D-08 message, "Back to sign in" link
- **ResetPasswordForm** (`components/auth/ResetPasswordForm.tsx`): "use client", three states (form/success/invalid), token prop from page, onBlur Zod validation, POST to /api/auth/reset-password, CheckCircle success state with router.push("/login"), AlertTriangle invalid state with "Request a new link"
- **Forgot password page** (`app/(auth)/forgot-password/page.tsx`): Wraps ForgotPasswordForm in Card, server component
- **Reset password page** (`app/(auth)/reset-password/page.tsx`): async server component, `searchParams: Promise<{ token?: string }>`, awaits props.searchParams, passes token to ResetPasswordForm

## Task Commits

1. **Task 1: API routes** — `060e479`
2. **Task 2: Pages and forms** — `a9968a7`
3. **Fix: Resend client instantiation** — `74797a0`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Resend client instantiated at module level causes build failure**
- **Found during:** Task 2 (npm run build)
- **Issue:** `const resend = new Resend(process.env.RESEND_API_KEY)` at module level throws "Missing API key" during Next.js build because RESEND_API_KEY is not available in the build environment
- **Fix:** Moved `const resend = new Resend(process.env.RESEND_API_KEY)` inside the POST handler function body so it is only instantiated at runtime
- **Files modified:** `app/api/auth/forgot-password/route.ts`
- **Commit:** `74797a0`

## Known Stubs

None — all data paths are wired. The Resend email sends a real reset URL using NEXTAUTH_URL. The token is stored in MongoDB and validated on reset. No placeholder data flows to the UI.

## Self-Check: PASSED

Checked files:
- `app/api/auth/forgot-password/route.ts` — FOUND
- `app/api/auth/reset-password/route.ts` — FOUND
- `components/auth/ForgotPasswordForm.tsx` — FOUND
- `components/auth/ResetPasswordForm.tsx` — FOUND
- `app/(auth)/forgot-password/page.tsx` — FOUND
- `app/(auth)/reset-password/page.tsx` — FOUND
- Commit `060e479` — FOUND (Task 1: API routes)
- Commit `a9968a7` — FOUND (Task 2: Pages and forms)
- Commit `74797a0` — FOUND (Fix: Resend client)
- `npm run build` — Exit code 0

---
*Phase: 01-project-foundation-auth*
*Completed: 2026-03-22*
