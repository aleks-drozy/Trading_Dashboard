# Phase 6: Watchlist Management UI + Dynamic Feed Subscription - Research

**Researched:** 2026-03-21
**Domain:** React optimistic UI / FastAPI background task coordination / alpaca-py dynamic subscription
**Confidence:** HIGH

---

## Summary

Phase 6 has two distinct halves that must be coordinated: a **frontend sidebar UI** for watchlist add/remove with optimistic state management, and a **backend stream-restart mechanism** that makes AlpacaFeed react to watchlist changes within 30 seconds.

The REST API for watchlist CRUD already exists and is fully tested (POST /watchlist, DELETE /watchlist/{symbol}, GET /watchlist). No new endpoints are needed for the sidebar UI — it calls these existing endpoints with the JWT bearer token already used by the rest of the frontend. The only new backend surface required is the dynamic feed re-subscription logic.

The critical backend constraint is already documented in STATE.md: `stream.subscribe_bars()` on a live alpaca-py connection hangs (alpaca-py issue #491). The approved pattern is **cancel the current asyncio.Task + restart a new StockDataStream** with the updated symbol list — called "stream cancel + restart". AlpacaFeed.run() already implements the backoff outer loop; the change is to make the symbol list dynamic by reading it fresh from the DB on each restart iteration, and to expose a way to trigger an early restart when a watchlist change occurs.

The BarStore also needs a `remove()` method so that deleted symbols have their bars cleared (success criterion 3).

**Primary recommendation:** Add a `BarStore.remove(symbol)` method, add an asyncio.Event-based trigger to AlpacaFeed so watchlist changes wake the run loop early, wire the watchlist router POST/DELETE handlers to set that event after DB commit, and build a WatchlistSidebar React component that calls the existing REST endpoints with optimistic UI and inline error handling.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ASSET-04 | User can add symbols to the watchlist from the dashboard sidebar UI | Existing REST POST /watchlist endpoint; need WatchlistSidebar component with optimistic state |
| ASSET-05 | User can remove symbols from the watchlist using the dashboard sidebar UI | Existing REST DELETE /watchlist/{symbol} endpoint; remove button per row with optimistic removal |
| ASSET-06 | Alpaca feed automatically picks up watchlist changes and streams data for newly added symbols without a backend restart | asyncio.Event trigger in AlpacaFeed; stream cancel+restart with refreshed symbol list from DB |
</phase_requirements>

---

## Standard Stack

### Core (already in project — no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| alpaca-py | >=0.40.0,<0.50.0 (pinned) | StockDataStream WebSocket, REST backfill | Already in requirements.txt; same lib used in Phase 4 |
| FastAPI / asyncio | — | Background task coordination, event signalling | Already the project framework |
| SQLModel + SQLite | — | Watchlist persistence | Already in use; no schema changes needed |
| React 18 + TypeScript | — | Frontend sidebar component | Already in use (Vite 6 + shadcn/ui stack) |
| shadcn/ui Button + Input | — | Add field + remove button UI | Already in frontend/src/components/ui/ |
| sonner (toast) | — | Error notifications on add/remove failure | Already imported in DashboardPage via Toaster |

### No new dependencies required

The entire phase is achievable with what is already installed. No npm packages or Python packages need to be added.

---

## Architecture Patterns

### Recommended Project Structure Changes

```
backend/
├── data/
│   ├── bar_store.py          # ADD: BarStore.remove(symbol) method
│   └── alpaca_feed.py        # MODIFY: accept asyncio.Event trigger; read symbols from DB on each reconnect
├── watchlist/
│   └── router.py             # MODIFY: call feed_restart_event.set() after successful POST/DELETE
└── main.py                   # MODIFY: pass restart event + DB factory to AlpacaFeed; wire event into lifespan

frontend/src/
├── components/
│   └── WatchlistSidebar.tsx  # NEW: add field + symbol list with remove buttons
├── pages/
│   └── DashboardPage.tsx     # MODIFY: add WatchlistSidebar to layout
└── lib/
    └── api.ts                # MODIFY: add addWatchlistSymbol() + removeWatchlistSymbol() helpers
```

### Pattern 1: asyncio.Event-based early-wake in AlpacaFeed

**What:** AlpacaFeed.run() currently loops with `await asyncio.sleep(backoff)` only on error, and runs the stream until it crashes. To trigger a symbol-list refresh without waiting for the next error, inject an `asyncio.Event` that the watchlist router sets after any ADD/DELETE commit. The run loop checks the event and restarts the stream task when the event is set.

**When to use:** Any time external state change (watchlist mutation) needs to trigger a restart of a long-running stream task within a bounded time window (30s requirement).

**Implementation approach:**

```python
# backend/data/alpaca_feed.py  (pseudocode — not verbatim)
class AlpacaFeed:
    def __init__(self, ..., get_symbols: Callable[[], list[str]], restart_event: asyncio.Event | None = None):
        self._get_symbols = get_symbols          # called fresh on each stream start
        self._restart_event = restart_event or asyncio.Event()

    async def run(self) -> None:
        backoff = BASE_BACKOFF_SECONDS
        while True:
            self.symbols = self._get_symbols()    # fresh symbol list on every (re)start
            stream = StockDataStream(...)
            stream.subscribe_bars(self._on_bar, *self.symbols)
            stream_task = asyncio.create_task(stream._run_forever())
            restart_task = asyncio.create_task(self._wait_for_restart())

            done, pending = await asyncio.wait(
                [stream_task, restart_task],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for t in pending:
                t.cancel()
                await asyncio.gather(t, return_exceptions=True)
            stream.stop()
            self._restart_event.clear()

            if stream_task in done and not restart_task in done:
                # stream crashed — apply backoff
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, MAX_BACKOFF_SECONDS)
            else:
                # triggered restart — no backoff, reset backoff counter
                backoff = BASE_BACKOFF_SECONDS

    async def _wait_for_restart(self):
        await self._restart_event.wait()
```

**Source:** asyncio.wait with FIRST_COMPLETED is the standard Python pattern for "cancel whichever finishes second". Verified by Python 3.11 asyncio docs.

**Confidence:** HIGH — asyncio.wait + FIRST_COMPLETED is well-documented, deterministic, and test-friendly.

### Pattern 2: Dependency-inject the restart event into the watchlist router

**What:** The restart event must be reachable from the watchlist router at request time. In FastAPI the cleanest approach for module-level singletons is `app.state`. Set `app.state.feed_restart_event` in lifespan, then depend on `request.app.state` or use a module-level singleton.

**Simpler alternative (matches existing project patterns):** Use a module-level singleton `asyncio.Event` in a new `backend/data/feed_events.py` (or inline in `alpaca_feed.py`), import it in both the watchlist router and main.py. The project already uses module-level singletons for `bar_store`, `broadcaster`, `paper_engine` — this is consistent.

```python
# backend/data/alpaca_feed.py — add at module level
feed_restart_event = asyncio.Event()
```

```python
# backend/watchlist/router.py — after repo.add() or repo.remove()
from backend.data.alpaca_feed import feed_restart_event
feed_restart_event.set()
```

**Note:** This import must only trigger the event for stock symbols. Crypto symbols go through BinanceFeed, not AlpacaFeed. The router already has `asset_type` in the request body — only set the event when `asset_type == "stock"`.

**Confidence:** HIGH — mirrors existing singleton pattern in this codebase.

### Pattern 3: BarStore.remove() for cleanup on symbol deletion

**What:** BarStore currently has `update()`, `get()`, and `symbols()` but no `remove()`. After a symbol is deleted from the watchlist, its bars should be cleared from memory (success criterion 3: "BarStore no longer holds bars for it").

```python
# backend/data/bar_store.py
def remove(self, symbol: str) -> None:
    with self._lock:
        self._data.pop(symbol, None)
```

Call this from the watchlist DELETE handler after `repo.remove()` succeeds. Also call it inside AlpacaFeed when a symbol disappears from the fresh symbol list on restart (diff old vs new).

**Confidence:** HIGH — trivial thread-safe dict pop.

### Pattern 4: Backfill for newly added symbols

**What:** When a new stock symbol is added to the watchlist, the AlpacaFeed restart will subscribe to it, but BarStore will be empty for that symbol. The signal broadcaster requires 22+ bars before computing signals. Without a backfill, the new symbol will silently produce no signals until 22 live bars accumulate (~22 minutes during market hours).

**Solution:** After the restart event fires and before the new stream starts, run `backfill_bars()` for any symbols that are new (present in new list but absent in old list). The existing `backfill_bars` function is reusable for this purpose.

```python
# inside AlpacaFeed.run() after computing new symbol list
old_symbols = set(self.symbols)
new_symbols = set(fresh_symbols)
added = new_symbols - old_symbols
removed = new_symbols.symmetric_difference(old_symbols) - added
for sym in removed:
    self._bar_store.remove(sym)
if added and self._api_key:
    await backfill_bars(self._api_key, self._secret_key, list(added), self._bar_store)
```

**Confidence:** HIGH — same backfill function already used in lifespan.

### Pattern 5: Optimistic UI with inline error rollback

**What:** The sidebar should apply the add/remove immediately (optimistic), then revert if the server returns an error. This is the standard React pattern for mutation-heavy UIs.

```typescript
// WatchlistSidebar.tsx (pseudocode)
const handleAdd = async (symbol: string) => {
  const upper = symbol.trim().toUpperCase()
  if (!upper) return
  setSymbols(prev => [...prev, { symbol: upper, asset_type: 'stock' }])  // optimistic
  try {
    await addWatchlistSymbol(upper, 'stock')
  } catch (e) {
    setSymbols(prev => prev.filter(s => s.symbol !== upper))  // rollback
    setAddError(errorMessage(e))  // inline error
  }
}
```

**Input validation (client-side, before API call):**
- Reject empty strings
- Reject symbols already in the list (duplicate check against local state)
- Reject strings with characters outside `[A-Z0-9.-]` (stock ticker format)
- Reject strings longer than 10 characters

**Why not rely solely on server errors:** The 30s UX requirement means the user gets feedback immediately; waiting for a 409 to roll back is acceptable but slower than a local pre-check.

**Confidence:** HIGH — standard React optimistic UI pattern.

### Anti-Patterns to Avoid

- **Using stream.subscribe_bars() on a live connection:** alpaca-py #491 — confirmed hang. Always cancel + restart instead.
- **Setting the restart event from inside an async path without verifying the event loop:** FastAPI route handlers run in the event loop; `event.set()` from a sync FastAPI route called via `asyncio.to_thread` would be wrong. The watchlist router uses sync `def` routes — these run in a thread pool. `asyncio.Event.set()` is NOT thread-safe when used from a thread pool thread — see below.

### Critical Pitfall: asyncio.Event is NOT thread-safe from sync routes

**What goes wrong:** FastAPI sync route handlers run in a thread pool via `asyncio.to_thread`. Calling `feed_restart_event.set()` from inside a sync route handler calls `asyncio.Event.set()` from a non-event-loop thread. This silently fails to wake any coroutine waiting on `event.wait()`.

**How to avoid:** Either (a) convert the watchlist router endpoints to `async def` (simplest; the DB calls are fast and don't need a thread pool) OR (b) use `loop.call_soon_threadsafe(event.set)` from the sync handler. Converting to `async def` is simpler and is the correct approach here — there is no I/O that requires a thread.

**Confidence:** HIGH — documented Python asyncio behaviour; verified against Python 3.11 asyncio docs.

### Anti-Patterns to Avoid (frontend)

- **Fetching the full watchlist from the server after every mutation:** unnecessary round-trip; local optimistic state is sufficient since the server is the single source of truth on page load only.
- **Putting WatchlistSidebar in a separate route/page:** the requirement specifies "dashboard sidebar" — it is a panel in DashboardPage, not a new page.
- **Using a modal for add/remove:** inline add field + per-row remove button matches the sidebar pattern described in success criteria. No modal needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Symbol format validation | Custom regex validator | Simple `[A-Z0-9.\-]{1,10}` client-side check + server 409 rollback | Server already validates via IntegrityError; client check is UX only |
| Stream task lifecycle | Custom task manager | `asyncio.wait(FIRST_COMPLETED)` | Standard asyncio pattern; composable and test-friendly |
| REST calls with auth | Custom fetch wrapper | Existing `fetchWithAuth()` in api.ts | Already handles JWT headers and base URL |
| Toast notifications | Custom notification | Existing `sonner` Toaster already in DashboardPage | Already installed and wired |
| Historical bar seeding on add | Custom REST call | Existing `backfill_bars()` function | Already tested and handles deduplication |

---

## Runtime State Inventory

> This is a feature addition phase, not a rename/refactor. However, the BarStore holds runtime state in memory that is directly affected by watchlist changes.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | BarStore in-memory dict: currently holds bars for all symbols added at startup | Add `remove()` method; call it when a symbol is deleted |
| Live service config | AlpacaFeed asyncio.Task: currently uses symbol list set at construction time | Refactor to read symbol list fresh from DB on each run-loop iteration |
| OS-registered state | None — no OS-level registrations | None |
| Secrets/env vars | None — no new env vars needed; existing ALPACA_API_KEY/SECRET used | None |
| Build artifacts | None | None |

---

## Common Pitfalls

### Pitfall 1: asyncio.Event.set() from a sync FastAPI route handler
**What goes wrong:** Sync route handlers run in a thread pool. `asyncio.Event.set()` from a non-event-loop thread does not wake `event.wait()` waiters in the event loop.
**Why it happens:** asyncio primitives are not thread-safe by design.
**How to avoid:** Convert watchlist router endpoints to `async def`. They already do fast SQLite reads/writes — no blocking I/O that requires a thread pool.
**Warning signs:** Restart event is set but AlpacaFeed does not restart within 30 seconds; `asyncio.Event.is_set()` returns True but `event.wait()` never unblocks.

### Pitfall 2: asyncio.Task.cancel() does not guarantee stream teardown before new stream starts
**What goes wrong:** `stream.stop()` must be called before the old connection is garbage-collected. If cancel() fires mid-handshake and stop() is skipped, the next connection attempt may receive a 406 error from the Alpaca WebSocket endpoint ("too many connections").
**Why it happens:** alpaca-py WebSocket teardown is not documented; cancel() only cancels the Python coroutine, not the underlying WebSocket close handshake.
**How to avoid:** Always call `stream.stop()` explicitly after cancelling the stream_task, as the existing `AlpacaFeed.run()` CancelledError handler already does. In the restart path, also call `stream.stop()` before spawning the new stream — add a brief `await asyncio.sleep(0)` after stop() to yield the event loop.
**Warning signs:** 406 errors in the log on stream restart; "too many connections" in alpaca-py error messages.

### Pitfall 3: Race condition between backfill and live bars from the new stream
**What goes wrong:** The new stream starts and begins delivering bars for the new symbol before backfill completes. Backfill results then overwrite live bars.
**Why it happens:** `backfill_bars()` calls `bar_store.update(symbol, bars)` which replaces the entire list. If a live bar arrived between backfill fetch and update, it gets dropped.
**How to avoid:** Run `backfill_bars()` for new symbols BEFORE starting the new stream (not concurrently). The AlpacaFeed restart sequence should be: (1) stop old stream, (2) backfill new symbols, (3) start new stream. This is the same ordering used in lifespan (main.py: `await backfill_bars(...)` before `asyncio.create_task(alpaca_feed.run())`).
**Warning signs:** Signal state for newly added symbol appears briefly then goes blank; "only N bars" debug log where N drops mid-session.

### Pitfall 4: Optimistic UI symbol appearing in SignalTable before any signals exist
**What goes wrong:** The optimistic add puts the symbol in the sidebar immediately, but SignalBroadcaster skips symbols with fewer than 22 bars. The new symbol appears in the watchlist sidebar but not in the SignalTable, which may confuse the trader.
**Why it happens:** SignalBroadcaster.compute_and_broadcast() queries the DB for watchlist symbols but only adds to `signals[]` if `len(bars) >= _MIN_BARS`. The frontend SignalTable renders only symbols present in the last WebSocket message.
**How to avoid:** This is acceptable expected behaviour (success criterion says "within 30 seconds"). No code change needed. Optionally add a tooltip or empty-state message in the sidebar saying "Awaiting data for new symbol..."
**Warning signs:** User confusion only; not a functional bug.

### Pitfall 5: Frontend sends lowercase symbol to the API
**What goes wrong:** User types "spy" — optimistic UI shows "spy" but server stores "SPY" (repository.add() calls .upper()). The sidebar symbol list becomes inconsistent.
**How to avoid:** Normalise to `.toUpperCase()` in the frontend before displaying and before sending to the API. Already done for display in SignalTable (`.toUpperCase()` call).
**Warning signs:** Duplicate-looking entries in the sidebar differing only in case.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### asyncio.wait with FIRST_COMPLETED (stream vs event race)

```python
# Source: Python 3.11 asyncio docs — asyncio.wait()
done, pending = await asyncio.wait(
    {stream_task, restart_waiter_task},
    return_when=asyncio.FIRST_COMPLETED,
)
for t in pending:
    t.cancel()
    await asyncio.gather(t, return_exceptions=True)
```

### BarStore.remove() addition

```python
# Source: existing BarStore pattern in backend/data/bar_store.py
def remove(self, symbol: str) -> None:
    """Remove all bars for symbol from the store (no-op if absent)."""
    with self._lock:
        self._data.pop(symbol, None)
```

### Watchlist router triggering the event (async route)

```python
# Source: existing pattern in backend/watchlist/router.py
from backend.data.alpaca_feed import feed_restart_event

@router.post("", status_code=status.HTTP_201_CREATED)
async def add_to_watchlist(body: WatchlistAddRequest, ...):
    repo = WatchlistRepository(session)
    try:
        item = repo.add(body.symbol, body.asset_type)
    except IntegrityError:
        raise HTTPException(status_code=409, detail="Symbol already in watchlist")
    if body.asset_type == "stock":
        feed_restart_event.set()
    return item
```

### WatchlistSidebar component structure

```typescript
// Source: existing shadcn/ui Input + Button usage in this codebase
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fetchWithAuth } from '@/lib/api'

interface WatchlistItem { symbol: string; asset_type: string }

export function WatchlistSidebar() {
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [addValue, setAddValue] = useState('')
  const [addError, setAddError] = useState<string | null>(null)

  useEffect(() => {
    fetchWithAuth('/watchlist').then(r => r.json()).then(setItems)
  }, [])

  const handleAdd = async () => {
    const sym = addValue.trim().toUpperCase()
    if (!sym) return
    setAddError(null)
    setItems(prev => [...prev, { symbol: sym, asset_type: 'stock' }]) // optimistic
    setAddValue('')
    try {
      await fetchWithAuth('/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym, asset_type: 'stock' }),
      }).then(r => { if (!r.ok) return r.json().then(d => { throw new Error(d.detail) }) })
    } catch (e: unknown) {
      setItems(prev => prev.filter(s => s.symbol !== sym))  // rollback
      setAddError(e instanceof Error ? e.message : 'Failed to add symbol')
    }
  }

  const handleRemove = async (symbol: string) => {
    setItems(prev => prev.filter(s => s.symbol !== symbol))  // optimistic
    try {
      await fetchWithAuth(`/watchlist/${symbol}`, { method: 'DELETE' })
        .then(r => { if (!r.ok) throw new Error('Failed to remove') })
    } catch {
      // reload from server on failure
      fetchWithAuth('/watchlist').then(r => r.json()).then(setItems)
    }
  }

  // render: input + button for add, list with remove button per row, addError inline
}
```

### main.py lifespan wiring change

```python
# Source: existing main.py pattern
from backend.data.alpaca_feed import AlpacaFeed, backfill_bars, feed_restart_event

# AlpacaFeed now receives get_symbols callable + restart event
alpaca_feed = AlpacaFeed(
    api_key=settings.alpaca_api_key,
    secret_key=settings.alpaca_secret_key,
    get_symbols=get_watchlist_symbols,   # callable, not list
    restart_event=feed_restart_event,
)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Subscribe symbols at construction | Re-read symbols from DB on each stream restart | Phase 6 | Enables dynamic watchlist without restart |
| No BarStore.remove() | BarStore.remove(symbol) clears stale data | Phase 6 | Prevents stale signals for deleted symbols |
| Static symbol list in lifespan | Callable `get_symbols` injected into AlpacaFeed | Phase 6 | Decouples feed from startup-time snapshot |

---

## Open Questions

1. **Should crypto symbols (BinanceFeed) also get dynamic subscription?**
   - What we know: ASSET-06 only mentions Alpaca feed; Binance is disabled on Render due to geo-blocking; the sidebar add-field currently only handles `asset_type: "stock"` in the requirement wording
   - What's unclear: Whether the user expects BTC-USD to also be addable via the sidebar
   - Recommendation: Scope only to stocks for this phase; crypto add is out of scope (Binance is disabled on Render anyway). The sidebar should hardcode `asset_type: 'stock'` for now. A follow-on phase can add crypto support.

2. **Symbol validation: what is a valid stock symbol format?**
   - What we know: US stock tickers are 1-5 uppercase letters (NYSE/NASDAQ); some ETFs have numbers (e.g., SPY); Alpaca IEX feed supports standard US equities
   - What's unclear: Whether the user needs to add any extended-format symbols (e.g., BRK.B with a dot)
   - Recommendation: Accept `[A-Z0-9.]{1,10}` on the client side; let the server return 404 or an Alpaca error for invalid symbols that pass format validation. Do not try to validate against a live symbol list.

3. **asyncio.Task.cancel() + stream.stop() teardown timing**
   - What we know: STATE.md explicitly flags "asyncio.Task.cancel() interaction with alpaca-py WebSocket teardown is undocumented — confirm old connection fully closes before new stream connects to avoid 406 errors"
   - What's unclear: Whether a brief sleep is sufficient or a more robust wait is needed
   - Recommendation: After `stream.stop()`, yield with `await asyncio.sleep(1)` before constructing the new StockDataStream. If 406 errors are observed in testing, increase to 2-3s. This is a test-time determination — plan should include an integration smoke test.

---

## Sources

### Primary (HIGH confidence)
- Existing codebase: `backend/data/alpaca_feed.py` — AlpacaFeed class, confirmed `_run_forever()` workaround, existing backoff pattern
- Existing codebase: `backend/main.py` — lifespan wiring, ordering of backfill before stream start
- Existing codebase: `backend/watchlist/router.py` — existing CRUD endpoints, sync def pattern
- Existing codebase: `backend/data/bar_store.py` — BarStore thread-safety pattern with `_lock`
- Existing codebase: `frontend/src/lib/api.ts` — `fetchWithAuth()` helper pattern
- Python 3.11 asyncio documentation — `asyncio.wait()`, `asyncio.Event`, thread-safety rules
- STATE.md decisions — cancel+restart pattern mandated; subscribe_bars() hang confirmed (alpaca-py #491); async route handler requirement for event.set()

### Secondary (MEDIUM confidence)
- STATE.md blocker note: "asyncio.Task.cancel() interaction with alpaca-py WebSocket teardown is undocumented" — confirmed as known risk, mitigation (stream.stop() + sleep) is project-approved approach
- alpaca-py issue #476 (noted in STATE.md): `stream.run()` raises RuntimeError in FastAPI event loop — `_run_forever()` workaround confirmed in existing code

### Tertiary (LOW confidence)
- General React optimistic UI patterns for mutation UIs — widely documented, low risk of being wrong for this use case

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all libraries already in use and tested
- Architecture: HIGH — patterns derived from existing codebase conventions and documented STATE.md decisions
- Pitfalls: HIGH — asyncio.Event thread-safety is documented Python behaviour; other pitfalls derived from existing code reading

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable stack; alpaca-py pinned to <0.50.0)
