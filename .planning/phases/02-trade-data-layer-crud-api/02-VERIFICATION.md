---
phase: 02-trade-data-layer-crud-api
verified: 2026-03-22T00:00:00Z
status: passed
score: 14/14 must-haves verified
re_verification: false
---

# Phase 2: Trade Data Layer + CRUD API — Verification Report

**Phase Goal:** Mongoose Trade model with pre-save P&L hook, Zod validation schemas, REST CRUD endpoints for trades (/api/trades collection + /api/trades/[id] single-trade), Cloudinary image upload endpoint, and trades meta aggregation endpoint. Full data layer for trade logging.
**Verified:** 2026-03-22
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | db.ts caches the connection promise in a global variable — no duplicate connections per serverless container | VERIFIED | `global.mongoose` declared, `cached.conn` and `cached.promise` used in `lib/db.ts` |
| 2 | Trade model has all fields from the design spec including options-specific fields | VERIFIED | ITrade interface in `lib/models/Trade.ts` has all 24+ fields: userId, symbol, assetClass, direction, entryPrice, exitPrice, quantity, stopLoss, takeProfit, entryDate, exitDate, status, pnl, pnlPercent, riskRewardRatio, strikePrice, expirationDate, contractType, premium, strategy, tags, notes, chartImageUrl, createdAt, updatedAt |
| 3 | Pre-save hook derives status and calculates P&L/pnlPercent/riskRewardRatio for closed trades | VERIFIED | `TradeSchema.pre("save", function () {...})` derives status from exitPrice+exitDate presence, calls `calculateTradeMetrics` for closed trades, clears metrics for open trades. Mongoose 9 supports sync pre-hooks without `next()`. |
| 4 | Calculation functions are direction-aware and asset-class-aware with 100-share multiplier for options | VERIFIED | `lib/calculations.ts` — options branch uses `* quantity * 100`; long/short branches diverge for all asset classes; `(entryPrice - stopLoss)` (long) and `(stopLoss - entryPrice)` (short) denominators present; returns `undefined` when denominator <= 0 |
| 5 | Zod schema rejects trades missing exitPrice when exitDate is provided, and vice versa | VERIFIED | `superRefine` in `schemas/trade.ts` — `applyCreateRefinements` and `applyUpdateRefinements` both enforce D-12 both-or-neither rule |
| 6 | Zod schema requires strikePrice, expirationDate, contractType, premium when assetClass is options | VERIFIED | D-13 block in both `applyCreateRefinements` and `applyUpdateRefinements` in `schemas/trade.ts` |
| 7 | strategy defaults to empty string and tags defaults to empty array | VERIFIED | `z.string().default("")` for strategy, `z.array(z.string()).default([])` for tags in `schemas/trade.ts` |
| 8 | POST /api/trades creates a trade scoped to authenticated user and returns { data: trade } with status 201 | VERIFIED | `app/api/trades/route.ts` — `new Trade({...parsed.data, userId})` + `.save()`, returns `{ data: trade }` with `{ status: 201 }` |
| 9 | GET /api/trades returns paginated trades for authenticated user with { data, pagination } | VERIFIED | `app/api/trades/route.ts` — `Trade.countDocuments(filter)` + `Trade.find(filter).sort().skip().limit().lean()`, returns `{ data: trades, pagination: { page, totalPages, total } }` |
| 10 | GET /api/trades supports filtering by assetClass, direction, status, strategy, tags, and date range | VERIFIED | All six filter params implemented plus `from`/`to` date range with `$gte`/`$lte`; tags use `$in` on split comma-list |
| 11 | GET /api/trades/[id] returns single trade, PUT updates via pre-save hook, DELETE returns 204 | VERIFIED | `app/api/trades/[id]/route.ts` — GET uses `.findOne({_id:id, userId}).lean()`, PUT uses `findOne + .set() + .save()` (no `findOneAndUpdate`), DELETE uses `.deleteOne()` + `new NextResponse(null, { status: 204 })` |
| 12 | All handlers return 404 when trade not found or not owned by user, 400 for invalid ObjectId | VERIFIED | `isValidObjectId(id)` guard + `Trade.findOne({ _id: id, userId })` ownership check in all three handlers |
| 13 | POST /api/upload accepts images up to 5 MB, returns { data: { url } }, rejects invalid files | VERIFIED | `app/api/upload/route.ts` — MIME check against `ALLOWED_TYPES`, `file.size > MAX_SIZE` (5MB) check, `uploadToCloudinary` call, returns `{ data: { url: result.secure_url } }` |
| 14 | GET /api/trades/meta returns { data: { strategies, tags } } aggregated from user's trades | VERIFIED | `app/api/trades/meta/route.ts` — `Trade.distinct("strategy", {...$ne:""})` + `Trade.aggregate([{$unwind:"$tags"},{$group},{$project}])`, returns `{ data: { strategies, tags } }` |

**Score:** 14/14 truths verified

---

### Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `lib/db.ts` | Cached MongoDB connection | VERIFIED | 33 lines; `global.mongoose`, `MongooseCache` interface, `cached.conn`/`cached.promise` pattern |
| `lib/models/Trade.ts` | Mongoose Trade model with pre-save hook | VERIFIED | 92 lines; exports default model + ITrade interface; pre-save hook calls `calculateTradeMetrics` |
| `lib/calculations.ts` | P&L, pnlPercent, R:R calculation functions | VERIFIED | 101 lines; exports `calculatePnl`, `calculatePnlPercent`, `calculateRiskReward`, `calculateTradeMetrics`, `TradeMetrics`, `TradeForCalculation` |
| `schemas/trade.ts` | Zod create and update schemas | VERIFIED | 83 lines; exports `tradeCreateSchema`, `tradeUpdateSchema`, `TradeCreateInput`, `TradeUpdateInput`; two `superRefine` applications |
| `app/api/trades/route.ts` | GET list + POST create endpoints | VERIFIED | 85 lines; exports GET and POST; full filtering/sorting/pagination in GET |
| `app/api/trades/[id]/route.ts` | GET single, PUT update, DELETE endpoints | VERIFIED | 93 lines; exports GET, PUT, DELETE; PUT uses findOne+set+save (not findOneAndUpdate) |
| `lib/cloudinary.ts` | Cloudinary upload helper | VERIFIED | 31 lines; `uploadToCloudinary` exported; lazy `ensureConfig()` — cloudinary.config NOT at module scope |
| `app/api/upload/route.ts` | POST image upload endpoint | VERIFIED | 43 lines; MIME validation, 5 MB limit, per-user folder `trade-journal/charts/${userId}` |
| `app/api/trades/meta/route.ts` | GET strategies+tags aggregation | VERIFIED | 27 lines; `Trade.distinct` + `Trade.aggregate` with pipeline; `new Types.ObjectId(userId)` for aggregation |
| `.env.example` | Environment variable documentation | VERIFIED | Contains `CLOUDINARY_CLOUD_NAME=`, `CLOUDINARY_API_KEY=`, `CLOUDINARY_API_SECRET=` |
| `__tests__/lib/calculations.test.ts` | Unit tests for P&L calculations | VERIFIED | 12 real assertions covering long/short for stocks and options, pnlPercent, R:R, and calculateTradeMetrics |
| `__tests__/schemas/trade.test.ts` | Unit tests for Zod trade schemas | VERIFIED | 9 assertions covering D-12 and D-13 cross-field rules, defaults, and partial updates |
| `__tests__/api/upload.test.ts` | Test stubs for upload validation | VERIFIED | 2 assertions confirming constants (Wave 0 stubs as planned) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/models/Trade.ts` | `lib/calculations.ts` | `calculateTradeMetrics` call in pre-save hook | WIRED | Line 2: `import { calculateTradeMetrics } from "@/lib/calculations"`; line 72: called in pre-save with trade fields |
| `app/api/trades/route.ts` | `lib/models/Trade.ts` | `Trade.create`, `Trade.find`, `Trade.countDocuments` | WIRED | `new Trade(...)` + `.save()` (POST), `Trade.countDocuments(filter)` + `Trade.find(filter)` (GET) |
| `app/api/trades/route.ts` | `schemas/trade.ts` | `tradeCreateSchema.safeParse` | WIRED | Line 5 import; line 12 `tradeCreateSchema.safeParse(body)` |
| `app/api/trades/route.ts` | `lib/auth.ts` | `session!.user!.id` | WIRED | Line 2 import; lines 8-9 `await auth()` + `session!.user!.id` |
| `app/api/trades/[id]/route.ts` | `lib/models/Trade.ts` | `Trade.findOne`, `trade.save`, `trade.deleteOne` | WIRED | All three handlers use `Trade.findOne({ _id: id, userId })` with ownership scoping |
| `app/api/trades/[id]/route.ts` | `schemas/trade.ts` | `tradeUpdateSchema.safeParse` | WIRED | Line 6 import; line 69 `tradeUpdateSchema.safeParse(body)` in PUT |
| `app/api/upload/route.ts` | `lib/cloudinary.ts` | `uploadToCloudinary()` call | WIRED | Line 3 import; line 37 `await uploadToCloudinary(buffer, folder)` |
| `app/api/trades/meta/route.ts` | `lib/models/Trade.ts` | `Trade.distinct()` and `Trade.aggregate()` | WIRED | Lines 14-21 in GET handler; both run in `Promise.all` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TRADE-01 | 02-01, 02-03 | Create trade with symbol, asset class, direction, entry price, quantity, entry date | SATISFIED | `lib/models/Trade.ts` required fields + POST `/api/trades` |
| TRADE-02 | 02-02 | Close trade with exit price and exit date (both required together) | SATISFIED | `schemas/trade.ts` D-12 rule; Mongoose pre-save derives "closed" status |
| TRADE-03 | 02-01 | P&L, pnlPercent, riskRewardRatio calculated and stored on save | SATISFIED | `lib/calculations.ts` + pre-save hook in `lib/models/Trade.ts` |
| TRADE-04 | 02-02 | Options trades include strikePrice, expirationDate, contractType, premium | SATISFIED | Model fields + D-13 Zod validation in `schemas/trade.ts` |
| TRADE-05 | 02-02 | Strategy label and free-form tags | SATISFIED | Model fields, Zod schema with defaults, filter support in GET |
| TRADE-06 | 02-02 | Notes/reflection text | SATISFIED | `notes` field in model and schema with default "" |
| TRADE-07 | 02-05 | Chart screenshot upload via Cloudinary | SATISFIED | `lib/cloudinary.ts` + `app/api/upload/route.ts` with per-user folder |
| TRADE-08 | 02-03, 02-04 | Edit any field of existing trade | SATISFIED | PUT `/api/trades/[id]` with `tradeUpdateSchema` (partial) + `trade.set() + .save()` |
| TRADE-09 | 02-04 | Delete a trade | SATISFIED | DELETE `/api/trades/[id]` returns 204 |
| INFRA-05 | 02-05 | Environment variables documented in .env.example | SATISFIED | `.env.example` has all three Cloudinary vars (also satisfies Phase 1 base requirement) |

**Notes on requirement scoping:**
- TRADE-01 appears in both plans 02-01 and 02-03: the model satisfies the "create" capability and the API endpoint completes the user-facing capability. No conflict.
- INFRA-05 was claimed by both Phase 1 (initial `.env.example`) and Phase 2 plan 02-05 (Cloudinary additions). Both contributions exist and are valid — the Cloudinary section is present in `.env.example`.

**Orphaned requirements check:** The phase plans collectively claim TRADE-01 through TRADE-09 and INFRA-05. REQUIREMENTS.md maps TRADE-01 through TRADE-09 to Phase 2. No Phase 2 requirements are orphaned.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `__tests__/api/upload.test.ts` | 7-8 | Wave 0 stub test that asserts on a constant, not the route | Info | Expected per VALIDATION.md Wave 0 design — does not affect route behavior |
| `lib/models/Trade.ts` | 63 | Pre-save hook `function()` with no `next()` call | Info | Valid in Mongoose 9 — synchronous pre-hooks without `next` are supported when the function is not async and does not return a Promise. TypeScript compiles cleanly. |

No blockers or warnings found.

---

### Human Verification Required

#### 1. Cloudinary Upload — Live Integration

**Test:** Start dev server with valid `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` in `.env.local`. POST a multipart/form-data request with a valid image file to `/api/upload`.
**Expected:** Response `{ data: { url: "https://res.cloudinary.com/..." } }` with a valid secure_url pointing to the uploaded image.
**Why human:** External service integration — the upload pipeline (`Buffer -> upload_stream -> Cloudinary`) cannot be verified by static code analysis alone.

#### 2. Pre-Save Hook P&L Recalculation on PUT

**Test:** Create an open trade via POST `/api/trades` (no exit fields). Then PUT `/api/trades/{id}` with `exitPrice` and `exitDate` to close it.
**Expected:** The returned trade object has non-null `pnl`, `pnlPercent`, and (if stopLoss was set) `riskRewardRatio`. `status` is `"closed"`.
**Why human:** Requires live MongoDB — the pre-save hook fires on `.save()` which is a runtime Mongoose behaviour that cannot be exercised without a database connection.

---

### Gaps Summary

No gaps found. All 14 observable truths verified. All 13 artifacts exist, are substantive (not stubs), and are wired. All 8 key links confirmed. All 10 requirements (TRADE-01 through TRADE-09, INFRA-05) are satisfied by code evidence. TypeScript compiles with zero errors. 26 tests pass across 3 test files.

---

_Verified: 2026-03-22_
_Verifier: Claude (gsd-verifier)_
