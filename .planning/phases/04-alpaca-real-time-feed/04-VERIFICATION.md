---
phase: 04-alpaca-real-time-feed
verified: 2026-03-21T17:30:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 04: Alpaca Real-Time Feed Verification Report

**Phase Goal:** Replace yfinance polling with Alpaca WebSocket real-time feed and REST historical bar backfill, fully integrated into FastAPI lifespan.
**Verified:** 2026-03-21
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Plan 01)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | AlpacaFeed._on_bar converts AlpacaBar to project Bar and appends to BarStore with deduplication | VERIFIED | `alpaca_feed.py` lines 55-73: constructs `Bar(...)`, deduplicates via `deduped = [b for b in current if b.timestamp != local_bar.timestamp]`, calls `bar_store.update(..., (deduped + [local_bar])[-500:])` |
| 2 | backfill_bars fetches 200 historical 1-minute bars per symbol via REST and seeds BarStore | VERIFIED | `alpaca_feed.py` lines 118-162: `StockHistoricalDataClient`, `StockBarsRequest(limit=n_bars)` default 200, `asyncio.to_thread`, `bar_store.update(symbol, bars[-500:])` |
| 3 | AlpacaFeed.run reconnects with exponential backoff (5s base, 60s max) on stream failure | VERIFIED | `alpaca_feed.py` lines 88-115: outer `while True`, catches `Exception`, `await asyncio.sleep(backoff)`, `backoff = min(backoff * 2, MAX_BACKOFF_SECONDS)` where `BASE=5`, `MAX=60` |
| 4 | Timestamp deduplication prevents duplicate bars at backfill-to-stream join point | VERIFIED | `alpaca_feed.py` line 65: `deduped = [b for b in current if b.timestamp != local_bar.timestamp]`; Test 14 passes proving second call with same timestamp yields 1 bar |
| 5 | Watchdog logs ERROR if no bar received for a symbol in >3 minutes | VERIFIED | `alpaca_feed.py` lines 75-86: `WATCHDOG_TIMEOUT_SECONDS = 180`, `if age > timedelta(seconds=WATCHDOG_TIMEOUT_SECONDS): logger.error("WATCHDOG: ...")` |

### Observable Truths (Plan 02)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 6 | Lifespan starts backfill_bars before AlpacaFeed.run() stream task | VERIFIED | `main.py` lines 49-55: `await backfill_bars(...)` is awaited before `tasks = [asyncio.create_task(broadcaster.run())]` and before `AlpacaFeed` is instantiated |
| 7 | poll_yfinance_loop is no longer started in lifespan | VERIFIED | `grep "poll_yfinance_loop" backend/main.py` returns nothing; confirmed line-by-line reading of `main.py` |
| 8 | AlpacaFeed.run() is started as an asyncio.create_task in lifespan | VERIFIED | `main.py` line 68: `tasks.append(asyncio.create_task(alpaca_feed.run()))` |
| 9 | Lifespan cancels alpaca_feed task on shutdown | VERIFIED | `main.py` lines 78-80: `for task in tasks: task.cancel()` and `await asyncio.gather(*tasks, return_exceptions=True)`; alpaca_feed task is in the `tasks` list |
| 10 | Backfill only runs when ALPACA_API_KEY is set and stock symbols exist | VERIFIED | `main.py` line 49: `if stock_symbols and settings.alpaca_api_key:` guards the `await backfill_bars(...)` call |

**Score:** 10/10 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/data/alpaca_feed.py` | AlpacaFeed class + backfill_bars function | VERIFIED | 163 lines; exports `AlpacaFeed`, `backfill_bars`; all methods present and substantive |
| `backend/config.py` | ALPACA_API_KEY, ALPACA_SECRET_KEY, ALPACA_DATA_FEED settings | VERIFIED | Lines 10-12: `alpaca_api_key: str = ""`, `alpaca_secret_key: str = ""`, `alpaca_data_feed: str = "iex"` |
| `tests/test_data_feeds.py` | Tests 13-20 for AlpacaFeed (`TestAlpacaFeed`) | VERIFIED | Lines 432-626: `class TestAlpacaFeed` with 8 test methods; all 8 PASS |
| `requirements.txt` | alpaca-py dependency | VERIFIED | Line 11: `alpaca-py>=0.40.0,<0.50.0`; yfinance still present at line 10 |
| `backend/main.py` | Lifespan with AlpacaFeed replacing yfinance | VERIFIED | Contains `from backend.data.alpaca_feed import AlpacaFeed, backfill_bars`; no `poll_yfinance_loop` reference |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/data/alpaca_feed.py` | `backend/data/bar_store.py` | `self._bar_store.update()` and `self._bar_store.get()` | WIRED | Line 63: `self._bar_store.get(bar.symbol)`, line 66: `self._bar_store.update(...)`, line 159: `bar_store.update(symbol, bars[-500:])` |
| `backend/data/alpaca_feed.py` | `alpaca.data.live.StockDataStream` | `stream._run_forever()` workaround | WIRED | Lines 99-105: `StockDataStream(...)`, `stream.subscribe_bars(...)`, `await asyncio.create_task(stream._run_forever())` |
| `backend/main.py` | `backend/data/alpaca_feed.py` | `from backend.data.alpaca_feed import AlpacaFeed, backfill_bars` | WIRED | Line 13: import present; lines 50-55 and 63-68: both `backfill_bars` and `AlpacaFeed` are used in the lifespan body |
| `backend/main.py` | `backend/config.py` | `settings.alpaca_api_key` | WIRED | Line 16: `from backend.config import get_settings`; lines 40, 49, 62: `get_settings()` called and `.alpaca_api_key`, `.alpaca_secret_key` accessed |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DATA-05 | 04-01, 04-02 | Backend streams 1-minute OHLCV bars for US stocks via Alpaca WebSocket (replaces yfinance polling) | SATISFIED | `AlpacaFeed` class with `StockDataStream` WebSocket subscription in `alpaca_feed.py`; wired into lifespan in `main.py`; `poll_yfinance_loop` removed |
| DATA-06 | 04-01, 04-02 | Backend seeds BarStore with 100+ historical bars via Alpaca REST API on startup | SATISFIED | `backfill_bars()` fetches `n_bars=200` via `StockHistoricalDataClient`; awaited in lifespan before stream starts; Test 16 confirms seeding works |
| DATA-07 | 04-01, 04-02 | Backend auto-reconnects to Alpaca WebSocket with exponential backoff on connection loss | SATISFIED | `run()` outer `while True` loop; catches `Exception`; `await asyncio.sleep(backoff)`; `backoff = min(backoff * 2, MAX_BACKOFF_SECONDS)` (5→10→20→40→60); Test 20 confirms 5 then 10 sleep args |

All 3 requirement IDs declared in both PLAN frontmatter fields (`requirements: [DATA-05, DATA-06, DATA-07]`) are satisfied. REQUIREMENTS.md traceability table marks all three as Phase 4 / Complete. No orphaned requirements.

---

## Anti-Patterns Found

No blocker or warning anti-patterns detected.

Scanned files: `backend/data/alpaca_feed.py`, `backend/main.py`, `backend/config.py`, `tests/test_data_feeds.py`

- No TODO/FIXME/PLACEHOLDER/HACK comments found in any of the four files
- No stub return patterns (`return null`, `return {}`, `return []`) in implementation code
- No empty handlers
- All state variables that are written (`_bar_store`, `_last_bar_time`) are read and used in rendering paths
- `asyncio.to_thread` correctly wraps the blocking `StockHistoricalDataClient` call; result is consumed (`bar_set.data.get(...)`)

---

## Commit Verification

All commits documented in SUMMARYs exist in git history and match their stated file changes:

| Commit | Description | Files Changed | Match |
|--------|-------------|---------------|-------|
| `11f0d6c` | chore: Alpaca config + alpaca-py dep | `backend/config.py`, `requirements.txt` | Exact |
| `8d063ce` | test: Failing tests 13-20 (TDD RED) | `tests/test_data_feeds.py` +222 lines | Exact |
| `7d1cfb6` | feat: AlpacaFeed implementation | `backend/data/alpaca_feed.py` +162 lines | Exact |
| `bcc3531` | feat: Rewire lifespan | `backend/main.py` +28/-6 lines | Exact |
| `39b4ea2` | test: Update lifespan tests 11-12 | `tests/test_data_feeds.py` +49/-5 lines | Exact |

---

## Test Results

```
21 passed, 3 warnings in 0.10s
```

- Tests 1-12 (pre-existing): all PASS — no regressions introduced
- Tests 13-20 (new AlpacaFeed): all PASS
  - Test 13: `_on_bar` converts AlpacaBar to project Bar
  - Test 14: `_on_bar` deduplication by timestamp
  - Test 15: `_on_bar` 500-bar cap
  - Test 16: `backfill_bars` seeds BarStore
  - Test 17: `backfill_bars` empty response logs WARNING
  - Test 18: `_check_watchdog` logs ERROR when stale (>3 min)
  - Test 19: `_check_watchdog` no error when fresh
  - Test 20: `run()` exponential backoff — sleeps 5 then 10

---

## Human Verification Required

### 1. Live Alpaca WebSocket connection

**Test:** Set valid `ALPACA_API_KEY` and `ALPACA_SECRET_KEY` in `.env`, start the backend with `uvicorn backend.main:app`, and observe startup logs.
**Expected:** Logs show "Backfilled N bars for SPY" (or similar watchlist symbols) followed by Alpaca WebSocket connecting and streaming 1-minute bars during market hours.
**Why human:** Requires real Alpaca credentials and a live market session; cannot be verified against the codebase alone.

### 2. Reconnect on stream drop

**Test:** With a live backend running, interrupt the network or trigger a WebSocket error; observe reconnect behavior.
**Expected:** Logs show "AlpacaFeed error: ... — retrying in 5s", then 10s, 20s doubling up to 60s cap.
**Why human:** Runtime network condition cannot be simulated in static analysis.

### 3. No signal blind spot after cold start

**Test:** Start the backend cold (empty BarStore); check that signal computation begins immediately after startup backfill without waiting 50 minutes for EMA warm-up.
**Expected:** Signals are available within seconds of startup because BarStore is pre-seeded with 200 historical bars.
**Why human:** Requires integration-level observation of signal state + EMA values, not unit-testable.

---

## Summary

Phase 04 goal is fully achieved. The implementation is substantive (no stubs), correctly wired at every level, and all 5 documented commits exist in the git history. All three requirement IDs (DATA-05, DATA-06, DATA-07) are satisfied with direct code evidence. The 21-test suite passes with zero regressions.

Three human-verification items remain but are gated by runtime conditions (live Alpaca credentials, active market session) rather than implementation gaps.

---

_Verified: 2026-03-21_
_Verifier: Claude (gsd-verifier)_
