# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## post-api-trades-500 — Mongoose stale model cache causes status validation failure on POST /api/trades
- **Date:** 2026-03-23
- **Error patterns:** 500, POST /api/trades, Trade validation failed, status, Path status is required, mongoose.models, hot-reload, default, pre-save hook
- **Root cause:** Two-layer problem: (1) TradeSchema had no default for `status`, so Mongoose validation failed before the pre-save hook ran. (2) The `mongoose.models.Trade || mongoose.model(...)` cache guard caused Next.js hot-reload to serve the old compiled model (without the default), making the on-disk schema edit invisible to the running server.
- **Fix:** Added `default: "open"` to the status field in TradeSchema, and replaced the cache guard pattern with `delete mongoose.models["Trade"]; mongoose.model("Trade", TradeSchema)` so the current schema is always compiled on module evaluation.
- **Files changed:** lib/models/Trade.ts
---
