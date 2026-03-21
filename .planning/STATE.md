---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: milestone
status: unknown
stopped_at: Completed 06-01-PLAN.md
last_updated: "2026-03-21T21:26:11.521Z"
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 19
  completed_plans: 19
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** Open the dashboard during the NY session and instantly see whether IFVG + CISD + EMA conditions align for a trade — without TradingView open.
**Current focus:** Phase 06 — watchlist-management-ui-dynamic-feed-subscription

## Current Position

Phase: 06
Plan: Not started

## Performance Metrics

**Velocity:**

- Total plans completed: 2
- Average duration: ~4 min
- Total execution time: ~8 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-strategy-engine | 2/5 | ~8 min | ~4 min |

**Recent Trend:**

- Last 5 plans: P01 (~5 min), P02 (~2 min)
- Trend: Fast

*Updated after each plan completion*
| Phase 01-foundation-strategy-engine P01 | 5 min | 2 tasks | 18 files |
| Phase 01-foundation-strategy-engine P02 | 2 min | 2 tasks | 5 files |
| Phase 01-foundation-strategy-engine P03 | 9min | 2 tasks | 5 files |
| Phase 01-foundation-strategy-engine P04 | 5 | 2 tasks | 3 files |
| Phase 01-foundation-strategy-engine P05 | 8min | 6 tasks | 9 files |
| Phase 02-live-signal-dashboard-paper-trading P02 | 7 min | 2 tasks | 15 files |
| Phase 02-live-signal-dashboard-paper-trading P01 | 7min | 2 tasks | 7 files |
| Phase 02-live-signal-dashboard-paper-trading P03 | 8 | 2 tasks | 8 files |
| Phase 02-live-signal-dashboard-paper-trading P04 | 15min | 2 tasks | 14 files |
| Phase 02-live-signal-dashboard-paper-trading P04 | 35 | 3 tasks | 15 files |
| Phase 03-charts-backtest-deployment P02 | 1min | 2 tasks | 5 files |
| Phase 03-charts-backtest-deployment P01 | 3 | 2 tasks | 5 files |
| Phase 03-charts-backtest-deployment P03 | 2min | 2 tasks | 4 files |
| Phase 03-charts-backtest-deployment P04 | 2min | 2 tasks | 6 files |
| Phase 04-alpaca-real-time-feed P01 | 3min | 2 tasks | 4 files |
| Phase 04-alpaca-real-time-feed P02 | 2 | 2 tasks | 2 files |
| Phase 05-multi-timeframe-chart-aggregation P01 | 2min | 1 tasks | 3 files |
| Phase 05-multi-timeframe-chart-aggregation P02 | 1min | 1 tasks | 1 files |
| Phase 05-multi-timeframe-chart-aggregation P02 | 5min | 2 tasks | 1 files |
| Phase 06-watchlist-management-ui-dynamic-feed-subscription P02 | 3min | 2 tasks | 3 files |
| Phase 06-watchlist-management-ui-dynamic-feed-subscription P01 | 3min | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-build]: Do NOT use `python-jose` — abandoned, use PyJWT 2.8+ instead
- [Pre-build]: Do NOT use TA-Lib — C binary compilation unreliable on Render; use pandas-ta (pure Python)
- [Pre-build]: Strategy engine must be validated bar-by-bar against TradingView output BEFORE any UI or WebSocket work begins
- [Pre-build]: SQLite persistence decision needed before Phase 2 — three options: accept ephemeral, add export endpoint, or add Render Persistent Disk ($1/month)
- [Phase 01-foundation-strategy-engine]: FYP_BOT_1_3.pine committed to docs/reference/ as read-only PineScript v6 strategy specification (542 lines)
- [Phase 01-foundation-strategy-engine]: PyJWT 2.12.1 used — python-jose is abandoned and NOT used
- [Phase 01-foundation-strategy-engine]: Lazy SQLite engine via get_engine() avoids import-time ValidationError without .env
- [Phase 01-foundation-strategy-engine]: algorithms=['HS256'] explicit in jwt.decode (security requirement)
- [Phase 01-foundation-strategy-engine]: Single-user auth via env vars — no users table in database
- [Phase 01-foundation-strategy-engine P02]: IntegrityError caught at router layer (not repository) — router owns HTTP semantics
- [Phase 01-foundation-strategy-engine P02]: seed_defaults() is idempotent — checks get_all() before seeding
- [Phase 01-foundation-strategy-engine P02]: symbol stored as .upper() in repository.add() for case-insensitive uniqueness
- [Phase 01-foundation-strategy-engine]: Injectable BarStore in BinanceFeed enables test isolation without patching module-level globals
- [Phase 01-foundation-strategy-engine]: Patchable yfinance helpers (_apply_market_hours_filter, _is_stale) make time-sensitive tests deterministic
- [Phase 01-foundation-strategy-engine]: Placeholder CSV fixtures accepted — user will replace with real TradingView exports before bar-by-bar validation tests run
- [Phase 01-foundation-strategy-engine]: Fixture column schema locked: timestamp,open,high,low,close,volume,ifvg_state,cisd_state,ema_20
- [Phase 01-foundation-strategy-engine]: pandas-ta df.ta.ema(length=20, adjust=False) matches TradingView recursive EMA — no TA-Lib, no ewm(adjust=True)
- [Phase 01-foundation-strategy-engine]: Lookahead guardrail structural: df.iloc[:-1] as first line of StrategyEngine.run() — lookahead bias test uses synthetic data and passes unconditionally
- [Phase 01-foundation-strategy-engine]: Bar-by-bar fixture tests skip gracefully on placeholder CSVs — will auto-activate when user replaces with real TradingView exports
- [Phase 02-live-signal-dashboard-paper-trading]: Vite 6 used instead of Vite 8 — Node 21.7.1 is incompatible with rolldown bundler in Vite 8; Vite 6 supports Node 18+
- [Phase 02-live-signal-dashboard-paper-trading]: shadcn/ui CLI creates components in literal @/ path on Windows — must be moved to src/components/ui/ after generation
- [Phase 02-live-signal-dashboard-paper-trading]: StrategyEngine imported lazily inside _get_engine() to avoid pandas_ta->numba->llvmlite import chain at module load — keeps test suite importable in environments where native libs are mismatched
- [Phase 02-live-signal-dashboard-paper-trading]: WebSocket auth uses ?token= query param (not Authorization header) — browsers do not support custom headers on WebSocket upgrade
- [Phase 02-live-signal-dashboard-paper-trading]: SignalBroadcaster.broadcast() silently removes dead clients on exception — maintains loop stability when clients disconnect mid-broadcast
- [Phase 02-live-signal-dashboard-paper-trading]: Lazy TYPE_CHECKING import for StrategyResult in paper engine — avoids pandas_ta->numba->llvmlite chain at module load
- [Phase 02-live-signal-dashboard-paper-trading]: try/except in check_and_close_open_trades() — DB not ready is valid transient state during test isolation; silently skip
- [Phase 02-live-signal-dashboard-paper-trading]: _MockStrategyResult in tests to avoid numba import chain — mirrors real frozen dataclass
- [Phase 02-live-signal-dashboard-paper-trading]: Sonner imported directly from 'sonner' package — shadcn generated sonner.tsx had circular self-import; fixed wrapper to use npm package directly
- [Phase 02-live-signal-dashboard-paper-trading]: wasConnectedRef guards disconnect toast — only fires when established connection drops, not on initial connecting state
- [Phase 02-live-signal-dashboard-paper-trading]: pandas ewm(adjust=False) replaces pandas_ta to fix llvmlite version mismatch; recursive EMA formula is mathematically identical
- [Phase 02-live-signal-dashboard-paper-trading]: SignalTable empty state is session-aware — Awaiting market open / NY session 9:30-10:30 AM ET
- [Phase 03-charts-backtest-deployment]: API_BASE uses VITE_API_URL ?? '' — empty in dev preserves Vite proxy behavior, full URL in production enables cross-origin requests to Render
- [Phase 03-charts-backtest-deployment]: render.yaml keep-alive cron at 20 13 * * 1-5 (9:20 AM ET) pings /health to prevent Render free tier sleep before NY session
- [Phase 03-charts-backtest-deployment]: C:/Program Files/Git/health endpoint added to backend/main.py — required by render.yaml healthCheckPath
- [Phase 03-charts-backtest-deployment]: extract_ifvg_zones() replicates compute_ifvg loop to return top/bottom/startTime/endTime/type zone geometry for chart overlays
- [Phase 03-charts-backtest-deployment]: All chart/backtest timestamps returned as Unix epoch SECONDS (not milliseconds) — lightweight-charts API requirement
- [Phase 03-charts-backtest-deployment]: CORS configured via FRONTEND_URL env var with http://localhost:5173 default for dev/prod parity
- [Phase 03-charts-backtest-deployment]: IFVG zones implemented as paired price lines rather than ISeriesPrimitive rectangles — simpler and avoids uncertain v5 canvas renderer signature
- [Phase 03-charts-backtest-deployment]: ChartPage defaults wsStatus=disconnected and nySessionActive=false — chart page has no WebSocket connection
- [Phase 03-charts-backtest-deployment]: recharts AreaChart for equity curve — declarative React, no imperative canvas API
- [Phase 03-charts-backtest-deployment]: Native date inputs with min/max for 7-day constraint enforcement on backtest form
- [v1.1 roadmap]: AlpacaFeed uses asyncio.create_task(stream._run_forever()) — StockDataStream.run() calls asyncio.run() internally and raises RuntimeError in FastAPI's event loop (alpaca-py issue #476)
- [v1.1 roadmap]: Dynamic watchlist subscription uses stream cancel + restart pattern — stream.subscribe_bars() on a live connection has a confirmed hang bug (alpaca-py issue #491)
- [v1.1 roadmap]: Multi-timeframe aggregation is on-demand pandas resample in charts/router.py — no pre-computed per-TF BarStore entries; resampled.iloc[:-1] guard before strategy computation
- [v1.1 roadmap]: Phase 6 depends on Phase 4 (not Phase 5) — watchlist sidebar UI is frontend-only against existing REST API; stream restart diff-check requires only AlpacaFeed to exist
- [Phase 04-alpaca-real-time-feed]: asyncio.create_task(stream._run_forever()) avoids RuntimeError in FastAPI event loop (alpaca-py #476)
- [Phase 04-alpaca-real-time-feed]: bar_set.data.get(symbol, []) preferred over bar_set.get() for safe BarSet access
- [Phase 04-alpaca-real-time-feed]: backfill_bars awaited before AlpacaFeed.run() task — ensures BarStore has historical data before live bars arrive
- [Phase 04-alpaca-real-time-feed]: AlpacaFeed task guarded by settings.alpaca_api_key — app starts cleanly without Alpaca credentials configured
- [Phase 05-multi-timeframe-chart-aggregation]: resample_bars uses df.resample(f'{minutes}min').agg().dropna().iloc[:-1] — dropna removes empty market-gap buckets; iloc[:-1] drops in-progress bar
- [Phase 05-multi-timeframe-chart-aggregation]: pd.to_datetime(b.timestamp, utc=True) used when building chart DataFrame to ensure timezone-aware DatetimeIndex required by pandas resample
- [Phase 05-multi-timeframe-chart-aggregation]: Timeframe state uses useState not useRef — component stays mounted across symbol switches so useState already persists
- [Phase 05-multi-timeframe-chart-aggregation]: Empty state copy uses .replace('1h', label) on a single template string to produce per-timeframe messages without duplication
- [Phase 05-multi-timeframe-chart-aggregation]: Timeframe state uses useState not useRef — component stays mounted across symbol switches so useState already persists
- [Phase 05-multi-timeframe-chart-aggregation]: Empty state copy uses .replace('1h', label) on a single template string to produce per-timeframe messages without duplication
- [Phase 06-watchlist-management-ui-dynamic-feed-subscription]: WatchlistSidebar is a 240px sticky panel with same background as page (no elevation); signalSymbols derived from WebSocket signals in DashboardPage and passed as prop for awaiting-data detection
- [Phase 06-watchlist-management-ui-dynamic-feed-subscription]: Watchlist router converted to async def — asyncio.Event.set() from sync thread-pool routes silently fails to wake event.wait() waiters
- [Phase 06-watchlist-management-ui-dynamic-feed-subscription]: feed_restart_event as module-level singleton in alpaca_feed.py — mirrors existing bar_store pattern; watchlist router imports and calls event.set() directly
- [Phase 06-watchlist-management-ui-dynamic-feed-subscription]: get_symbols callable injected into AlpacaFeed — decouples feed from startup-time symbol snapshot; symbols refreshed from DB on every restart iteration

### Pending Todos

None.

### Blockers/Concerns

- [Phase 4 — critical]: alpaca-py _run_forever() is a private API — pin to >=0.40.0,<0.50.0 and add integration test asserting bars flow within 2 minutes of startup
- [Phase 4 — critical]: REST backfill timestamp deduplication edge case — a bar may exist in both the Alpaca REST response and the live WebSocket stream at the session join point; deduplicate by timestamp (take last) and cover with a unit test before Phase 4 is complete
- [Phase 6 — watch]: asyncio.Task.cancel() interaction with alpaca-py WebSocket teardown is undocumented — confirm old connection fully closes before new stream connects to avoid 406 errors on dynamic subscription changes

## Session Continuity

Last session: 2026-03-21T21:21:45.104Z
Stopped at: Completed 06-01-PLAN.md
Resume file: None
