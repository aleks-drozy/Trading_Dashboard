# Phase 1: Project Foundation & Auth - Research

**Researched:** 2026-03-22
**Domain:** Next.js 16 App Router, NextAuth v5 (beta), MongoDB/Mongoose, Resend, Husky/lint-staged
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Post-login redirect → `/dashboard`
- **D-02:** Post-registration → auto-logged in, redirect to `/dashboard` (no separate login step)
- **D-03:** Form validation: inline, on blur — error appears under each field when user leaves it
- **D-04:** Google OAuth button appears **above** the email/password form, separated by an "or continue with email" divider
- **D-05:** Email provider: **Resend** (`npm install resend`) — API key stored in `.env.local` as `RESEND_API_KEY`
- **D-06:** Reset link opens `/reset-password?token=...` — a page with "new password" + "confirm password" fields
- **D-07:** Reset tokens stored in MongoDB in a `PasswordReset` collection: `{ email, token, expiresAt, used }` — one-time use, expires in 1 hour
- **D-08:** Forgot-password page at `/forgot-password` — user enters email, receives reset link, sees a generic success message regardless of whether email exists (no account enumeration)
- **D-09:** Landing page sections: **Nav bar** + **Hero** + **Features section** (no footer for v1)
- **D-10:** Landing page complexity: **polished from Phase 1** — not deferred
- **D-11:** Hero direction: trader-focused, serious — "Track every trade. Improve every week." tone
- **D-12:** Nav bar: logo left, "Login" and "Get Started" buttons right
- **D-13:** Features section: 3–4 feature cards matching core value props (trade logging, analytics, dark UI built for traders)
- **D-14:** Pre-commit runs: ESLint (lint-staged, staged files only) + Prettier (auto-format via lint-staged) + TypeScript type-check (`tsc --noEmit`) + Vitest unit tests
- **D-15:** Prettier: **auto-format** — files formatted automatically on commit, never fail for formatting
- **D-16:** lint-staged config targets: `**/*.{ts,tsx}` for ESLint + Prettier; `tsc --noEmit` runs globally (not per-file)

### Claude's Discretion

- Exact hero copy and feature card text
- Loading states and spinner design on auth forms
- Exact Husky + lint-staged configuration syntax
- Error message wording on auth pages

### Deferred Ideas (OUT OF SCOPE)

- Footer — can be added in Phase 5 (UI Polish)
- Email verification on registration — out of scope for v1
- Magic link login — deferred, using password reset flow instead
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can register with email and password (min 8 chars, 1 uppercase, 1 lowercase, 1 number) | NextAuth v5 Credentials provider + Zod schema validation in `schemas/auth.ts`; bcryptjs for password hashing |
| AUTH-02 | User can sign in with Google OAuth | NextAuth v5 Google provider — configured in `lib/auth.ts` alongside Credentials provider |
| AUTH-03 | User session persists across browser refresh | NextAuth v5 JWT session strategy (required for Credentials provider); session stored in encrypted cookie |
| AUTH-04 | User can request a password reset via email link | Resend SDK for email delivery; custom `PasswordReset` MongoDB collection; `/forgot-password` and `/reset-password?token=` pages |
| AUTH-05 | All dashboard and API routes are protected via NextAuth v5 middleware | `proxy.ts` (Next.js 16 naming) with `auth()` helper and `authorized` callback; matcher config excludes `/api/auth/*` |
| UI-05 | Landing page with feature overview and sign-up CTA | Static page at `/` — Nav + Hero + Features section; polished dark terminal theme from day one |
| INFRA-04 | ESLint + Prettier configured with Husky pre-commit hooks | Husky v9 + lint-staged v16; pre-commit: ESLint (staged), Prettier (auto-format), tsc --noEmit (global), Vitest |
| INFRA-05 | Environment variables documented in .env.example | `.env.example` with all keys: `MONGODB_URI`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY` |
</phase_requirements>

---

## Summary

This phase scaffolds a Next.js 16 App Router project from scratch and wires up complete authentication. The stack is locked: Next.js 16 (latest stable as of 2026-03-22), NextAuth v5 beta (the only version that supports Next.js 16 App Router natively), MongoDB via Mongoose, and Resend for transactional email.

**Critical Next.js 16 breaking change:** The middleware file convention changed from `middleware.ts` to `proxy.ts`. The export function is also renamed from `middleware` to `proxy`. NextAuth v5 documentation still references the old name — implement as `proxy.ts` with `export { auth as proxy } from '@/lib/auth'` for Next.js 16. Additionally, all request-time APIs (`cookies`, `headers`, `params`, `searchParams`) are now strictly async.

**NextAuth v5 beta status:** `next-auth@5.0.0-beta.30` is the current version. It is the only version compatible with Next.js App Router for custom credential flows. The stable v4 (`4.24.13`) does NOT support App Router properly. Use the beta without hesitation — it is in wide production use.

**Primary recommendation:** Scaffold with `npx create-next-app@latest` targeting Next.js 16 with TypeScript + Tailwind + App Router + no src/ dir (spec shows root-level `app/`). Then layer in NextAuth v5 beta, Mongoose, and Resend individually.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.1 | Framework | Latest stable; Turbopack default, proxy.ts convention |
| react / react-dom | 19.2.x | UI runtime | Required by Next.js 16 |
| typescript | 5.9.3 | Type safety | create-next-app default; TS 5.1+ required by Next.js 16 |
| next-auth | 5.0.0-beta.30 | Auth (credentials + OAuth) | Only version with proper App Router support |
| mongoose | 9.3.1 | MongoDB ODM | Type-safe schema layer for MongoDB Atlas |
| bcryptjs | 3.0.3 | Password hashing | Pure-JS bcrypt — no native bindings needed in serverless |
| resend | 6.9.4 | Transactional email | Locked decision D-05; simplest API for Next.js route handlers |
| zod | 4.3.6 | Runtime validation | Shared between client forms and API route handlers |
| tailwindcss | 4.2.2 | Utility CSS | create-next-app default; dark theme config |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/bcryptjs | 3.0.0 | TypeScript types for bcryptjs | Always alongside bcryptjs |
| husky | 9.1.7 | Git hooks manager | Pre-commit enforcement (INFRA-04) |
| lint-staged | 16.4.0 | Run linters on staged files | Paired with Husky |
| prettier | 3.8.1 | Code formatter | Auto-format on commit (D-15) |
| vitest | 4.1.0 | Unit test runner | Pre-commit test gate (D-14) |
| crypto (Node built-in) | N/A | Password reset token generation | `crypto.randomBytes(32).toString('hex')` — no extra package needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bcryptjs | bcrypt (native) | bcrypt is faster but requires native bindings that fail on some serverless environments; bcryptjs is pure JS and always works |
| next-auth beta | better-auth, Clerk | Locked decision — NextAuth v5 is the standard for this stack |
| mongoose | Prisma + MongoDB | Mongoose is simpler for MongoDB-native workflows; Prisma has better type inference but adds migration complexity |
| resend | Nodemailer, SendGrid | Locked decision D-05 |

**Installation:**

```bash
# Core
npx create-next-app@latest trade-journal --typescript --tailwind --eslint --app --no-src-dir --import-alias="@/*"

# Auth + DB
npm install next-auth@beta mongoose bcryptjs resend zod
npm install -D @types/bcryptjs

# Dev tooling
npm install -D husky lint-staged prettier vitest
npx husky init
```

**Version verification (confirmed 2026-03-22):**
- `next`: 16.2.1
- `next-auth`: 5.0.0-beta.30
- `mongoose`: 9.3.1
- `bcryptjs`: 3.0.3
- `resend`: 6.9.4
- `zod`: 4.3.6
- `tailwindcss`: 4.2.2
- `husky`: 9.1.7
- `lint-staged`: 16.4.0
- `prettier`: 3.8.1

---

## Architecture Patterns

### Recommended Project Structure

```
trade-journal/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│   ├── (dashboard)/          # protected route group
│   │   └── dashboard/page.tsx
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/route.ts
│   │   └── auth/
│   │       ├── forgot-password/route.ts
│   │       └── reset-password/route.ts
│   ├── page.tsx              # landing page
│   └── layout.tsx
├── components/
│   ├── ui/                   # Button, Input, Card base components
│   ├── auth/                 # LoginForm, RegisterForm, ForgotPasswordForm
│   └── landing/              # HeroSection, FeaturesSection, Navbar
├── lib/
│   ├── auth.ts               # NextAuth v5 config (exported: auth, handlers, signIn, signOut)
│   ├── db.ts                 # Mongoose connection singleton
│   └── models/
│       ├── User.ts           # Mongoose User model
│       └── PasswordReset.ts  # Mongoose PasswordReset model
├── schemas/
│   └── auth.ts               # Zod schemas for register, login, reset
├── types/
│   └── next-auth.d.ts        # TypeScript module augmentation for custom session fields
├── proxy.ts                  # Next.js 16 route protection (was middleware.ts in v15)
└── .env.example
```

### Pattern 1: NextAuth v5 Configuration (lib/auth.ts)

**What:** Centralized auth config exporting four named functions consumed by proxy.ts, API route, server components, and server actions.

**When to use:** Always — this is the single source of truth for auth.

```typescript
// Source: https://authjs.dev/getting-started/migrating-to-v5
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { loginSchema } from "@/schemas/auth"
import dbConnect from "@/lib/db"
import User from "@/lib/models/User"
import bcryptjs from "bcryptjs"

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        await dbConnect()
        const user = await User.findOne({ email: parsed.data.email })
        if (!user || !user.passwordHash) return null

        const valid = await bcryptjs.compare(parsed.data.password, user.passwordHash)
        if (!valid) return null

        return { id: user._id.toString(), email: user.email, name: user.name }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.userId = user.id
      return token
    },
    session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string
      return session
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" },
})
```

### Pattern 2: proxy.ts — Route Protection (Next.js 16)

**What:** Root-level file that runs before every request to protect dashboard routes and API routes.

**When to use:** Always at root level. Next.js 16 renamed `middleware.ts` → `proxy.ts` and the export from `middleware` → `proxy`.

```typescript
// Source: https://authjs.dev/getting-started/session-management/protecting
// AND: https://nextjs.org/docs/app/guides/upgrading/version-16
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl
  const isAuthenticated = !!req.auth

  // Allow public auth API routes
  if (pathname.startsWith("/api/auth")) return NextResponse.next()

  // Protect API routes
  if (pathname.startsWith("/api") && !isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 })
  }

  // Protect dashboard routes
  if (pathname.startsWith("/dashboard") && !isAuthenticated) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
```

### Pattern 3: Mongoose Connection Singleton (lib/db.ts)

**What:** Simple dbConnect() that Mongoose deduplicates automatically — repeated calls when already connected are no-ops.

**When to use:** Call `await dbConnect()` at the top of every API route handler and Server Component that touches MongoDB.

```typescript
// Source: https://mongoosejs.com/docs/nextjs.html
import mongoose from "mongoose"

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI environment variable is not defined")
}

async function dbConnect() {
  await mongoose.connect(MONGODB_URI)
  return mongoose
}

export default dbConnect
```

### Pattern 4: NextAuth API Route (app/api/auth/[...nextauth]/route.ts)

```typescript
// Source: https://authjs.dev/getting-started/migrating-to-v5
import { handlers } from "@/lib/auth"
export const { GET, POST } = handlers
```

### Pattern 5: Password Reset Flow

**What:** Custom three-step flow outside NextAuth — forgot-password → email token → reset-password page.

**When to use:** Password reset is NOT handled by NextAuth. It requires custom API routes and the PasswordReset model.

```typescript
// app/api/auth/forgot-password/route.ts
import { NextRequest } from "next/server"
import crypto from "crypto"
import dbConnect from "@/lib/db"
import User from "@/lib/models/User"
import PasswordReset from "@/lib/models/PasswordReset"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  await dbConnect()

  // Always return success — no account enumeration (D-08)
  const user = await User.findOne({ email })
  if (user) {
    const token = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await PasswordReset.create({ email, token, expiresAt, used: false })

    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`
    await resend.emails.send({
      from: "Trade Journal <noreply@yourdomain.com>",
      to: [email],
      subject: "Reset your password",
      react: PasswordResetEmail({ resetUrl }),
    })
  }

  return Response.json({ message: "If that email exists, you'll receive a reset link." })
}
```

### Pattern 6: TypeScript Session Augmentation (types/next-auth.d.ts)

```typescript
// Source: https://authjs.dev/getting-started/authentication/credentials
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      image?: string
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string
  }
}
```

### Pattern 7: Husky + lint-staged Configuration

**What:** Pre-commit hook that runs ESLint (staged files), Prettier (auto-format), tsc (global), and Vitest.

**When to use:** After `npx husky init`.

```javascript
// .husky/pre-commit
npx lint-staged
npx tsc --noEmit
npx vitest run --passWithNoTests
```

```javascript
// lint-staged.config.js (or in package.json)
module.exports = {
  "**/*.{ts,tsx}": [
    "eslint --fix",
    "prettier --write",
  ],
}
```

**Important:** `tsc --noEmit` runs outside lint-staged (not per-file) to avoid lint-staged appending individual file paths as arguments, which breaks TypeScript's project-level analysis. The pre-commit script runs it separately.

### Anti-Patterns to Avoid

- **Using `middleware.ts` in Next.js 16:** The file must be `proxy.ts` and the export must be named `proxy`. Using the old name produces deprecation warnings or fails.
- **Checking auth inside API routes redundantly:** `proxy.ts` handles auth centrally. Individual API handlers do not need `await auth()` guard checks — middleware runs first.
- **Using `next-auth@4` (stable/latest):** `npm install next-auth` installs v4.24.13 which lacks App Router support. Always specify `next-auth@beta`.
- **Synchronous `params` / `searchParams` in Next.js 16:** These are now strictly async. Always `await props.params` and `await props.searchParams` in pages and layouts.
- **Storing tokens in localStorage:** NextAuth v5 uses HttpOnly cookies for JWT sessions — do not attempt to manually manage tokens client-side.
- **Using MongoDB adapter with Credentials provider:** The official MongoDB adapter is for database sessions, which are incompatible with the Credentials provider (requires JWT sessions). Do NOT install `@auth/mongodb-adapter` for this project.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom hash function | `bcryptjs` | Salt generation, timing attack prevention, cost factor tuning |
| Session management | Custom JWT signing | NextAuth v5 JWT sessions | CSRF protection, secure cookie flags, expiry rotation |
| Google OAuth | Custom OAuth flow | NextAuth v5 Google provider | State parameter, PKCE, token refresh, callback validation |
| Email validation | Regex | Zod `.email()` | RFC-compliant, handles edge cases |
| Token generation | Math.random() | `crypto.randomBytes(32)` | Cryptographically secure; Math.random() is NOT |
| Form validation | Manual field checks | Zod schemas shared client + server | Deduplicated validation, parse-time type narrowing |

**Key insight:** Auth is the highest-value target for security bugs. Every hand-rolled component (hashing, sessions, OAuth) introduces attack surface. Use the ecosystem libraries; they have been audited and battle-tested.

---

## Common Pitfalls

### Pitfall 1: `middleware.ts` vs `proxy.ts` in Next.js 16

**What goes wrong:** The file `middleware.ts` still works but logs a deprecation warning in Next.js 16. In a future release it will stop working. The NextAuth docs still show `middleware.ts` but this project targets Next.js 16.
**Why it happens:** Next.js 16 renamed the convention from "middleware" to "proxy" for conceptual clarity.
**How to avoid:** Create `proxy.ts` at the project root. Export the handler as `proxy`, not `middleware`. Check `skipProxyUrlNormalize` in next.config.ts if you previously used `skipMiddlewareUrlNormalize`.
**Warning signs:** Build output mentions `middleware` deprecation. NextAuth examples in docs showing `export { auth as middleware }` should become `export { auth as proxy }`.

### Pitfall 2: Installing next-auth without @beta tag

**What goes wrong:** `npm install next-auth` installs v4.24.13 (stable/latest dist-tag). This version does not support the App Router auth() pattern.
**Why it happens:** npm dist-tags — `latest` points to v4, `beta` points to v5.
**How to avoid:** Always `npm install next-auth@beta`. Verify with `npm list next-auth`.
**Warning signs:** Import of `import NextAuth from 'next-auth'` in auth.ts fails to export `auth` as a standalone function.

### Pitfall 3: Credentials Provider + MongoDB Adapter Incompatibility

**What goes wrong:** The MongoDB adapter switches sessions to database mode, which is incompatible with the Credentials provider. All credential sign-ins will silently fail.
**Why it happens:** NextAuth's Credentials provider is intentionally restricted to JWT sessions only (a security decision — raw credentials should not be stored in the DB).
**How to avoid:** Do NOT install `@auth/mongodb-adapter`. Manage User and PasswordReset models manually with Mongoose. JWT sessions are configured via `session: { strategy: "jwt" }`.
**Warning signs:** Credential login redirects back to login page with no error; no session is established.

### Pitfall 4: Account Enumeration in Forgot Password

**What goes wrong:** Responding differently when an email exists vs. does not exist leaks information to attackers.
**Why it happens:** Natural developer instinct to give helpful errors.
**How to avoid:** Always return the same generic message regardless of whether the user exists (locked decision D-08): "If that email exists, you'll receive a reset link." Do the DB lookup, send the email if user exists, but return the same 200 response either way.
**Warning signs:** API route returns 404 for missing email or different response time (use constant-time response).

### Pitfall 5: tsc --noEmit in lint-staged Receives File Args

**What goes wrong:** If `tsc --noEmit` is added to lint-staged's file globs, lint-staged appends the list of staged files as arguments. TypeScript interprets this as a file list override, ignoring `tsconfig.json` and type-checking only those files. Cross-file type errors will not be caught.
**Why it happens:** lint-staged design — it passes matched files as CLI args to each command.
**How to avoid:** Run `tsc --noEmit` in `.husky/pre-commit` directly (outside lint-staged), after lint-staged completes. This ensures tsc uses the full project tsconfig (D-16 exactly specifies this).
**Warning signs:** tsc succeeds during commit but fails in CI; cross-file type errors are missed.

### Pitfall 6: Google OAuth Redirect URI Mismatch

**What goes wrong:** Google OAuth callback fails with "redirect_uri_mismatch" in development or production.
**Why it happens:** The authorized redirect URI in Google Cloud Console must exactly match what NextAuth uses: `{NEXTAUTH_URL}/api/auth/callback/google`.
**How to avoid:** In Google Cloud Console, add both `http://localhost:3000/api/auth/callback/google` (dev) and the production URL. Set `NEXTAUTH_URL=http://localhost:3000` in `.env.local`.
**Warning signs:** OAuth flow redirects to an error page after Google sign-in; URL shows `error=redirect_uri_mismatch`.

### Pitfall 7: Async params/searchParams in Next.js 16 Page Components

**What goes wrong:** Accessing `props.params.token` synchronously in a page component throws a runtime error in Next.js 16.
**Why it happens:** Next.js 16 fully removed synchronous access to request-time APIs.
**How to avoid:** Always `const { token } = await props.params` and `const { token } = await props.searchParams` in page components. The `/reset-password?token=` page is particularly affected.
**Warning signs:** Runtime error mentioning async params; TypeScript error if using `npx next typegen` generated types.

---

## Code Examples

### Zod Auth Schema (schemas/auth.ts)

```typescript
import { z } from "zod"

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email"),
})

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8)
      .regex(/[A-Z]/)
      .regex(/[a-z]/)
      .regex(/[0-9]/),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
```

### PasswordReset Mongoose Model (lib/models/PasswordReset.ts)

```typescript
import mongoose, { Schema, Document } from "mongoose"

export interface IPasswordReset extends Document {
  email: string
  token: string
  expiresAt: Date
  used: boolean
}

const PasswordResetSchema = new Schema<IPasswordReset>({
  email: { type: String, required: true, index: true },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false },
})

// TTL index: MongoDB auto-deletes expired documents after expiresAt
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.models.PasswordReset ||
  mongoose.model<IPasswordReset>("PasswordReset", PasswordResetSchema)
```

### User Mongoose Model (lib/models/User.ts)

```typescript
import mongoose, { Schema, Document } from "mongoose"

export interface IUser extends Document {
  email: string
  name: string
  image?: string
  passwordHash?: string
  provider: "credentials" | "google"
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, required: true },
    image: { type: String },
    passwordHash: { type: String },
    provider: { type: String, enum: ["credentials", "google"], required: true },
  },
  { timestamps: true }
)

export default mongoose.models.User || mongoose.model<IUser>("User", UserSchema)
```

### .env.example

```bash
# MongoDB
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/trade-journal

# NextAuth
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Resend (from resend.com dashboard)
RESEND_API_KEY=
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` + `export middleware` | `proxy.ts` + `export proxy` | Next.js 16 (2025) | Must rename file and export |
| `getServerSession(authOptions)` | `await auth()` | NextAuth v5 | Universal function works everywhere |
| `import from "next-auth/middleware"` | `export { auth as proxy } from "@/lib/auth"` | NextAuth v5 | Proxy re-exports auth directly |
| Synchronous `params`, `searchParams` | `await props.params`, `await props.searchParams` | Next.js 16 | All page props are now Promises |
| `next lint` command | Run `eslint` CLI directly | Next.js 16 | `next lint` removed; use `eslint .` |
| `experimental.turbopack` config | Top-level `turbopack` config | Next.js 16 | Turbopack is stable and default |
| `serverRuntimeConfig` / `publicRuntimeConfig` | Environment variables + `NEXT_PUBLIC_` prefix | Next.js 16 | `next/config` removed |

**Deprecated/outdated:**
- `@next-auth/*` adapter packages: Renamed to `@auth/*` scope in v5 (though not used in this project)
- `next/legacy/image`: Removed in Next.js 16; use `next/image`
- `next lint` CLI command: Removed in Next.js 16; run `eslint` directly

---

## Open Questions

1. **Email sender domain for Resend**
   - What we know: Resend requires a verified sender domain for production. For local dev, `onboarding@resend.dev` works without verification.
   - What's unclear: Production domain is not specified in the spec.
   - Recommendation: Use `onboarding@resend.dev` for dev. Add a note in `.env.example` that a verified domain is needed for production.

2. **Google OAuth production callback URL**
   - What we know: Dev callback is `http://localhost:3000/api/auth/callback/google`.
   - What's unclear: Production domain not yet determined (no Vercel deployment configured in Phase 1).
   - Recommendation: Add a placeholder note in INFRA-05 env docs. Google Console update is a Phase 6/deployment task.

3. **Next.js 16 proxy.ts and NextAuth v5 beta compatibility**
   - What we know: NextAuth v5 docs still show `middleware.ts`; multiple 2026 blog posts confirm `proxy.ts` works with NextAuth v5.
   - What's unclear: Official NextAuth docs have not been updated to reflect the proxy.ts rename.
   - Recommendation: Use `proxy.ts` — it is the correct Next.js 16 convention. The auth export pattern (`export { auth as proxy }`) works identically.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` — Wave 0 task |
| Quick run command | `npx vitest run --passWithNoTests` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Password hashing + registration validation (Zod schema) | unit | `npx vitest run tests/auth.test.ts -t "registerSchema"` | Wave 0 |
| AUTH-01 | Register API route creates user with hashed password | integration (future Phase 6) | deferred | N/A |
| AUTH-02 | Google OAuth provider configured | manual | manual — requires browser OAuth flow | manual-only |
| AUTH-03 | JWT session persists | manual | manual — browser refresh test | manual-only |
| AUTH-04 | Password reset token: one-time use, expires in 1 hour | unit | `npx vitest run tests/password-reset.test.ts` | Wave 0 |
| AUTH-04 | Forgot-password email sends | manual | manual — requires Resend API key + mailbox | manual-only |
| AUTH-05 | Middleware protects dashboard routes | manual | manual — unauthenticated browser request | manual-only |
| INFRA-04 | Pre-commit hook runs linters | manual | `git commit` with intentional lint error | manual-only |
| INFRA-05 | .env.example is complete | manual | visual review against working .env.local | manual-only |
| UI-05 | Landing page renders without auth | manual | visual browser check at `http://localhost:3000/` | manual-only |

### Sampling Rate

- **Per task commit:** `npx vitest run --passWithNoTests` (exits 0 if no tests exist yet)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** All Vitest tests green + manual checklist complete before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.ts` — configure Vitest with jsdom environment and path aliases
- [ ] `tests/schemas/auth.test.ts` — covers registerSchema, loginSchema, resetPasswordSchema (AUTH-01)
- [ ] `tests/models/password-reset.test.ts` — token expiry logic and one-time-use flag (AUTH-04)

---

## Sources

### Primary (HIGH confidence)

- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16) — verified 2026-03-17; proxy.ts rename, async params, breaking changes
- [Auth.js Protecting Routes](https://authjs.dev/getting-started/session-management/protecting) — middleware/proxy pattern, authorized callback
- [Auth.js Migrating to v5](https://authjs.dev/getting-started/migrating-to-v5) — config structure, exports, session strategy
- [Auth.js Credentials Provider](https://authjs.dev/getting-started/authentication/credentials) — authorize function, JWT callbacks, TypeScript augmentation
- [Mongoose Next.js Docs](https://mongoosejs.com/docs/nextjs.html) — dbConnect singleton pattern
- [Resend Next.js Docs](https://resend.com/docs/send-with-nextjs) — route handler pattern, email template
- npm registry (verified 2026-03-22) — all package versions confirmed current

### Secondary (MEDIUM confidence)

- Multiple 2025-2026 blog posts cross-confirming proxy.ts with NextAuth v5 beta works in production
- [Next.js 16 release notes](https://nextjs.org/blog/next-16) — Turbopack default, React 19.2, ESLint flat config

### Tertiary (LOW confidence)

- None — all critical claims verified against official sources

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry 2026-03-22
- Architecture: HIGH — patterns verified against official authjs.dev and nextjs.org docs
- Pitfalls: HIGH — proxy.ts rename and credentials+adapter incompatibility verified from official Next.js 16 migration guide and NextAuth discussions
- Validation architecture: MEDIUM — Vitest 4.x config syntax not individually verified; standard Vitest config patterns are stable

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (30 days for stable libraries; NextAuth beta may release new version sooner)
