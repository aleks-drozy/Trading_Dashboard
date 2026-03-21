---
status: complete
phase: 06-watchlist-management-ui-dynamic-feed-subscription
source: [06-01-SUMMARY.md, 06-02-SUMMARY.md]
started: 2026-03-21T22:00:00Z
updated: 2026-03-21T22:00:00Z
---

## Current Test

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running backend. Start fresh with `python -m uvicorn backend.main:app --reload`. Server should boot without errors, DB migrations complete, and the app respond at http://localhost:8000/docs.
result: pass

### 2. WatchlistSidebar visible on dashboard
expected: Open the dashboard (after logging in). A 240px sidebar should appear on the left side of the main content area, showing your current watchlist symbols (or an empty state if none are added yet).
result: pass

### 3. Add a symbol to the watchlist
expected: Type a ticker (e.g. "AAPL") into the input field in the sidebar, press Enter or click "+". The symbol should appear in the sidebar list immediately (optimistic). An "awaiting data" label should show next to it until the WebSocket signal stream includes it.
result: pass

### 4. Duplicate symbol validation
expected: Try adding a symbol that's already in the watchlist. The sidebar should show an inline error: "Already in watchlist" — no API call should be made.
result: pass

### 5. Invalid ticker format validation
expected: Type something like "123" or "ab!cd" and try to add it. The sidebar should show an inline error: "Invalid ticker format" — no API call should be made.
result: pass
note: "Fixed regex to require first char to be a letter — confirmed by user after fix"

### 6. Remove a symbol from the watchlist
expected: Click the remove button next to a symbol. It should disappear from the sidebar immediately (optimistic). The backend removes it and the feed stops streaming bars for that symbol.
result: pass

### 7. Feed restarts after watchlist change
expected: Add or remove a stock symbol. Within ~30 seconds (no backend restart), the backend log should show the AlpacaFeed restarting with the updated symbol list. The "awaiting data" label on a newly added symbol should eventually disappear as signals start arriving.
result: blocked
blocked_by: third-party
reason: "No ALPACA_API_KEY or ALPACA_SECRET_KEY in .env — feed stream cannot connect to Alpaca to verify restart behavior"

## Summary

total: 7
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 1

## Gaps

[none]
