# Deferred Items — Phase 04: Alpaca Real-time Feed

## Pre-existing Issues (out of scope for Plan 04-01)

### TestLifespanFeedWiring::test_lifespan_creates_three_tasks (Test 11)

- **Status:** Pre-existing failure — confirmed present before Plan 04-01 changes
- **Root cause:** Test expects 3 tasks (yfinance + broadcaster + binance) but lifespan creates 2 by default (binance is opt-in behind ENABLE_BINANCE_FEED=true env var)
- **Resolution:** Plan 04-02 will rewire lifespan to use AlpacaFeed and the task count will change accordingly. Update test 11 to reflect the new lifespan task structure (alpaca_feed + broadcaster).
- **Discovered during:** Plan 04-01, Task 2 (GREEN phase)
