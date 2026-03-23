---
status: resolved
trigger: "POST /api/trades returns 500 Internal Server Error when saving a new trade from the TradeForm component"
created: 2026-03-23T00:00:00Z
updated: 2026-03-23T00:10:00Z
---

## Current Focus

hypothesis: Mongoose model caching via `mongoose.models.Trade || mongoose.model(...)` returns the old compiled model (without default: "open") on Next.js hot-reload, ignoring schema changes. The file edit was applied correctly but the stale model in the module cache is served instead.
test: Replaced the cache-guard pattern with `delete mongoose.models["Trade"]; mongoose.model(...)` so every module evaluation uses the current TradeSchema.
expecting: With the model cache busted, the schema with `default: "open"` will be used, Mongoose validation will pass, the pre-save hook will run, and the trade will be saved successfully.
next_action: Await human verification — submit trade form and confirm 201 response

## Symptoms

expected: Submitting the trade form should POST to /api/trades and redirect to /trades showing the new trade
actual: Gets a red "Something went wrong. Please try again." banner, and the browser console shows "Failed to load resource: the server responded with a status of 500 (Internal Server Error)" on /api/trades
errors: 500 on POST /api/trades — no further error detail visible in browser. Fast Refresh rebuilds indicate code is fresh.
reproduction: Fill the TradeForm (AAPL, Stock, Long, entry/exit prices, dates), click Save
started: New — TradeForm was just built in phase 03-03, never worked before

## Eliminated

- hypothesis: status field missing default value causes Mongoose validation to fail before the pre-save hook runs ("Path `status` is required")
  evidence: Added default: "open" to TradeSchema.status — human verified 500 still occurs after this fix. The previous hypothesis was correct about execution order but adding the default was not sufficient to resolve the error.
  timestamp: 2026-03-23T00:02:00Z

## Evidence

- timestamp: 2026-03-23T00:01:00Z
  checked: app/api/trades/route.ts — POST handler
  found: Handler does new Trade({ ...parsed.data, userId }) then await trade.save(). parsed.data (from tradeCreateSchema) contains no `status` field.
  implication: `status` is never set before save() is called; the pre-save hook is the only thing that sets it.

- timestamp: 2026-03-23T00:01:00Z
  checked: lib/models/Trade.ts — TradeSchema definition
  found: status field is defined as { type: String, enum: ["open", "closed"], required: true } with NO default value. Pre-save hook sets this.status after validation.
  implication: Mongoose validation fires before the pre-save hook (confirmed in mongoose source). Validation fails with "Path `status` is required" before the hook ever runs.

- timestamp: 2026-03-23T00:01:00Z
  checked: node_modules/mongoose/lib/model.js lines 390 and 394
  found: await this.$validate() called at line 390; await this._execDocumentPreHooks('save') called at line 394 — validation always precedes pre-save hooks.
  implication: This is the definitive execution order. The pre-save hook cannot prevent a required-field validation error.

- timestamp: 2026-03-23T00:02:00Z
  checked: Human verification response after adding status default: "open"
  found: 500 error still persists after fix — previous hypothesis was wrong or incomplete
  implication: The actual error thrown is unknown; route has no try/catch so the message is hidden

- timestamp: 2026-03-23T00:02:00Z
  checked: app/api/trades/route.ts (full), lib/models/Trade.ts (full), schemas/trade.ts (full), lib/auth.ts (full), components/trades/TradeForm.tsx (full)
  found: Route has no error handling — added try/catch with console.error to expose actual exception. userId is a hex string that Mongoose will cast to ObjectId (should be fine). TradeForm sends result.data (from Zod) which omits entryDate type mismatch since toISOString() produces a valid datetime string. No obvious static analysis cause found beyond what was already fixed.
  implication: Must capture the real runtime error message to form a new hypothesis

- timestamp: 2026-03-23T00:03:00Z
  checked: Human checkpoint response — exact error from server terminal
  found: "Trade validation failed: status: Path `status` is required." — this proves the model in use at runtime does NOT have the default: "open" applied. The file edit was confirmed present in the file on disk (line 47 verified).
  implication: The `mongoose.models.Trade || mongoose.model(...)` guard is returning a stale compiled model from a previous Next.js module evaluation, before the schema change was made. The `||` short-circuit means the new TradeSchema (with default) is never passed to mongoose.model(). This is the root cause.

- timestamp: 2026-03-23T00:04:00Z
  checked: lib/models/Trade.ts — export line and lib/db.ts — connection caching
  found: Last line was `mongoose.models.Trade || mongoose.model("Trade", TradeSchema)`. This is the standard Next.js pattern but it prevents schema updates from taking effect on hot-reload. db.ts uses global.mongoose for connection caching (correct), but the model cache is separate and must be busted for dev-mode schema changes.
  implication: Fix: `delete mongoose.models["Trade"]` before calling `mongoose.model()` ensures the current schema is always compiled into the model.

## Resolution

root_cause: Two-layer problem: (1) TradeSchema had no default for `status`, so Mongoose validation failed before the pre-save hook ran. (2) The `mongoose.models.Trade || mongoose.model(...)` cache guard caused Next.js hot-reload to serve the old compiled model (without the default), meaning the file edit on disk was invisible to the running server. The exact runtime error confirms the stale model was active: "Trade validation failed: status: Path `status` is required."
fix: (1) `default: "open"` added to status field in TradeSchema (previous session). (2) Replaced the cache guard with `delete mongoose.models["Trade"]; mongoose.model("Trade", TradeSchema)` so the current schema is always compiled into the model on module evaluation.
verification: Human confirmed — trade saves successfully, redirects to /trades, and new trade appears in the list. Fix verified end-to-end.
files_changed: ["lib/models/Trade.ts"]
