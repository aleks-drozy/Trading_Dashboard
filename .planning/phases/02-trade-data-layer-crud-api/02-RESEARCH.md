# Phase 2: Trade Data Layer & CRUD API - Research

**Researched:** 2026-03-22
**Domain:** Mongoose data modeling, Zod v4 conditional validation, Cloudinary Node.js SDK, Next.js App Router API routes, MongoDB aggregation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Response envelope**
- D-01: All trade API routes use `{ data: T }` wrapper on success
- D-02: List route returns `{ data: trades[], pagination: { page, totalPages, total } }`
- D-03: Single trade routes return `{ data: trade }`
- D-04: Error responses use `{ error: string }` only — no `status` field in body; HTTP status in header only

**MongoDB connection caching**
- D-05: Fix `lib/db.ts` to use a proper connection cache — store the connection promise in a `global` variable
- D-06: Implementation details (readyState check strategy) are Claude's discretion

**Cloudinary upload**
- D-07: Max file size: 5 MB — enforce server-side before uploading
- D-08: Cloudinary folder: `trade-journal/charts/{userId}` — per-user folder
- D-09: Upload failure returns HTTP 500
- D-10: Accept images only — validate MIME type (jpg, png, gif, webp); reject others with 400

**Trade model and schema**
- D-11: All P&L/R:R formulas exactly as specified in the design spec — direction-aware, asset-class-aware, options use 100-share multiplier
- D-12: `status` derived on save — `'closed'` requires BOTH `exitPrice` and `exitDate`; providing only one is rejected by Zod. No exit fields = `'open'`.
- D-13: Options-specific fields optional at Mongoose level; Zod enforces required when `assetClass === 'options'`
- D-14: `pnl`, `pnlPercent`, `riskRewardRatio` calculated and stored on save — not at read time; only calculated when trade is closed
- D-15: Auth handled entirely by `proxy.ts` middleware — individual route handlers do NOT re-check auth; they DO extract `userId` from session for DB scoping

### Claude's Discretion
- Connection cache implementation details in `lib/db.ts` (readyState check strategy)
- Cloudinary Node SDK: streaming vs buffer upload approach
- Mongoose pre-save hook vs API handler for status/calculation derivation
- Zod schema organization within `schemas/trade.ts` (separate vs combined create/update)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRADE-01 | User can create a trade with symbol, asset class, direction, entry price, quantity, and entry date | Trade Mongoose model + POST /api/trades handler |
| TRADE-02 | User can close a trade by providing exit price and exit date (both required together) | Zod superRefine both-or-neither pattern; D-12 |
| TRADE-03 | P&L, pnlPercent, and riskRewardRatio calculated and stored on save (direction-aware) | lib/calculations.ts with exact spec formulas; pre-save hook pattern |
| TRADE-04 | Options trades include strike price, expiration date, contract type, and premium | Mongoose optional fields + Zod conditional validation (superRefine when assetClass === 'options') |
| TRADE-05 | User can add a strategy label and free-form tags to a trade | strategy: string + tags: string[] on Trade model |
| TRADE-06 | User can write notes/reflection text on a trade | notes: string on Trade model |
| TRADE-07 | User can upload a chart screenshot image (server-side Cloudinary upload) | POST /api/upload with Cloudinary Node SDK v2 buffer upload |
| TRADE-08 | User can edit any field of an existing trade | PUT /api/trades/[id] with recalculation on update |
| TRADE-09 | User can delete a trade | DELETE /api/trades/[id] |
| INFRA-05 | Environment variables documented in .env.example | Add CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET |
</phase_requirements>

---

## Summary

Phase 2 builds the entire data layer and API surface that Phases 3-6 depend on. The work splits into four domains: (1) the Mongoose Trade model with optional options-specific fields and a pre-save hook for status/calculation derivation; (2) Zod v4 schemas with conditional validation using `superRefine` to enforce both-or-neither for `exitPrice`/`exitDate` and required options fields when `assetClass === 'options'`; (3) a `lib/calculations.ts` module implementing the exact spec formulas verbatim; and (4) seven API route handlers following the patterns established in Phase 1.

The project already has the core infrastructure in place. `proxy.ts` handles auth centrally (AUTH-05 was implemented in Phase 1 Plan 01-03, though REQUIREMENTS.md still shows it as pending). The `lib/db.ts` connection module needs to be upgraded with a global connection cache — the current implementation calls `mongoose.connect()` on every request with no deduplication. The Cloudinary Node SDK is not yet installed; server-side upload uses `uploader.upload_stream()` wrapped in a Promise, fed with a Buffer from `file.arrayBuffer()`.

A key decision point is **where to put status/P&L derivation**: the Mongoose pre-save hook approach centralizes the logic and runs on every `.save()` call, but it does NOT fire on `findOneAndUpdate()` / `updateOne()`. For the PUT handler, derivation must be recalculated in the handler before calling the update, OR the handler must use `.findById()` + field mutation + `.save()` (which fires the hook). Using `.save()` for both create and update is the simplest pattern given the small number of callers.

**Primary recommendation:** Use Mongoose pre-save hook for status/calculation derivation, and implement the PUT handler with `findById()` + field assignment + `.save()` to ensure the hook fires on updates.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mongoose | 9.3.1 | MongoDB ODM — schemas, models, queries | Already installed; used in Phase 1 |
| zod | 4.3.6 | Schema validation shared frontend/backend | Already installed; v4 with `.issues` API |
| cloudinary | 2.9.0 | Cloudinary Node.js SDK — server-side upload | Official SDK; current version verified |
| next | 16.2.1 | App Router with Route Handlers | Already installed |
| next-auth | 5.0.0-beta.30 | Auth — session access in route handlers | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| mongodb-memory-server | 11.0.1 | In-memory MongoDB for integration tests | All integration tests (INFRA-02) |

### What Is NOT Yet Installed
| Package | Install Command | Needed For |
|---------|----------------|------------|
| cloudinary | `npm install cloudinary` | POST /api/upload |
| mongodb-memory-server | `npm install --save-dev mongodb-memory-server` | Integration tests (Phase 6, but setup can start now) |

**Version verification (npm registry, 2026-03-22):**
- cloudinary: 2.9.0 (current)
- mongodb-memory-server: 11.0.1 (current)
- mongoose: 9.3.1 (current — already in package.json)
- zod: 4.3.6 (current — already in package.json)

**Installation:**
```bash
npm install cloudinary
```

---

## Architecture Patterns

### Recommended Project Structure (Phase 2 additions)

```
lib/
├── db.ts                    # UPGRADE: add global connection cache
├── calculations.ts          # NEW: P&L, pnlPercent, R:R formulas
├── cloudinary.ts            # NEW: configured Cloudinary client + upload helper
└── models/
    └── Trade.ts             # NEW: Mongoose Trade model with pre-save hook

schemas/
└── trade.ts                 # NEW: Zod create/update schemas

app/api/
├── trades/
│   ├── route.ts             # NEW: GET list + POST create
│   ├── [id]/
│   │   └── route.ts         # NEW: GET single + PUT update + DELETE
│   └── meta/
│       └── route.ts         # NEW: GET strategies+tags aggregation
└── upload/
    └── route.ts             # NEW: POST Cloudinary image upload
```

### Pattern 1: Mongoose Model with Pre-Save Hook

**What:** Schema + interface + model guard + pre-save hook for derived fields
**When to use:** All derived fields (status, pnl, pnlPercent, riskRewardRatio)

```typescript
// Source: lib/models/User.ts (established project pattern) + mongoosejs.com/docs/middleware
import mongoose, { Schema, Document, Types } from "mongoose"

export interface ITrade extends Document {
  userId: Types.ObjectId
  symbol: string
  assetClass: "stock" | "crypto" | "forex" | "options"
  direction: "long" | "short"
  // ... all fields
  status: "open" | "closed"
  pnl?: number
  pnlPercent?: number
  riskRewardRatio?: number
}

const TradeSchema = new Schema<ITrade>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    assetClass: { type: String, enum: ["stock", "crypto", "forex", "options"], required: true },
    direction: { type: String, enum: ["long", "short"], required: true },
    // options-specific — optional at Mongoose level
    strikePrice: { type: Number },
    expirationDate: { type: Date },
    contractType: { type: String, enum: ["call", "put"] },
    premium: { type: Number },
    // trade data
    entryPrice: { type: Number, required: true },
    exitPrice: { type: Number },
    quantity: { type: Number, required: true },
    stopLoss: { type: Number },
    takeProfit: { type: Number },
    entryDate: { type: Date, required: true },
    exitDate: { type: Date },
    status: { type: String, enum: ["open", "closed"], required: true },
    pnl: { type: Number },
    pnlPercent: { type: Number },
    riskRewardRatio: { type: Number },
    // context
    strategy: { type: String, default: "" },
    tags: { type: [String], default: [] },
    notes: { type: String, default: "" },
    chartImageUrl: { type: String },
  },
  { timestamps: true }
)

TradeSchema.pre("save", function (next) {
  // Derive status
  this.status =
    this.exitPrice !== undefined && this.exitDate !== undefined ? "closed" : "open"

  // Calculate P&L only for closed trades
  if (this.status === "closed") {
    const { pnl, pnlPercent, riskRewardRatio } = calculateTradeMetrics(this)
    this.pnl = pnl
    this.pnlPercent = pnlPercent
    this.riskRewardRatio = riskRewardRatio
  } else {
    this.pnl = undefined
    this.pnlPercent = undefined
    this.riskRewardRatio = undefined
  }

  next()
})

export default mongoose.models.Trade || mongoose.model<ITrade>("Trade", TradeSchema)
```

**CRITICAL:** Pre-save hook ONLY fires on `.save()` — not on `findOneAndUpdate()` or `updateOne()`. The PUT handler must use `findById()` + assign fields + `.save()` to ensure the hook fires.

### Pattern 2: db.ts with Global Connection Cache

**What:** Module-level global variable caches the connection promise
**When to use:** Every serverless environment — prevents connection storms

```typescript
// Source: vercel/community discussions/424 (verified pattern)
import mongoose from "mongoose"

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI environment variable is not defined")
}

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

// Declare on global to persist across hot reloads in dev
declare global {
  // eslint-disable-next-line no-var
  var mongoose: MongooseCache | undefined
}

const cached: MongooseCache = global.mongoose ?? { conn: null, promise: null }
global.mongoose = cached

async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then((m) => m)
  }

  cached.conn = await cached.promise
  return cached.conn
}

export default dbConnect
```

**Why this works:** In serverless (Vercel), execution containers are reused between invocations. Storing the promise on `global` means the second request in the same container reuses the connection instead of creating a new one. Without this, each cold start creates a new connection that is never properly closed, exhausting the Atlas connection pool.

### Pattern 3: API Route Handler Structure

**What:** Established Phase 1 pattern — safeParse → dbConnect → business logic → respond
**When to use:** All trade route handlers

```typescript
// Source: app/api/auth/register/route.ts (established pattern)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import dbConnect from "@/lib/db"
import Trade from "@/lib/models/Trade"
import { tradeCreateSchema } from "@/schemas/trade"

export async function POST(req: NextRequest) {
  const session = await auth()
  const userId = session!.user!.id  // proxy.ts guarantees session exists

  const body = await req.json()
  const parsed = tradeCreateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    )
  }

  await dbConnect()
  const trade = await Trade.create({ ...parsed.data, userId })

  return NextResponse.json({ data: trade }, { status: 201 })
}
```

### Pattern 4: Zod Conditional Validation with superRefine

**What:** superRefine enforces "both or neither" for exitPrice/exitDate and required options fields
**When to use:** Any cross-field dependency in Zod v4

```typescript
// Source: zod.dev/api (verified)
import { z } from "zod"

export const tradeCreateSchema = z
  .object({
    symbol: z.string().min(1, "Symbol is required"),
    assetClass: z.enum(["stock", "crypto", "forex", "options"]),
    direction: z.enum(["long", "short"]),
    // options-specific — optional at schema level; enforced by superRefine
    strikePrice: z.number().positive().optional(),
    expirationDate: z.string().datetime().optional(),
    contractType: z.enum(["call", "put"]).optional(),
    premium: z.number().positive().optional(),
    // trade data
    entryPrice: z.number().positive("Entry price must be positive"),
    exitPrice: z.number().positive().optional(),
    quantity: z.number().positive("Quantity must be positive"),
    stopLoss: z.number().positive().optional(),
    takeProfit: z.number().positive().optional(),
    entryDate: z.string().datetime(),
    exitDate: z.string().datetime().optional(),
    // context
    strategy: z.string().default(""),
    tags: z.array(z.string()).default([]),
    notes: z.string().default(""),
    chartImageUrl: z.string().url().optional(),
  })
  .superRefine((data, ctx) => {
    // D-12: exitPrice and exitDate must be provided together or not at all
    const hasExitPrice = data.exitPrice !== undefined
    const hasExitDate = data.exitDate !== undefined
    if (hasExitPrice !== hasExitDate) {
      ctx.addIssue({
        code: "custom",
        message: "exitPrice and exitDate must both be provided to close a trade",
        path: hasExitPrice ? ["exitDate"] : ["exitPrice"],
      })
    }

    // D-13: options fields required when assetClass === 'options'
    if (data.assetClass === "options") {
      if (data.strikePrice === undefined)
        ctx.addIssue({ code: "custom", message: "strikePrice is required for options trades", path: ["strikePrice"] })
      if (data.expirationDate === undefined)
        ctx.addIssue({ code: "custom", message: "expirationDate is required for options trades", path: ["expirationDate"] })
      if (data.contractType === undefined)
        ctx.addIssue({ code: "custom", message: "contractType is required for options trades", path: ["contractType"] })
      if (data.premium === undefined)
        ctx.addIssue({ code: "custom", message: "premium is required for options trades", path: ["premium"] })
    }
  })

export type TradeCreateInput = z.infer<typeof tradeCreateSchema>
```

**Note on update schema:** The update schema wraps all fields in `.partial()` but re-applies the same superRefine cross-field rules. Use `tradeCreateSchema.partial().superRefine(...)` or define a separate `tradeUpdateSchema`.

### Pattern 5: Cloudinary Server-Side Upload

**What:** Read file from FormData, validate, upload to Cloudinary via `upload_stream` wrapped in Promise
**When to use:** POST /api/upload route handler

```typescript
// Source: cloudinary.com/documentation/node_image_and_video_upload
import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Upload from Buffer — wraps upload_stream in a Promise
function uploadToCloudinary(
  buffer: Buffer,
  folder: string
): Promise<{ secure_url: string; public_id: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error || !result) return reject(error)
        resolve({ secure_url: result.secure_url, public_id: result.public_id })
      }
    )
    stream.end(buffer)
  })
}

// Route handler
export async function POST(req: NextRequest) {
  const session = await auth()
  const userId = session!.user!.id

  const formData = await req.formData()
  const file = formData.get("file") as File | null

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  // D-10: MIME type validation
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Only image files are accepted (jpg, png, gif, webp)" }, { status: 400 })
  }

  // D-07: 5 MB size limit
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "File size must not exceed 5 MB" }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const folder = `trade-journal/charts/${userId}`  // D-08

  try {
    const result = await uploadToCloudinary(buffer, folder)
    return NextResponse.json({ data: { url: result.secure_url } })
  } catch {
    return NextResponse.json({ error: "Image upload failed" }, { status: 500 })  // D-09
  }
}
```

### Pattern 6: Calculations Module

**What:** Pure functions for P&L/R:R — direction-aware, asset-class-aware
**When to use:** Called from pre-save hook (and unit-tested in isolation)

```typescript
// Source: docs/superpowers/specs/2026-03-22-trading-journal-design.md — verbatim formulas (D-11)

export interface TradeMetrics {
  pnl: number
  pnlPercent: number
  riskRewardRatio?: number
}

export function calculatePnl(
  assetClass: "stock" | "crypto" | "forex" | "options",
  direction: "long" | "short",
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  premium?: number
): number {
  if (assetClass === "options" && premium !== undefined) {
    // exitPrice field stores the exit premium for options (per spec note)
    const exitPremium = exitPrice
    return direction === "long"
      ? (exitPremium - premium) * quantity * 100
      : (premium - exitPremium) * quantity * 100
  }
  // stocks, crypto, forex
  return direction === "long"
    ? (exitPrice - entryPrice) * quantity
    : (entryPrice - exitPrice) * quantity
}

export function calculatePnlPercent(
  assetClass: "stock" | "crypto" | "forex" | "options",
  pnl: number,
  entryPrice: number,
  quantity: number,
  premium?: number
): number {
  if (assetClass === "options" && premium !== undefined) {
    return (pnl / (premium * quantity * 100)) * 100
  }
  return (pnl / (entryPrice * quantity)) * 100
}

export function calculateRiskReward(
  direction: "long" | "short",
  entryPrice: number,
  exitPrice: number,
  stopLoss: number
): number | undefined {
  if (direction === "long") {
    const denominator = entryPrice - stopLoss
    if (denominator <= 0) return undefined
    return (exitPrice - entryPrice) / denominator
  } else {
    const denominator = stopLoss - entryPrice
    if (denominator <= 0) return undefined
    return (entryPrice - exitPrice) / denominator
  }
}
```

### Pattern 7: GET /api/trades with Filtering, Sorting, Pagination

**What:** Build a Mongoose query filter object from URL search params
**When to use:** GET /api/trades list handler

```typescript
// Source: design spec query params table + Mongoose docs
export async function GET(req: NextRequest) {
  const session = await auth()
  const userId = session!.user!.id

  const { searchParams } = req.nextUrl
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20"))
  const sortBy = searchParams.get("sortBy") ?? "entryDate"
  const sortDir = searchParams.get("sortDir") === "asc" ? 1 : -1

  // Build filter — always scope to userId
  const filter: Record<string, unknown> = { userId }
  if (searchParams.get("assetClass")) filter.assetClass = searchParams.get("assetClass")
  if (searchParams.get("direction")) filter.direction = searchParams.get("direction")
  if (searchParams.get("status")) filter.status = searchParams.get("status")
  if (searchParams.get("strategy")) filter.strategy = searchParams.get("strategy")
  if (searchParams.get("tags")) filter.tags = { $in: searchParams.get("tags")!.split(",") }
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  if (from || to) {
    filter.entryDate = {}
    if (from) (filter.entryDate as Record<string, unknown>).$gte = new Date(from)
    if (to) (filter.entryDate as Record<string, unknown>).$lte = new Date(to)
  }

  await dbConnect()
  const total = await Trade.countDocuments(filter)
  const trades = await Trade.find(filter)
    .sort({ [sortBy]: sortDir })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean()

  return NextResponse.json({
    data: trades,
    pagination: { page, totalPages: Math.ceil(total / limit), total },
  })
}
```

### Pattern 8: GET /api/trades/meta Aggregation

**What:** MongoDB `$group` to collect unique strategy and tag values per user
**When to use:** Filter dropdown population in Phase 3

```typescript
// Source: design spec, MongoDB aggregation docs
await dbConnect()
const [strategies, tagsResult] = await Promise.all([
  Trade.distinct("strategy", { userId, strategy: { $ne: "" } }),
  Trade.aggregate([
    { $match: { userId: new Types.ObjectId(userId) } },
    { $unwind: "$tags" },
    { $group: { _id: "$tags" } },
    { $project: { _id: 0, tag: "$_id" } },
  ]),
])
const tags = tagsResult.map((r: { tag: string }) => r.tag)

return NextResponse.json({ data: { strategies, tags } })
```

### Anti-Patterns to Avoid

- **Using `findOneAndUpdate()` in the PUT handler:** The pre-save hook does NOT fire for query-based updates. Always `findById()` + assign + `.save()` so the hook fires and derived fields are recalculated.
- **Rechecking auth in route handlers:** `proxy.ts` has already verified auth before the handler runs. Calling `auth()` in handlers is only needed to extract `userId`, not to gate access.
- **Returning `{ error, status }` in body:** Per D-04, the body is `{ error: string }` only. The status code is the HTTP response status. The design spec's `{ error, status }` format is overridden by D-04.
- **Opening Cloudinary client at module scope:** Verify env vars are present at runtime, not import time. Configure inside the route handler or inside `lib/cloudinary.ts` without throwing at module load.
- **Using mongoose.connect() without caching:** Creates a new connection on every cold start in serverless. Always check `cached.conn` first.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image upload to cloud | Custom multipart streaming | `cloudinary.uploader.upload_stream()` | Handles resumable upload, error codes, URL generation, CDN |
| MongoDB connection pooling | Manual pool management | Mongoose connection cache pattern with `global.mongoose` | Serverless requires promise-based deduplication |
| Conditional schema validation | Nested `if` checks in handlers | Zod `superRefine()` | Single source of truth, runs on both client and server |
| Unique strategy/tag listing | Separate `Tag` / `Strategy` collection | MongoDB `$distinct` + `$group` aggregation | Free-form strings need no separate collection; aggregated on demand |
| MIME type detection from file contents | Magic-byte inspection library | `file.type` from FormData + allowlist check | MIME type provided by browser is sufficient; server-side MIME validation from content headers is overkill for v1 |

**Key insight:** The Cloudinary SDK handles all the complexity of multi-part upload, retry logic, transformation options, and CDN propagation. The pre-save hook pattern keeps derived field logic in one place regardless of how many callers create or update trades.

---

## Common Pitfalls

### Pitfall 1: Pre-Save Hook Does Not Fire on Query Updates
**What goes wrong:** `Trade.findByIdAndUpdate(id, { exitPrice, exitDate })` saves the exit data but `status` stays `'open'` and `pnl` is never calculated.
**Why it happens:** Mongoose document middleware (pre/post `save`) does not fire on `findOneAndUpdate`, `updateOne`, `findByIdAndUpdate` — these are query middleware, not document middleware.
**How to avoid:** Implement the PUT handler as: `const trade = await Trade.findById(id); trade.set(updates); await trade.save()`. The pre-save hook then fires.
**Warning signs:** Updating a trade with exit price/date but status still shows `'open'` in the response.

### Pitfall 2: MongoDB Connection Pool Exhaustion
**What goes wrong:** Every API request in cold-start creates a new connection, eventually hitting Atlas's connection limit (especially on the free tier: 500 connections).
**Why it happens:** The current `lib/db.ts` calls `mongoose.connect()` unconditionally — it doesn't check if a connection already exists.
**How to avoid:** Implement the `global.mongoose` cache pattern (D-05/D-06). Store the connection promise, not just the connection, so concurrent requests during the initial connect share the same promise.
**Warning signs:** Atlas "too many connections" errors in logs, slow response times after sustained load.

### Pitfall 3: Zod superRefine Runs AFTER Base Schema Validation
**What goes wrong:** superRefine does not fire if the base schema fails — so you can't report options-field errors if `assetClass` itself is invalid.
**Why it happens:** Zod evaluates `superRefine` only when the base object validation passes. This is intentional behavior.
**How to avoid:** Ensure `assetClass` is always required in the base schema (not optional). The superRefine for options fields will then run when `assetClass === 'options'`.
**Warning signs:** Missing validation errors on options fields when assetClass is also wrong.

### Pitfall 4: `exitPrice` Semantics Differ for Options
**What goes wrong:** For options trades, `exitPrice` is the **exit premium** (not the underlying price at exit). If P&L is calculated as `(exitPrice - entryPrice) * quantity`, the result is wrong for options.
**Why it happens:** The field name is overloaded — spec note says "`exitPrice` field stores the exit premium for options trades."
**How to avoid:** In `calculatePnl()`, branch on `assetClass === 'options'` and treat `exitPrice` as `exitPremium`. Document this prominently in the calculations file.
**Warning signs:** Options P&L values that are 100x too small or completely wrong relative to actual contract value.

### Pitfall 5: R:R Calculation with Zero or Negative Denominator
**What goes wrong:** Division by zero or negative R:R when `stopLoss` is absent or equals `entryPrice`.
**Why it happens:** R:R formula denominator = `entryPrice - stopLoss` (long) or `stopLoss - entryPrice` (short). If no stopLoss was set, the calculation is undefined.
**How to avoid:** `stopLoss` is optional on the Trade model. `calculateRiskReward()` should return `undefined` (not throw) when stopLoss is absent or the denominator is ≤ 0.
**Warning signs:** NaN or Infinity in `riskRewardRatio` field in DB.

### Pitfall 6: Route Conflict — /api/trades/meta vs /api/trades/[id]
**What goes wrong:** Next.js may match `/api/trades/meta` against the `[id]` dynamic segment before checking the static `meta` route.
**Why it happens:** Next.js App Router matches static segments before dynamic segments. The conflict only arises if both are in the same directory at the same level.
**How to avoid:** Create `app/api/trades/meta/route.ts` as a separate directory alongside `app/api/trades/[id]/route.ts`. Static directories take priority over dynamic segments in App Router.
**Warning signs:** `GET /api/trades/meta` returns a 404 or tries to find a trade with id="meta".

### Pitfall 7: Cloudinary Config at Module Load Time
**What goes wrong:** Build fails or throws at import time when Cloudinary env vars are absent (e.g. in CI without `.env.local`).
**Why it happens:** If `cloudinary.config({...})` is called at module top level, it runs at build/import time where env vars may not be present.
**How to avoid:** Call `cloudinary.config()` inside the request handler or inside a lazily-called helper function — the same pattern used in Phase 1 for Resend (D from STATE.md).
**Warning signs:** Build-time error: "cloudinary config not found" or similar.

---

## Code Examples

Verified patterns from official sources and established project code:

### Extracting userId from Session in Route Handler
```typescript
// Source: lib/auth.ts + types/next-auth.d.ts (existing project code)
import { auth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await auth()
  const userId = session!.user!.id  // session guaranteed by proxy.ts
  // ...
}
```

### Error Response Pattern (D-04)
```typescript
// Source: app/api/auth/register/route.ts (established pattern)
return NextResponse.json({ error: "Not found" }, { status: 404 })
// NOT: { error: "Not found", status: 404 } — D-04 forbids status field in body
```

### Zod Error Extraction (Zod v4)
```typescript
// Source: STATE.md — "Zod v4 uses .issues (not .errors) on ZodError"
if (!parsed.success) {
  return NextResponse.json(
    { error: parsed.error.issues[0].message },
    { status: 400 }
  )
}
```

### Ownership Check for Single Trade Routes
```typescript
// Pattern: always scope to userId to prevent cross-user access
const trade = await Trade.findOne({ _id: id, userId })
if (!trade) {
  return NextResponse.json({ error: "Trade not found" }, { status: 404 })
}
```

### MongoDB ObjectId Safety Check
```typescript
import { isValidObjectId } from "mongoose"

if (!isValidObjectId(params.id)) {
  return NextResponse.json({ error: "Invalid trade ID" }, { status: 400 })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` + `export middleware` | `proxy.ts` + `export proxy` | Next.js 16 | File is named `proxy.ts` — already correct in this project |
| `mongoose.connect()` per request | Global connection promise cache | Serverless era | Required for Atlas free tier stability on Vercel |
| Cloudinary direct browser upload | Server-side upload via API route | Security best practice | Keeps API keys off client; already decided (out of scope note in REQUIREMENTS.md) |
| Zod `.errors` on ZodError | Zod v4 `.issues` on ZodError | Zod v4 | Already handled in Phase 1 — replicate in trade schemas |

**AUTH-05 status:** REQUIREMENTS.md marks AUTH-05 as pending, but `proxy.ts` was created and verified working in Phase 1 Plan 01-03. Trade routes automatically inherit protection. No additional middleware work is needed in Phase 2.

---

## Open Questions

1. **`lib/cloudinary.ts` — configure at module scope or lazily?**
   - What we know: Phase 1 established that Resend client must be instantiated inside handlers (not at module scope) because env vars absent at build time throw errors.
   - What's unclear: Cloudinary SDK's behavior when `cloudinary.config()` is called with undefined values — whether it throws immediately or only at upload time.
   - Recommendation: Apply same pattern as Resend — configure inside the route handler or inside the upload helper function, not at module level.

2. **Mongoose `Types.ObjectId` vs string for `userId` in queries**
   - What we know: `session.user.id` is a string (set in `jwt` callback as `user._id.toString()`). Mongoose queries with `{ userId: stringId }` may not match ObjectId fields without casting.
   - What's unclear: Whether Mongoose 9.x auto-casts string to ObjectId in `find()` queries.
   - Recommendation: Use `new Types.ObjectId(userId)` explicitly in aggregation pipelines (where auto-cast does not apply); for standard `find()` queries Mongoose handles the cast automatically.

3. **Update schema strictness — partial vs full re-validation**
   - What we know: PUT handler could use the full create schema (requiring all fields on update) or a `.partial()` version.
   - What's unclear: Whether Phase 3 UI will send full or partial updates.
   - Recommendation: Use `tradeCreateSchema.partial()` with the same superRefine cross-field rules applied — allows partial updates while preserving business rules on exit/options fields when those fields are present.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npm test` (`vitest run --passWithNoTests`) |
| Full suite command | `npm test` |
| Test directory | `__tests__/` (configured in vitest.config.ts; does not exist yet) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRADE-01 | Trade creation with required fields | unit | `npm test -- __tests__/lib/calculations.test.ts` | No — Wave 0 |
| TRADE-02 | exitPrice+exitDate both-or-neither validation | unit | `npm test -- __tests__/schemas/trade.test.ts` | No — Wave 0 |
| TRADE-03 | P&L/pnlPercent/R:R formulas (all asset classes + directions) | unit | `npm test -- __tests__/lib/calculations.test.ts` | No — Wave 0 |
| TRADE-04 | Options fields required when assetClass=options | unit | `npm test -- __tests__/schemas/trade.test.ts` | No — Wave 0 |
| TRADE-05 | strategy + tags stored and returned | manual | verify via curl/REST client | N/A |
| TRADE-06 | notes stored and returned | manual | verify via curl/REST client | N/A |
| TRADE-07 | Upload rejects >5MB / non-image files | unit | `npm test -- __tests__/api/upload.test.ts` | No — Wave 0 |
| TRADE-08 | PUT recalculates P&L on update | unit | `npm test -- __tests__/lib/calculations.test.ts` | No — Wave 0 |
| TRADE-09 | DELETE removes trade and returns 204 | manual | verify via curl/REST client | N/A |
| INFRA-05 | Cloudinary vars in .env.example | manual | inspect .env.example | N/A |

**Highest-value test targets for this phase:** TRADE-03 (calculation correctness — formula bugs are silent and insidious) and TRADE-02/TRADE-04 (Zod schema rules — wrong validation causes bad data to reach DB).

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/` directory — does not exist; must be created
- [ ] `__tests__/lib/calculations.test.ts` — covers TRADE-03, TRADE-08
- [ ] `__tests__/schemas/trade.test.ts` — covers TRADE-02, TRADE-04
- [ ] `__tests__/api/upload.test.ts` — covers TRADE-07 validation (size + MIME)

*(No framework install needed — Vitest 2.1.9 already in devDependencies and configured)*

---

## Sources

### Primary (HIGH confidence)
- `docs/superpowers/specs/2026-03-22-trading-journal-design.md` — Complete Trade model, P&L formulas, API routes, response shapes
- `lib/models/User.ts` — Mongoose model pattern (confirmed by reading file)
- `lib/db.ts` — Current connection module (confirmed needs upgrade)
- `schemas/auth.ts` — Zod pattern with `.issues` extraction
- `app/api/auth/register/route.ts` — API handler pattern
- `proxy.ts` — Auth middleware (confirmed in place from Phase 1)
- `vitest.config.ts` — Test configuration (confirmed `__tests__/` glob, no test files yet)
- `mongoosejs.com/docs/middleware.html` — Pre-save hook behavior, query middleware limitation

### Secondary (MEDIUM confidence)
- [vercel/community discussions/424](https://github.com/vercel/community/discussions/424) — Global mongoose connection cache pattern (verified against Mongoose docs)
- [cloudinary.com/documentation/node_image_and_video_upload](https://cloudinary.com/documentation/node_image_and_video_upload) — `upload_stream` + buffer pattern
- [zod.dev/api](https://zod.dev/api) — `superRefine` API for cross-field conditional validation

### Tertiary (LOW confidence)
- WebSearch: mongodb-memory-server + Vitest setup — multiple sources agree on `globalSetup` + `inject()` pattern; relevant for Phase 6 integration tests, not Phase 2 implementation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed except `cloudinary`; versions verified against npm registry
- Architecture: HIGH — all patterns derived from existing project code + official docs
- P&L formulas: HIGH — copied verbatim from canonical spec document
- Cloudinary upload: MEDIUM — `upload_stream` + buffer pattern confirmed from official docs; exact TypeScript types for Cloudinary v2 not verified against Context7
- Pitfalls: HIGH — pre-save hook limitation is official Mongoose docs; connection caching is well-established pattern

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable libraries; Cloudinary SDK, Mongoose, and Zod all stable)
