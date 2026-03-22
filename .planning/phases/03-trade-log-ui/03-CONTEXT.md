# Phase 3: Trade Log UI - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Full trade log UI: add/edit/view/delete trades, paginated trade list with filter/sort controls, and a live P&L preview in the trade form. Routes: `/trades`, `/trades/new`, `/trades/[id]`, `/trades/[id]/edit`. Authenticated layout (sidebar) is also built in this phase since it doesn't exist yet.

</domain>

<decisions>
## Implementation Decisions

### App shell & navigation
- **D-01:** Left sidebar layout for all authenticated pages — sidebar + main content area side by side
- **D-02:** Sidebar contains: app logo/name at top, nav links (Dashboard, Trades) in the middle, user avatar + sign-out at the bottom
- **D-03:** Sidebar is fixed width, always visible — no collapse toggle; on tablet, sidebar collapses to icon-only width (Phase 5 handles full responsive polish)
- **D-04:** Active nav link style: `#00ff88` text color + 2px left border accent in `#00ff88`; inactive links in `#6b7280` with hover to `#e5e7eb`

### Trade list interactions
- **D-05:** Clicking anywhere on a trade row navigates to `/trades/[id]`; an Edit button appears on row hover (not always visible, to reduce clutter)
- **D-06:** Delete is a two-step inline confirmation — first click shows "Confirm?" and "Cancel" in place; second click executes the delete; no modal required
- **D-07:** Empty state when no trades: centered text "No trades yet. Log your first trade to see it here." with a primary Button linking to `/trades/new`
- **D-08:** When filters are active and return zero results, show: "No trades match your filters." with a "Clear filters" link

### Trade form structure
- **D-09:** Single scrollable page with grouped sections — no wizard/steps:
  1. **Trade Info** — Symbol, Asset Class, Direction
  2. **Entry / Exit** — Entry Price, Exit Price, Quantity, Stop Loss (optional), Take Profit (optional), Entry Date, Exit Date (optional)
  3. **Options Fields** — Strike Price, Expiration Date, Contract Type (call/put), Premium — shown only when Asset Class = `options`
  4. **Context** — Strategy (text input), Tags (multi-value text input), Notes (textarea), Chart Screenshot (file upload)
- **D-10:** Live P&L preview is a sticky bar fixed at the bottom of the form; shows P&L amount (green/red), P&L %, and R:R ratio; updates on every keystroke to entry price, exit price, or quantity fields; is blank/hidden when exit price is absent
- **D-11:** Chart image upload: click-to-upload button opens native file picker; after file selection, show a small thumbnail preview below the button; upload occurs on form submit (POST /api/upload first, then save/update trade with returned URL); upload failures are non-blocking — trade saves without image and a toast notification is shown

### Filter bar UX
- **D-12:** Filter bar is always visible above the trade table — no toggle/collapse
- **D-13:** Filters apply immediately on change — each filter change updates URL query params and triggers a new API call; no "Apply" button
- **D-14:** Filter controls: Asset Class (select), Direction (select), Status (select), Strategy (select — populated from GET /api/trades/meta), Tags (multi-select — populated from GET /api/trades/meta), From date (native date input), To date (native date input)
- **D-15:** Sort controls are inline with the filter bar: Sort By select (Entry Date / P&L / Symbol) + Sort Direction toggle (↑↓)
- **D-16:** Active filters are reflected in the URL (query params) so page state is shareable/bookmarkable; filter state is managed via `useSearchParams` / `useRouter`

### Claude's Discretion
- Exact sidebar width (suggest ~200-220px)
- Toast notification implementation (simple top-right toast, no library required)
- Tags input implementation (comma-separated or enter-to-add pattern)
- Exact table column widths and responsive overflow behavior

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design spec & data model
- `docs/superpowers/specs/2026-03-22-trading-journal-design.md` — Complete app design spec: trade model, API routes, filter params, P&L formulas, visual design tokens

### Existing UI components (reuse, do not recreate)
- `components/ui/Button.tsx` — Primary/secondary button, loading state, disabled state
- `components/ui/Input.tsx` — Labeled input with error state, blur validation pattern
- `components/ui/Card.tsx` — `#1a1a1a` card surface, `#2a2a2a` border, rounded-xl
- `components/ui/Spinner.tsx` — Loading spinner used inside Button

### Existing form patterns (replicate the approach)
- `components/auth/LoginForm.tsx` — Canonical example of Zod client-side validation + React state field errors pattern used in this codebase

### Trade data contracts
- `schemas/trade.ts` — Zod create/update schemas; all form fields and their validation rules
- `lib/calculations.ts` — P&L/R:R calculation functions for live preview logic
- `lib/models/Trade.ts` — Mongoose Trade model; field names and types

### API routes (Phase 2 — already built)
- `app/api/trades/route.ts` — GET (list with filters/sort/pagination) + POST (create)
- `app/api/trades/[id]/route.ts` — GET, PUT, DELETE single trade
- `app/api/trades/meta/route.ts` — GET strategies + tags for filter dropdowns
- `app/api/upload/route.ts` — POST chart image to Cloudinary

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Button`: use for all CTAs, form submits, and action buttons; supports `loading` prop for async ops
- `Input`: use for all text/number/date inputs; `label` prop is required, `error` prop shows red validation message
- `Card`: use as container for form sections and table wrapper
- `Spinner`: already imported by Button; available standalone if needed

### Established Patterns
- **Form validation:** Zod `safeParse` client-side on submit + `validateField` on blur; field errors stored in `useState<Record<string, string>>({})`; server errors shown in a red-bordered `div` above the form
- **Color tokens:** `#0f0f0f` bg, `#1a1a1a` card, `#2a2a2a` border, `#00ff88` green accent, `#ef4444` red, `#e5e7eb` primary text, `#6b7280` muted text — use these directly, no Tailwind config extension needed
- **Auth pattern:** `signIn` / `useSession` from `next-auth/react`; protected pages are server components that check session via NextAuth

### Integration Points
- Sidebar goes in a new `app/(dashboard)/layout.tsx` — wraps all dashboard routes (dashboard, trades pages) with sidebar + content area
- Trade form calls `POST /api/upload` first (if image selected), gets back a URL, then includes `chartImageUrl` in the `POST /api/trades` body
- Filter/sort/pagination state lives in URL search params; `useSearchParams()` reads current params, `useRouter().push()` updates them

</code_context>

<deferred>
## Deferred Ideas

- Sidebar mini stats widget (P&L, win rate in sidebar) — Phase 4 or 5
- Toast notification library (e.g. react-hot-toast) — keep it custom/simple for Phase 3
- Mobile nav (hamburger menu) — Phase 5 handles responsive polish
- Bulk select and delete — v2 backlog

</deferred>

---

*Phase: 03-trade-log-ui*
*Context gathered: 2026-03-22*
