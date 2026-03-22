---
phase: 02-trade-data-layer-crud-api
plan: 05
subsystem: api
tags: [cloudinary, image-upload, aggregation, mongodb, nextjs]

requires:
  - phase: 02-trade-data-layer-crud-api
    plan: 01
    provides: Trade Mongoose model with strategy and tags fields, dbConnect helper, auth export

provides:
  - Cloudinary upload helper (lib/cloudinary.ts) with lazy config and uploadToCloudinary()
  - POST /api/upload — validates MIME type and 5MB size, uploads to per-user Cloudinary folder
  - GET /api/trades/meta — aggregates unique strategies and tags from user's trades
  - .env.example updated with CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

affects:
  - Phase 03 trade log UI (filter dropdowns use /api/trades/meta)
  - Trade log form (chart screenshot upload via /api/upload)

tech-stack:
  added: [cloudinary@2.9.0]
  patterns:
    - Lazy Cloudinary config via ensureConfig() guard — avoids module-scope env var access at build time
    - upload_stream pattern for buffer-to-Cloudinary without temp files
    - MongoDB aggregate with Types.ObjectId for userId (no auto-cast in pipelines)
    - Trade.distinct() for simple field deduplication vs aggregate for array field deduplication

key-files:
  created:
    - lib/cloudinary.ts
    - app/api/upload/route.ts
    - app/api/trades/meta/route.ts
  modified:
    - .env.example
    - package.json
    - package-lock.json

key-decisions:
  - "Cloudinary config is lazy (ensureConfig guard) — module-scope config throws at build time when env vars are absent"
  - "Types.ObjectId required for userId in aggregate pipeline — Mongoose does not auto-cast in aggregation context"
  - "Trade.distinct() used for strategies (scalar field), aggregate pipeline used for tags (array field requiring $unwind)"

patterns-established:
  - "Pattern: lazy third-party SDK config via boolean flag — apply to any SDK that reads env vars at config() call"
  - "Pattern: upload_stream with Buffer.from(file.arrayBuffer()) — standard server-side Cloudinary upload in Next.js App Router"

requirements-completed: [TRADE-07, INFRA-05]

duration: 2min
completed: 2026-03-22
---

# Phase 2 Plan 5: Cloudinary Upload and Trades Meta API Summary

**Cloudinary image upload endpoint with MIME/size validation, per-user folder routing, and MongoDB aggregation endpoint for strategy and tag filter dropdowns**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T20:48:42Z
- **Completed:** 2026-03-22T20:50:32Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Cloudinary SDK installed and configured with lazy init pattern to prevent build-time failures
- POST /api/upload validates MIME type (jpg/png/gif/webp), enforces 5MB limit, uploads to `trade-journal/charts/{userId}` folder, returns `{ data: { url } }`
- GET /api/trades/meta aggregates unique strategies (distinct, excluding empty strings) and tags (aggregate pipeline with $unwind + $group) from user's trades
- .env.example updated with all three Cloudinary variables for developer discoverability

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Cloudinary SDK, create upload helper, and build POST /api/upload route** - `a691f2e` (feat)
2. **Task 2: Create GET /api/trades/meta route for strategy and tag aggregation** - `27fe01d` (feat)

## Files Created/Modified

- `lib/cloudinary.ts` - Cloudinary upload helper with lazy config and uploadToCloudinary() using upload_stream
- `app/api/upload/route.ts` - POST image upload endpoint with MIME/size validation and per-user folder
- `app/api/trades/meta/route.ts` - GET aggregation endpoint returning unique strategies and tags
- `.env.example` - Added CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
- `package.json` / `package-lock.json` - Added cloudinary@2.9.0 dependency

## Decisions Made

- Cloudinary config is lazy (ensureConfig guard) — module-scope `cloudinary.config()` throws at build time when env vars are absent (per RESEARCH.md Pitfall 7)
- `Types.ObjectId(userId)` required in aggregate pipeline — Mongoose does not auto-cast string userId in aggregation context (per RESEARCH.md Open Question 2)
- `Trade.distinct()` used for strategies (scalar string field); aggregate pipeline with `$unwind` used for tags (array field requiring element-level deduplication)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**External service requires configuration before upload works.** Add the following to `.env.local`:

```
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

Obtain values from: Cloudinary Dashboard -> Settings -> API Keys.

## Next Phase Readiness

- POST /api/upload is ready for use in Phase 3 trade log form (chart screenshot field)
- GET /api/trades/meta is ready to populate filter dropdowns in Phase 3 trade log UI
- Cloudinary credentials must be configured in production environment (Vercel env vars) before upload works

---
*Phase: 02-trade-data-layer-crud-api*
*Completed: 2026-03-22*
