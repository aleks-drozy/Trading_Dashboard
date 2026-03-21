---
phase: 03-charts-backtest-deployment
plan: 02
subsystem: infra
tags: [render, vercel, deployment, vite, environment-variables]

requires:
  - phase: 02-live-signal-dashboard-paper-trading
    provides: FastAPI backend with /auth, /watchlist, /paper, /ws endpoints

provides:
  - render.yaml defining Render web service with health check and keep-alive cron
  - frontend/vercel.json enabling SPA client-side routing
  - Configurable API base URL via VITE_API_URL environment variable
  - Vite dev proxy extended with /chart, /backtest, /health routes
  - GET /health endpoint on FastAPI backend

affects: [deployment, frontend-api-calls, chart-api, backtest-api]

tech-stack:
  added: []
  patterns:
    - "VITE_API_URL env var pattern: empty string in dev (Vite proxy), full Render URL in production"
    - "fetchWithAuth prepends API_BASE for relative URLs, passes absolute URLs through unchanged"

key-files:
  created:
    - render.yaml
    - frontend/vercel.json
  modified:
    - frontend/vite.config.ts
    - frontend/src/lib/api.ts
    - backend/main.py

key-decisions:
  - "API_BASE uses VITE_API_URL ?? '' — empty in dev preserves existing Vite proxy behavior, full URL in production enables cross-origin requests to Render"
  - "fetchWithAuth checks url.startsWith('http') before prepending API_BASE — safe for both relative and absolute URLs"
  - "render.yaml cron at 20 13 * * 1-5 (9:20 AM ET) pings /health to prevent Render free tier sleep before NY session open at 9:30 AM"
  - "/health endpoint added to backend/main.py — required by render.yaml healthCheckPath and keep-alive cron"

patterns-established:
  - "Pattern 1: All API calls in frontend go through fetchWithAuth which applies API_BASE prefix"
  - "Pattern 2: New backend routes added to vite.config.ts proxy at the same time they are created"

requirements-completed: [DEPLOY-01, DEPLOY-02]

duration: 6min
completed: 2026-03-21
---

# Phase 03 Plan 02: Deployment Configuration Summary

**render.yaml + vercel.json deployment scaffolding with configurable API base URL, keep-alive cron at 9:20 AM ET, and extended Vite dev proxy for chart and backtest routes**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-21T13:23:23Z
- **Completed:** 2026-03-21T13:29:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- render.yaml defines Python web service on Render free tier with uvicorn start command, /health check path, FRONTEND_URL/SECRET_KEY/ADMIN_EMAIL/ADMIN_PASSWORD_HASH env vars, and a keep-alive cron that pings /health at 9:20 AM ET Mon-Fri
- frontend/vercel.json enables SPA routing with a catch-all rewrite to /index.html so React Router paths (/dashboard, /backtest, /chart) work after deployment
- Frontend API_BASE switches from hardcoded empty string to `import.meta.env.VITE_API_URL ?? ''` — in dev nothing changes, in production set VITE_API_URL to the Render service URL on Vercel
- fetchWithAuth updated to prepend API_BASE for relative URLs, preserving existing behavior for absolute URLs

## Task Commits

Each task was committed atomically:

1. **Task 1: Create render.yaml and vercel.json deployment configs** - `282dc79` (feat)
2. **Task 2: Update Vite proxy and API base URL for production** - `308f758` (feat)

## Files Created/Modified

- `render.yaml` - Render service definition: Python runtime, free plan, uvicorn start command, health check, env vars, keep-alive cron
- `frontend/vercel.json` - Vercel SPA routing: catch-all rewrites to /index.html
- `frontend/vite.config.ts` - Dev proxy extended with /chart, /backtest, /health routes
- `frontend/src/lib/api.ts` - API_BASE configurable via VITE_API_URL; fetchWithAuth prepends API_BASE for relative URLs
- `backend/main.py` - Added GET /health endpoint returning {status: ok}

## Decisions Made

- Used `VITE_API_URL ?? ''` (nullish coalescing) rather than `|| ''` to handle the case where VITE_API_URL is explicitly set to an empty string
- Checked `url.startsWith('http')` in fetchWithAuth to safely handle any absolute URLs that might be passed directly
- Added /health endpoint to backend immediately — it is required by both render.yaml healthCheckPath and the keep-alive cron command

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added GET /health endpoint to backend/main.py**
- **Found during:** Task 1 (Create render.yaml)
- **Issue:** render.yaml references `healthCheckPath: /health` and the keep-alive cron command `curl -s $RENDER_EXTERNAL_URL/health`, but no /health route existed in the backend
- **Fix:** Added `@app.get("/health")` returning `{"status": "ok"}` at the bottom of backend/main.py
- **Files modified:** backend/main.py
- **Verification:** Endpoint present in main.py; committed as part of Task 1 commit
- **Committed in:** 282dc79

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential — Render would have failed health checks without the /health endpoint. No scope creep.

## Issues Encountered

None.

## User Setup Required

Deployment requires manual configuration in two external dashboards:

**Render (backend):**
1. Connect GitHub repo, select render.yaml-based deployment
2. Set environment variables in the Render dashboard:
   - `SECRET_KEY` — random 32+ char string
   - `ADMIN_EMAIL` — your login email
   - `ADMIN_PASSWORD_HASH` — bcrypt hash of your admin password
   - `FRONTEND_URL` — your Vercel deployment URL (for CORS)

**Vercel (frontend):**
1. Connect GitHub repo, set root directory to `frontend`
2. Set environment variable:
   - `VITE_API_URL` — your Render service URL (e.g., `https://trading-dashboard-api.onrender.com`)

## Next Phase Readiness

- Deployment infrastructure ready; actual deployment happens after chart and backtest features are complete (plans 03-01, 03-03, 03-04)
- The /chart and /backtest Vite proxy entries are pre-wired and will work once backend routers are added

---
## Self-Check: PASSED

All files confirmed on disk. All commits confirmed in git log.

*Phase: 03-charts-backtest-deployment*
*Completed: 2026-03-21*
