# Project Research Summary

**Project:** Trading Signal Dashboard — IFVG + CISD + 20-EMA (v1.1)
**Domain:** Real-time algorithmic trading signal dashboard with paper trading engine
**Researched:** 2026-03-21 (v1.1 update; original v1.0 research: 2026-03-16)
**Confidence:** HIGH (stack and pitfalls verified against official docs and confirmed GitHub issues)

## Executive Summary

This is a single-user, real-time trading signal dashboard built around the ICT/SMC strategy (IFVG + CISD + 20-EMA). The v1.0 foundation is fully deployed on Render (FastAPI backend) and Vercel (React/Vite frontend), with Binance WebSocket for crypto and yfinance polling for US stocks. The v1.1 milestone replaces yfinance polling with an Alpaca IEX WebSocket feed, adds multi-timeframe chart aggregation (1m/5m/15m/1h), and exposes watchlist management directly in the UI without requiring API calls. The overall architecture remains a single asyncio process where both data feeds write closed 1-minute bars into a shared in-memory BarStore, and all downstream components — the signal broadcaster, chart endpoint, and strategy engine — read from that single source of truth. No new infrastructure is required.

The recommended build order is strictly dependency-driven. The Alpaca feed comes first because it unblocks all testing of downstream components — without live stock bars in BarStore, neither multi-timeframe charts nor the watchlist subscription loop can be validated. Multi-timeframe aggregation follows, implemented as on-demand pandas resample in the chart endpoint (not as pre-computed BarStore entries), which avoids partial-bar management complexity with negligible latency cost (~2–5ms per request). The watchlist UI is primarily frontend work against already-existing REST endpoints, with one backend addition: the Alpaca feed must restart its stream when the watchlist changes, rather than calling `subscribe_bars()` on a live connection. The feed source indicator and REST backfill on startup should be included in Phase 1 as they are low complexity and high operational value.

The highest-risk items in this milestone are two confirmed alpaca-py SDK bugs. First, `StockDataStream.run()` calls `asyncio.run()` internally and raises a `RuntimeError` in FastAPI's already-running event loop — the workaround is to use the private `_run_forever()` coroutine via `asyncio.create_task()`, confirmed in issue #476. Second, calling `subscribe_bars()` on a live stream has a confirmed hang bug (issue #491) where the stream silently stops delivering messages after the first dynamic subscription call — the workaround is to cancel the stream task and restart with a fresh `StockDataStream` instance. Both bugs are solvable with documented patterns, but both must be built correctly from the start or the feed will silently produce no data.

## Key Findings

### Recommended Stack

The v1.0 stack (FastAPI, SQLite via SQLModel, PyJWT, React 18 + Vite, TradingView Lightweight Charts v5, Zustand, TanStack Query) is validated, deployed, and unchanged for v1.1. The single backend addition is `alpaca-py>=0.40.0` — Alpaca's official, actively maintained SDK that replaces the deprecated `alpaca-trade-api`. Multi-timeframe aggregation requires no new library: pandas `resample()` is already a hard dependency and handles all OHLCV aggregation correctly. The frontend requires no new dependencies.

**Core technologies:**
- `fastapi>=0.115` + `uvicorn[standard]`: async-native ASGI framework; WebSocket support built-in with no extra plugins; already deployed
- `alpaca-py>=0.40.0`: Alpaca's official SDK; `StockDataStream` from `alpaca.data.live`; free-tier requires `feed="iex"` explicitly; use `_run_forever()` not `run()`
- `pandas>=2.0` + `pandas-ta>=0.3.14b`: bar aggregation via `resample(closed="left", label="left")` and indicator computation; pure Python, no C binary required
- `lightweight-charts@^5`: canvas-based financial charting; handles 500+ 1m bars with overlays at full performance; MIT licensed
- `zustand@^4`: lightweight state management; Redux Toolkit is overkill for a single-user dashboard
- `PyJWT>=2.12.1` + `passlib/bcrypt`: JWT auth; `python-jose` must not be used (no releases since 2021, known CVEs; FastAPI docs updated mid-2024 to replace it)
- `SQLite` via `sqlmodel>=0.0.21`: watchlist and paper trade persistence; ephemeral on Render free tier (acceptable; REST backfill makes restarts recoverable)

**What NOT to add:**
- `alpaca-trade-api`: deprecated by Alpaca, unmaintained — use `alpaca-py`
- `StockDataStream.run()` in lifespan: calls `asyncio.run()` internally — use `_run_forever()`
- SIP feed on free Alpaca account: auth error — must pass `feed="iex"`
- Any pre-computed per-timeframe BarStore entries: unnecessary complexity; resample on-demand in the chart endpoint

### Expected Features

**Must have (v1.1 table stakes):**
- Alpaca WebSocket 1m bar feed replacing yfinance polling — eliminates 60s signal latency for US stocks
- Graceful reconnect with exponential backoff — silent feed drop without reconnect is unacceptable
- Timeframe switcher UI (1m/5m/15m/1h) — IFVG/CISD overlays recomputed per TF on the backend
- Watchlist add/remove UI in sidebar — users expect dashboard-native symbol management
- Watchlist validation feedback — inline error on duplicate, invalid format, or network failure
- REST backfill on Alpaca feed startup — seeds BarStore with historical bars; without this, signals are absent for 50 minutes after any restart

**Should have (v1.1 differentiators — low complexity, include in this milestone):**
- Feed source indicator ("IEX" / "Binance" / "Stale") — trader must know data quality, especially given IEX's ~2% market coverage
- Staleness indicator per symbol (no bar for 2+ minutes during market hours) — IEX gaps are normal; user must be informed
- Alpaca test stream env var (`ALPACA_USE_TEST_FEED=true`) — enables local dev without market hours dependency; zero added complexity
- Timeframe persistence across symbol switches — trivial React state lift; prevents disorienting TF reset on symbol change

**Defer (not in v1.1):**
- Intraday bar history backfill after mid-session reconnect (gap detection + merge logic exceeds v1.1 scope)
- SIP data upgrade (paid Alpaca tier — out of scope by project constraint)
- Persistent timeframe preference in localStorage (marginal UX gain for personal dashboard)
- Multi-chart panel layout (complexity, not needed for single-strategy dashboard)
- Autocomplete symbol search (requires symbol master database or paid API)

### Architecture Approach

The architecture is a single FastAPI process on Render free tier with one asyncio event loop. Two background tasks run in the lifespan — `AlpacaFeed` (new, replaces yfinance) and `BinanceFeed` (unchanged) — both writing closed 1m bars to the shared `BarStore` singleton (threading.Lock, 500-bar cap per symbol). Higher-timeframe bars are computed on-demand in `charts/router.py` using pandas resample — there is no pre-computed multi-timeframe store. Dynamic watchlist subscription is handled by a stream restart pattern inside `AlpacaFeed`: a 30-second diff-check loop detects watchlist changes via the existing callable watchlist getter, then cancels the stream task and restarts it with the updated symbol list. The frontend calls existing `/watchlist` REST endpoints directly; no coupling exists between the HTTP layer and the data feed layer.

**Major components:**
1. `AlpacaFeed` (`backend/data/alpaca_feed.py`, new) — streams closed 1m stock bars via `StockDataStream._run_forever()`; 30s diff-check for stream restart on watchlist change; REST backfill on startup via `StockHistoricalDataClient`; mirrors `binance_feed.py` interface to BarStore
2. `BarStore` (`backend/data/bar_store.py`, unchanged + add `remove()`) — thread-safe in-memory dict[symbol, list[Bar]]; 500-bar cap; single source of truth for all bar data; needs `remove()` method for symbol eviction on watchlist deletion
3. `charts/router.py` (modified) — adds `?tf=1m|5m|15m|1h` query param; resamples 1m bars to requested TF using pandas; runs existing strategy functions on aggregated data; drops last incomplete bar before signal computation with `iloc[:-1]`
4. `WatchlistSidebar` (`frontend/src/components/WatchlistSidebar.tsx`, new) — add/remove symbols via existing GET/POST/DELETE `/watchlist` REST API; optimistic UI with error revert; inline validation
5. `ChartPage` (modified) — timeframe switcher pill group; TF state lifted to page level for persistence across symbol switches

**Build order (dictated by dependencies):**
1. `alpaca_feed.py` + lifespan wiring (unblocks all other work)
2. Chart endpoint `?tf` param + backend resample
3. ChartPage timeframe switcher (frontend; depends on Step 2)
4. WatchlistSidebar (frontend; depends only on existing REST API)
5. AlpacaFeed 30s diff-check + stream restart (completes the watchlist→feed loop; depends on Steps 1 and 4)

### Critical Pitfalls

1. **`StockDataStream.run()` blocks the FastAPI event loop** — use `asyncio.create_task(stream._run_forever())` instead; `run()` calls `asyncio.run()` internally and raises `RuntimeError: This event loop is already running`. Confirmed in alpaca-py issue #193 and #476. Must be correct before any other Alpaca work.

2. **Runtime subscribe/unsubscribe hangs the stream (alpaca-py bug #491)** — do not call `stream.subscribe_bars()` on a live connection after startup; it has a confirmed race condition that silently stops all bar delivery with no error. Instead: cancel the stream task and restart with a fresh `StockDataStream` instance with the updated symbol list.

3. **No bar backfill on WebSocket connect** — Alpaca WebSocket delivers no historical bars on connection; without REST backfill, EMA and IFVG/CISD need ~50 bars of warm-up which takes 50 minutes of live trading to accumulate. Fetch `StockHistoricalDataClient.get_stock_bars()` on `AlpacaFeed` startup to seed BarStore.

4. **Multi-timeframe aggregation serves the current incomplete higher-TF bar to the strategy engine** — always `resampled.iloc[:-1]` before passing to strategy functions; serving an open (forming) 5m or 15m bar causes lookahead bias and repainting signals on the chart. This is the same class of bug as the v1.0 Pitfall 1 lookahead bias.

5. **One WebSocket connection per Alpaca account — 406 on concurrent connections** — Render rolling deployments create a window where both old and new instances attempt the Alpaca connection. Add `ENABLE_ALPACA_FEED` env var (mirrors `ENABLE_BINANCE_FEED`) to disable locally; implement 60s exponential backoff specifically on 406 errors.

6. **IEX data gaps are normal and must not trigger false reconnects** — IEX covers ~2% of US market volume; a subscribed symbol may receive zero bars during normal market hours; a 3-minute watchdog timer (not 60s) prevents false reconnect loops during low-volume periods; surface a staleness indicator in the UI instead.

## Implications for Roadmap

Based on the explicit dependency graph from ARCHITECTURE.md and the build order from both ARCHITECTURE.md and FEATURES.md, four phases are recommended for v1.1. The existing seven-phase v1.0 roadmap remains complete; these phases extend it.

### Phase 1: Alpaca Feed Integration
**Rationale:** Every other v1.1 feature depends on having live stock bars in BarStore. This is the foundation — it must be correct (including backfill, reconnect, and staleness handling) before anything else is validated. Attempting multi-timeframe charts or watchlist UI without a working feed means testing against stale yfinance data, which masks problems.
**Delivers:** `backend/data/alpaca_feed.py`; lifespan wiring (yfinance polling task removed, AlpacaFeed task added); REST backfill on startup (minimum 100 bars per symbol); exponential backoff reconnect; 3-minute watchdog timer (not 60s); `ENABLE_ALPACA_FEED` env var; bar timestamp from event field (not `datetime.now()`); staleness check mirroring yfinance 90s recency pattern; `ALPACA_USE_TEST_FEED` env var for dev; feed source indicator wired to existing `WSStatusDot` component
**Addresses features:** Alpaca WebSocket feed (table stakes), graceful reconnect (table stakes), REST backfill (table stakes), feed source indicator (differentiator), test stream env var (differentiator)
**Avoids:** A1 (event loop conflict), A2 (IEX gaps — staleness indicator), A4 (406 connection limit — backoff + env var), A5 (bar timestamp convention), A8 (no backfill — REST seed on startup)

### Phase 2: Multi-Timeframe Chart Aggregation
**Rationale:** Depends on Phase 1 (requires populated BarStore to test resampling). Backend change is isolated to `charts/router.py`. The frontend timeframe switcher is a thin UI layer once the endpoint accepts `?tf=`. IFVG/CISD/EMA overlays are automatically correct on higher TFs because the backend runs the same strategy functions on already-aggregated data — no changes to the strategy engine.
**Delivers:** `?timeframe=1m|5m|15m|1h` query param on `/chart/bars/{symbol}`; pandas resample with `closed="left", label="left"`; `resampled.iloc[:-1]` guard before strategy computation; timeframe switcher pill group in ChartPage; TF state lifted to page level (persists across symbol switches)
**Uses:** `pandas>=2.0` resample (already a dependency; no new library); existing `compute_ifvg`, `compute_cisd`, `compute_ema` functions unchanged
**Avoids:** A7 (incomplete higher-TF bar — `iloc[:-1]` before strategy); Pitfall 1 (lookahead bias — same guard)

### Phase 3: Watchlist Management UI + Dynamic Feed Subscription
**Rationale:** The REST endpoints (`GET/POST/DELETE /watchlist`) already exist from v1.0. The frontend work is independent of Phases 1 and 2 from a code perspective, but is sequenced here because the dynamic feed subscription (stream restart on watchlist change) requires both the feed (Phase 1) and the UI mutations (Phase 3 UI) to exist before end-to-end testing is possible. Split execution: build WatchlistSidebar frontend first, then wire the AlpacaFeed 30s diff-check.
**Delivers:** `WatchlistSidebar` component (add/remove with inline validation, optimistic UI, error revert); `BarStore.remove(symbol)` method; AlpacaFeed 30s diff-check loop using callable watchlist getter; stream task cancel + restart pattern (not live `subscribe_bars()` call); auto-select next symbol when currently-viewed symbol is removed; empty watchlist state in main content area
**Avoids:** A3 (runtime subscribe hang — restart pattern, not live subscribe); A6 (stale BarStore after removal — explicit `bar_store.remove()` call)

### Phase 4: Deployment Hardening
**Rationale:** Alpaca's one-connection-per-account limit creates a specific risk during Render rolling deployments that is invisible in local development. This phase addresses operational concerns that only surface in production and can be verified once the full v1.1 feature set is deployed.
**Delivers:** 406-specific exponential backoff (30s, 60s, 120s); Render health-check delay configured to reduce rolling-restart connection overlap; keep-alive cron confirmed at 9:20 AM ET (already present from v1.0); verification that cold start + REST backfill produces valid signals within 5 minutes; connection identifier in logs (API key prefix) to distinguish Render vs local instances
**Avoids:** A4 (connection limit during rolling restart); Pitfall 3 (Render free tier sleep + feed reconnect)

### Phase Ordering Rationale

- Phase 1 before all others: BarStore must be populated with Alpaca bars before chart resampling, feed indicators, or watchlist subscription loops can be tested end-to-end
- Phase 2 before Phase 3: the chart endpoint `?tf=` change is independent of watchlist UI but the frontend development order benefits from having both backend changes complete before doing frontend integration testing
- Dynamic subscription in Phase 3 (not Phase 1): requires watchlist mutations to exist as a test trigger; building it in Phase 1 without a way to trigger mutations means testing only the static startup case
- Deployment hardening last: 406 overlap and cold-start timing are only observable on Render; all other phases can be validated locally

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Alpaca feed):** The `_run_forever()` private API could change in future alpaca-py versions — pin to `>=0.40.0,<0.50.0`. REST backfill deduplication logic (timestamp join between REST response and WebSocket bars at the session join point) has edge cases worth a focused investigation at plan time. Confirm `StockHistoricalDataClient.get_stock_bars()` rate limits and response format before implementing.
- **Phase 3 (dynamic subscription — stream restart):** The interaction between `asyncio.Task.cancel()` and alpaca-py's underlying WebSocket teardown is not formally documented. Confirm the old connection is fully closed before the new stream connects to avoid 406 errors on dynamic subscription changes.

Phases with well-documented patterns (skip research-phase):
- **Phase 2 (multi-timeframe aggregation):** pandas `resample()` with OHLCV agg dict is a textbook pattern; `closed="left", label="left"` convention is established across the quantitative Python ecosystem
- **Phase 4 (deployment):** Render configuration and rolling-restart behavior are validated from v1.0 deployment; keep-alive cron already in place

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | alpaca-py version, `_run_forever()` workaround, and resample pattern all verified via official docs and confirmed GitHub issues; all "what not to use" recommendations sourced to specific issues |
| Features | HIGH for table stakes; MEDIUM for differentiators | Table stakes derived from Alpaca docs and existing system requirements; differentiators (staleness indicator, test stream) are design choices, not externally validated |
| Architecture | HIGH | Based on direct inspection of existing codebase + official Alpaca SDK docs; component boundaries and data flow are explicit; build order derived from actual dependency graph |
| Pitfalls | HIGH | All major Alpaca pitfalls verified against confirmed GitHub issues (#193, #476, #491) and Alpaca official docs; not inferred from first principles |

**Overall confidence:** HIGH

### Gaps to Address

- **`_run_forever()` stability:** This is a private API (leading underscore). Behavior is confirmed in issues #476 and #193 but is not part of alpaca-py's public contract. Mitigation: pin `alpaca-py` to `>=0.40.0,<0.50.0` and add an integration test that asserts bars flow within 2 minutes of startup.

- **REST backfill deduplication edge case:** Merging Alpaca REST historical bars with incoming WebSocket bars at the session join point requires careful timestamp deduplication. A bar may exist in both the REST response and the live stream if the two requests overlap in time. The correct merge strategy (deduplicate by timestamp, take last) needs a unit test before Phase 1 is considered complete.

- **IEX coverage for the target watchlist:** IEX data quality varies by symbol. SPY and AAPL are reliable; less-liquid names may have persistent gaps. The staleness indicator mitigates user impact but the actual coverage level for the user's specific watchlist symbols is only knowable at runtime.

- **Render rolling-restart 406 window:** The exact timeout for Alpaca to release a dropped WebSocket connection and allow a new one is documented anecdotally as "~30 seconds" in the community forum, not in official docs. The 60s backoff recommendation is conservative but not precisely validated.

## Sources

### Primary (HIGH confidence)
- Alpaca WebSocket streaming docs: https://docs.alpaca.markets/docs/streaming-market-data
- Alpaca real-time stock data format: https://docs.alpaca.markets/docs/real-time-stock-pricing-data
- Alpaca Market Data FAQ (IEX vs SIP, free tier limits): https://docs.alpaca.markets/docs/market-data-faq
- alpaca-py StockDataStream SDK reference: https://alpaca.markets/sdks/python/api_reference/data/stock/live.html
- alpaca-py PyPI (version 0.43.2 confirmed): https://pypi.org/project/alpaca-py/
- alpaca-py GitHub issue #476 (`_run_forever` async pattern): https://github.com/alpacahq/alpaca-py/issues/476
- alpaca-py GitHub issue #193 (RuntimeError in running event loop): https://github.com/alpacahq/alpaca-py/issues/193
- alpaca-py GitHub issue #491 (stream hang on runtime subscribe): https://github.com/alpacahq/alpaca-py/issues/491
- pandas DataFrame.resample() docs (pandas 3.0.1): https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.resample.html
- FastAPI JWT migration to PyJWT (PR #11589): https://github.com/fastapi/fastapi/pull/11589

### Secondary (MEDIUM confidence)
- Alpaca Community Forum — IEX free tier limits: https://forum.alpaca.markets/t/iex-or-sip-with-a-free-account/17141
- Alpaca Community Forum — missing/inconsistent WebSocket bars: https://forum.alpaca.markets/t/websocket-bars-missing-inconsistent-data-stream/13747
- Alpaca Community Forum — connection limit exceeded: https://forum.alpaca.markets/t/alpaca-data-streaming-client-is-unauthorized-connection-limit-exceeded/5098
- Alpaca Community Forum — bar timestamp open vs close time: https://forum.alpaca.markets/t/timestamp-on-sip-websocket-minute-bars-beginning-or-end-of-minute/5917
- pandas OHLCV resample pattern: https://atekihcan.com/blog/codeortrading/changing-timeframe-of-ohlc-candlestick-data-in-pandas/
- MTF repainting pitfalls: https://usethinkscript.com/threads/mtf-multi-timeframe-repainting-pitfalls.16359/

### Tertiary (from v1.0 research — still relevant)
- FastAPI WebSocket official docs: https://fastapi.tiangolo.com/advanced/websockets/
- Binance WebSocket Streams official docs (24h limit): https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams
- TradingView Lightweight Charts React tutorial: https://tradingview.github.io/lightweight-charts/tutorials/react/simple
- Keep FastAPI active on Render free tier: https://medium.com/@saveriomazza/how-to-keep-your-fastapi-server-active-on-renders-free-tier-93767b70365c

---
*Research completed: 2026-03-21*
*Ready for roadmap: yes*
