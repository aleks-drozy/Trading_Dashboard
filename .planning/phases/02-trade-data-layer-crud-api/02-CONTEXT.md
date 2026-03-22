# Phase 2: Trade Data Layer & CRUD API - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete Trade model, Zod schemas, calculation logic, and full CRUD API for trades including image upload. No UI work. Phase delivers: Trade Mongoose model, Zod trade schemas, lib/calculations.ts, and all 7 API routes. Phase 3 consumes these endpoints.

</domain>

<decisions>
## Implementation Decisions

### Response envelope
- **D-01:** All trade API routes use `{ data: T }` wrapper on success — matches the design spec
- **D-02:** List route returns `{ data: trades[], pagination: { page, totalPages, total } }` — pagination metadata nested under `pagination` key
- **D-03:** Single trade routes return `{ data: trade }` — same wrapper shape as list route
- **D-04:** Error responses use `{ error: string }` only in body — HTTP status code is in the header only (no `status` field in body). Consistent with existing auth routes.

### MongoDB connection caching
- **D-05:** Fix `lib/db.ts` to use a proper connection cache — store the connection promise in a `global` variable to reuse connections across requests in the same serverless process
- **D-06:** Implementation details (readyState check strategy) are Claude's discretion

### Cloudinary upload
- **D-07:** Max file size: 5 MB — enforce server-side before uploading to Cloudinary
- **D-08:** Cloudinary folder: `trade-journal/charts/{userId}` — per-user folder for clean organization
- **D-09:** Upload failure returns HTTP 500 error — the trade form treats upload separately from trade save (non-blocking at the UI level, but the upload endpoint itself is strict)
- **D-10:** Accept images only — validate MIME type server-side (jpg, png, gif, webp). Reject other file types with 400.

### Trade model and schema
- **D-11:** All P&L/R:R formulas are exactly as specified in `docs/superpowers/specs/2026-03-22-trading-journal-design.md` — direction-aware, asset-class-aware, with options using the 100-share multiplier
- **D-12:** `status` derived on save — `'closed'` requires BOTH `exitPrice` and `exitDate`; providing only one is rejected by Zod schema. No `exitPrice`/`exitDate` = `'open'`.
- **D-13:** Options-specific fields (`strikePrice`, `expirationDate`, `contractType`, `premium`) are optional at the Mongoose level. Zod schema enforces they are required when `assetClass === 'options'`.
- **D-14:** `pnl`, `pnlPercent`, and `riskRewardRatio` are calculated and stored on save — not computed at read time. Only calculated when trade is closed.
- **D-15:** Auth is handled entirely by `proxy.ts` middleware — individual API route handlers do NOT re-check auth. They do extract `userId` from the NextAuth session for database scoping.

### Claude's Discretion
- Connection cache implementation details in db.ts (readyState check strategy)
- Cloudinary Node SDK streaming vs buffer upload
- Mongoose pre-save hook vs API handler for status/calculation derivation
- Zod schema organization within `schemas/trade.ts` (separate vs combined create/update)

</decisions>

<specifics>
## Specific Ideas

- Design spec has exact P&L formulas — copy them verbatim into `lib/calculations.ts`, do not paraphrase
- For options: `entryPrice`/`exitPrice` are the underlying asset price (informational); `premium` is the entry cost per share of contract; `exitPrice` field stores the exit premium for options trades
- The `GET /api/trades/meta` route aggregates strategies and tags using MongoDB `$group` — returns `{ strategies: string[], tags: string[] }` for filter dropdown population in Phase 3

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Trade model, calculations, and API spec
- `docs/superpowers/specs/2026-03-22-trading-journal-design.md` — Complete data model, P&L formulas (including options), all API routes, query params, response shapes, and error handling decisions

### Existing patterns to replicate
- `lib/models/User.ts` — Mongoose model pattern (Schema + IUser interface + `mongoose.models.X || mongoose.model()` guard)
- `schemas/auth.ts` — Zod schema pattern (named exports + inferred types)
- `app/api/auth/register/route.ts` — API route handler pattern (safeParse → dbConnect → business logic → NextResponse.json)
- `lib/db.ts` — Connection module to be upgraded with caching in this phase

### Auth integration
- `proxy.ts` — Middleware that protects all `/api/*` routes (except `/api/auth/*`). Trade routes do not need their own auth checks.
- `lib/auth.ts` — NextAuth config. Session contains `user.id` needed for userId scoping in trade queries.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/db.ts`: Import and call `dbConnect()` at the top of every API handler — same pattern as auth routes. Phase 2 upgrades this module itself.
- `schemas/auth.ts`: Pattern for Zod schemas with named exports and `z.infer<typeof schema>` type exports. Replicate in `schemas/trade.ts`.
- `lib/models/User.ts`: Mongoose model pattern with IUser interface + Schema + model guard. Replicate for Trade model.

### Established Patterns
- API routes use `safeParse()` → check `.success` → return 400 on failure → proceed with `.data`
- Error responses: `NextResponse.json({ error: string }, { status: N })`
- Zod uses `.issues[0].message` (not `.errors`) to extract first error message — already established in Phase 1 (Zod v4 change)

### Integration Points
- Trade routes need `userId` from NextAuth session: `const session = await auth(); const userId = session!.user!.id`
- All trade queries must scope by `userId` — never return other users' trades
- `lib/auth.ts` exports `auth` — import and call it in route handlers to get the session

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-trade-data-layer-crud-api*
*Context gathered: 2026-03-22*
