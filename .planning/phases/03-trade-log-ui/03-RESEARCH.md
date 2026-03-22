# Phase 3: Trade Log UI - Research

**Researched:** 2026-03-22
**Domain:** Next.js 16 App Router UI — server components, client forms, URL-driven filter state, live preview
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**App shell & navigation**
- D-01: Left sidebar layout for all authenticated pages — sidebar + main content area side by side
- D-02: Sidebar contains: app logo/name at top, nav links (Dashboard, Trades) in the middle, user avatar + sign-out at the bottom
- D-03: Sidebar is fixed width, always visible — no collapse toggle; on tablet, sidebar collapses to icon-only width (Phase 5 handles full responsive polish)
- D-04: Active nav link style: `#00ff88` text color + 2px left border accent in `#00ff88`; inactive links in `#6b7280` with hover to `#e5e7eb`

**Trade list interactions**
- D-05: Clicking anywhere on a trade row navigates to `/trades/[id]`; an Edit button appears on row hover (not always visible, to reduce clutter)
- D-06: Delete is a two-step inline confirmation — first click shows "Confirm?" and "Cancel" in place; second click executes the delete; no modal required
- D-07: Empty state when no trades: centered text "No trades yet. Log your first trade to see it here." with a primary Button linking to `/trades/new`
- D-08: When filters are active and return zero results, show: "No trades match your filters." with a "Clear filters" link

**Trade form structure**
- D-09: Single scrollable page with grouped sections — no wizard/steps:
  1. Trade Info — Symbol, Asset Class, Direction
  2. Entry / Exit — Entry Price, Exit Price, Quantity, Stop Loss (optional), Take Profit (optional), Entry Date, Exit Date (optional)
  3. Options Fields — Strike Price, Expiration Date, Contract Type (call/put), Premium — shown only when Asset Class = `options`
  4. Context — Strategy (text input), Tags (multi-value text input), Notes (textarea), Chart Screenshot (file upload)
- D-10: Live P&L preview is a sticky bar fixed at the bottom of the form; shows P&L amount (green/red), P&L %, and R:R ratio; updates on every keystroke to entry price, exit price, or quantity fields; is blank/hidden when exit price is absent
- D-11: Chart image upload: click-to-upload button opens native file picker; after file selection, show a small thumbnail preview below the button; upload occurs on form submit (POST /api/upload first, then save/update trade with returned URL); upload failures are non-blocking — trade saves without image and a toast notification is shown

**Filter bar UX**
- D-12: Filter bar is always visible above the trade table — no toggle/collapse
- D-13: Filters apply immediately on change — each filter change updates URL query params and triggers a new API call; no "Apply" button
- D-14: Filter controls: Asset Class (select), Direction (select), Status (select), Strategy (select — populated from GET /api/trades/meta), Tags (multi-select — populated from GET /api/trades/meta), From date (native date input), To date (native date input)
- D-15: Sort controls are inline with the filter bar: Sort By select (Entry Date / P&L / Symbol) + Sort Direction toggle (↑↓)
- D-16: Active filters are reflected in the URL (query params) so page state is shareable/bookmarkable; filter state is managed via `useSearchParams` / `useRouter`

### Claude's Discretion
- Exact sidebar width (suggest ~200-220px)
- Toast notification implementation (simple top-right toast, no library required)
- Tags input implementation (comma-separated or enter-to-add pattern)
- Exact table column widths and responsive overflow behavior

### Deferred Ideas (OUT OF SCOPE)
- Sidebar mini stats widget (P&L, win rate in sidebar) — Phase 4 or 5
- Toast notification library (e.g. react-hot-toast) — keep it custom/simple for Phase 3
- Mobile nav (hamburger menu) — Phase 5 handles responsive polish
- Bulk select and delete — v2 backlog
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOG-01 | User can view a paginated list of their trades (20 per page) | GET /api/trades already returns `pagination: { page, totalPages, total }`; UI needs page number controls wired to `?page=N` query param |
| LOG-02 | User can filter trades by asset class, direction, status, strategy, tags, and date range | All filter params accepted by GET /api/trades; UI manages state via useSearchParams; immediate-apply on change |
| LOG-03 | User can sort trades by entry date, P&L, or symbol (asc/desc) | API accepts `sortBy` + `sortDir`; UI adds Sort By select + direction toggle in filter bar |
| LOG-04 | Strategy and tag filter dropdowns are populated from user's existing trade data | GET /api/trades/meta returns `{ strategies, tags }`; fetched client-side on page load |
| LOG-05 | Trade list shows symbol, asset class, direction, entry date, P&L, and status at a glance | Table columns mapped from Trade model fields; P&L uses color coding (#00ff88 / #ef4444) |
| TRADE-10 | Trade form shows live P&L preview as user types entry/exit price and quantity | `calculateTradeMetrics()` from `lib/calculations.ts` runs client-side on every change; sticky bar at bottom of form |
</phase_requirements>

---

## Summary

Phase 3 builds the full trade log UI on top of the complete API surface from Phase 2. The tech stack (Next.js 16 App Router, React 19, Tailwind CSS v4, Zod v4, lucide-react) is already installed and in active use. No new dependencies are needed for core functionality.

The central architectural challenge is the `(dashboard)` route group layout. Currently `app/(dashboard)/dashboard/page.tsx` exists as a bare page with no shared layout. This phase must introduce `app/(dashboard)/layout.tsx` that renders the sidebar + content wrapper, replacing the per-page `min-h-screen` approach. All existing and new dashboard pages inherit this layout automatically — the dashboard page itself requires no changes.

A secondary challenge is the proxy middleware gap: `proxy.ts` currently protects `/dashboard` routes but not `/trades` routes. The matcher pattern already covers all routes, but the redirect logic explicitly checks `pathname.startsWith("/dashboard")`. This must be updated to redirect `/trades` paths as well before any trade UI routes go live. The fix is a one-line change to the condition check.

**Primary recommendation:** Build in this order — (1) dashboard layout with sidebar, (2) new UI primitives (Select, Badge, Textarea), (3) trade list page with filter/sort/pagination, (4) add/edit trade form with live P&L preview, (5) trade detail view. The sidebar and layout unlock all other pages.

---

## Standard Stack

### Core (already installed — no new installs required for core features)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.1 | App Router, server components, routing | Already installed; all APIs available |
| react | 19.2.4 | Client components, hooks, state | Already installed |
| tailwindcss | ^4 | Utility CSS with dark theme | Already installed, all color tokens in use |
| zod | ^4.3.6 | Form validation (client-side safeParse pattern) | Already used in LoginForm.tsx — replicate exactly |
| lucide-react | ^0.577.0 | Icons (sidebar nav, sort arrows, delete icon, etc.) | Already installed |
| next-auth | ^5.0.0-beta.30 | Session access via `useSession()` for sidebar user info | Already installed |

### Supporting (no new installs)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `next/navigation` `useSearchParams` | built-in | Read URL filter/sort/page state in client components | Filter bar, pagination |
| `next/navigation` `useRouter` | built-in | Push URL updates when filters change | Filter bar onChange handlers |
| `lib/calculations.ts` | local | Live P&L preview computation | Trade form — call on every entryPrice/exitPrice/quantity change |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom Select component | native `<select>` | Native select is simpler and matches dark theme via CSS; use native `<select>` styled with Tailwind since no library is installed |
| Custom toast | react-hot-toast | Deferred by design decision — build a simple fixed-position `div` that auto-dismisses via `setTimeout` |
| Custom tags input | react-select, downshift | Deferred; use comma-separated or enter-to-add with a simple `useState<string[]>` approach |

**Installation:** No new packages required for Phase 3 core features.

---

## Architecture Patterns

### Recommended Project Structure

```
app/(dashboard)/
├── layout.tsx               # NEW — sidebar + content wrapper for all dashboard routes
├── dashboard/
│   └── page.tsx             # EXISTS — no changes needed; inherits new layout
└── trades/
    ├── page.tsx             # NEW — trade list with filter bar and table
    ├── new/
    │   └── page.tsx         # NEW — add trade form
    └── [id]/
        ├── page.tsx         # NEW — trade detail view
        └── edit/
            └── page.tsx     # NEW — edit trade form (prefetches trade by ID)

components/
├── ui/
│   ├── Button.tsx           # EXISTS — use as-is
│   ├── Input.tsx            # EXISTS — use as-is
│   ├── Card.tsx             # EXISTS — use as-is (remove max-w-[400px] override when used in wider layouts)
│   ├── Spinner.tsx          # EXISTS — use as-is
│   ├── Divider.tsx          # EXISTS — use as-is
│   ├── Select.tsx           # NEW — native <select> with dark theme styling matching Input.tsx
│   ├── Badge.tsx            # NEW — status/direction/asset class pill (open=gray, closed=green, long=green, short=red)
│   └── Textarea.tsx         # NEW — multiline input matching Input.tsx styling
├── layout/
│   └── Sidebar.tsx          # NEW — sidebar with logo, nav links, user avatar, sign-out
└── trades/
    ├── TradeTable.tsx        # NEW — table of trades with hover edit, inline delete confirm
    ├── TradeFilterBar.tsx    # NEW — filter controls + sort controls wired to URL params
    ├── TradeForm.tsx         # NEW — unified add/edit form component (variant prop: 'create'|'edit')
    ├── PnlPreviewBar.tsx     # NEW — sticky bottom bar showing live P&L/pnlPercent/R:R
    ├── TradeDetail.tsx       # NEW — read-only detail view with chart image
    └── TradeStatusBadge.tsx  # NEW — open/closed badge (wraps Badge.tsx)
```

### Pattern 1: Dashboard Layout with Route Group

**What:** `app/(dashboard)/layout.tsx` renders the sidebar alongside `{children}`. All routes nested under `(dashboard)/` automatically receive the sidebar without being affected by the `(auth)/` layout.

**When to use:** All authenticated dashboard pages — dashboard, trades list, trade form, trade detail.

**Example:**
```typescript
// app/(dashboard)/layout.tsx
// Server Component — reads session server-side for initial render
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="flex min-h-screen bg-[#0f0f0f]">
      <Sidebar user={session.user} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
```

### Pattern 2: URL-Driven Filter State

**What:** Filter/sort/page state lives entirely in URL search params. Client components read state via `useSearchParams()` and write state via `router.push()`. Each filter change replaces the current URL entry.

**When to use:** Trade list page filter bar (D-13, D-16).

**Example:**
```typescript
// components/trades/TradeFilterBar.tsx
"use client"
import { useSearchParams, useRouter } from "next/navigation"

export function TradeFilterBar() {
  const searchParams = useSearchParams()
  const router = useRouter()

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    // Always reset to page 1 when filters change
    params.set("page", "1")
    router.push(`/trades?${params.toString()}`)
  }

  return (
    <div>
      <select
        value={searchParams.get("assetClass") ?? ""}
        onChange={(e) => updateFilter("assetClass", e.target.value)}
        className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[#e5e7eb] text-sm"
      >
        <option value="">All Classes</option>
        <option value="stock">Stock</option>
        {/* ... */}
      </select>
    </div>
  )
}
```

**Critical:** `useSearchParams()` requires the component to be wrapped in `<Suspense>` at the page level (Next.js 16 requirement). The trade list page must wrap the filter bar in `<Suspense fallback={<FilterBarSkeleton />}>`.

### Pattern 3: Live P&L Preview

**What:** Controlled form state feeds `calculateTradeMetrics()` on every relevant field change. Result is rendered in a sticky bottom bar that shows/hides based on whether exitPrice is present.

**When to use:** Trade form — add and edit.

**Example:**
```typescript
// Derived state computed inline — no useEffect needed
const livePreview = useMemo(() => {
  if (!exitPrice || !entryPrice || !quantity) return null
  const exitPriceNum = parseFloat(exitPrice)
  const entryPriceNum = parseFloat(entryPrice)
  const quantityNum = parseFloat(quantity)
  if (isNaN(exitPriceNum) || isNaN(entryPriceNum) || isNaN(quantityNum)) return null
  return calculateTradeMetrics({
    assetClass,
    direction,
    entryPrice: entryPriceNum,
    exitPrice: exitPriceNum,
    quantity: quantityNum,
    premium: premium ? parseFloat(premium) : undefined,
    stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
  })
}, [exitPrice, entryPrice, quantity, assetClass, direction, premium, stopLoss])
```

All form fields are stored as strings in state (from `<input>` values) and parsed to numbers at submission and in the preview calculation. This is the safest pattern for numeric inputs — avoids controlled input type=number issues.

### Pattern 4: Fetch-on-Server, Pass-to-Client for Trade List Page

**What:** The trade list page is a server component that fetches trades based on searchParams, passing data to a client table component. This avoids a client-side data fetch waterfall.

**When to use:** `/trades` page (LOG-01 through LOG-05).

**Example:**
```typescript
// app/(dashboard)/trades/page.tsx — SERVER COMPONENT
import { auth } from "@/lib/auth"
import dbConnect from "@/lib/db"
import Trade from "@/lib/models/Trade"

export default async function TradesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  // Next.js 16: searchParams is async — must await
  const params = await searchParams
  // ... build filter, fetch from MongoDB directly (same process)
  // Pass trades + pagination to client component
  return <TradeTable trades={trades} pagination={pagination} />
}
```

Note: In Next.js 15+, `searchParams` in page components is a Promise and must be awaited. Verified from Next.js 16.2.1 release notes.

### Anti-Patterns to Avoid

- **Client-side data fetching for the initial trade list:** Don't use `useEffect` + `fetch("/api/trades")` in a client component for the initial render. Use a server component that reads the DB directly. Client-side re-fetches only happen after filter/sort changes (router.push triggers server re-render).
- **useEffect for live P&L:** Don't use `useEffect` to update preview state. Use `useMemo` with form field values as dependencies — it's synchronous and eliminates a render cycle.
- **Re-implementing Card.tsx max-width:** `Card` has `max-w-[400px]` baked in — appropriate for auth forms but NOT for trade table or form wrappers. Pass `className="max-w-none"` or build a `Panel` variant for wider content areas.
- **Unguarded `useSearchParams`:** Always wrap components using `useSearchParams()` in `<Suspense>` at the page level; Next.js 16 will throw without it.
- **Forgetting proxy.ts `/trades` protection:** Current `proxy.ts` only redirects unauthenticated users from `/dashboard` paths. The condition must include `/trades` or be generalized (e.g., check that path does NOT start with `/api`, `/login`, `/register`, `/forgot-password`, `/reset-password`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| P&L calculation in form | Inline formula in component | `calculateTradeMetrics()` from `lib/calculations.ts` | Direction-aware, options-aware, handles edge cases — already battle-tested in Phase 2 |
| Form field validation | Custom validation logic | Zod `tradeCreateSchema` + `tradeUpdateSchema` `safeParse` | Canonical pattern from LoginForm.tsx; handles all cross-field rules (exit pair, options fields) |
| Number formatting in table | `toFixed(2)` ad hoc | Consistent: `pnl.toLocaleString("en-US", { style: "currency", currency: "USD" })` | Locale-aware formatting; avoids scattered `.toFixed` calls with inconsistent precision |
| Multi-select for tags | Complex multi-select UI | Simple tags-as-chips with enter-to-add or comma-split | No library needed; simpler to build and style; deferred library per CONTEXT.md |
| Toast notification | External library | 30-line custom `Toast` component with `setTimeout` dismiss | Deferred library per CONTEXT.md; trivial to implement for single use case |
| Icon set | Custom SVGs | `lucide-react` (already installed) | `ArrowUp`, `ArrowDown`, `Trash2`, `Edit2`, `Plus`, `ChevronLeft`, `ChevronRight`, `X` all available |

**Key insight:** All business logic (P&L, validation, API) is already built. Phase 3 is purely presentation — every calculation and API call has a pre-built counterpart.

---

## Common Pitfalls

### Pitfall 1: proxy.ts Does Not Protect /trades Routes

**What goes wrong:** Unauthenticated users can access `/trades`, `/trades/new`, `/trades/[id]`, etc. because the redirect in `proxy.ts` only checks `pathname.startsWith("/dashboard")`.

**Why it happens:** `/trades` routes are in `app/(dashboard)/trades/` which is protected by route-group convention, but the middleware redirect for UI routes only covers `/dashboard`.

**How to avoid:** Update `proxy.ts` to also redirect `/trades` paths. Best approach: protect all non-auth paths by redirecting when not authenticated AND path is not in the public allowlist (`/`, `/login`, `/register`, `/forgot-password`, `/reset-password`).

**Warning signs:** Can navigate to `/trades` in a private browsing window without being redirected to login.

### Pitfall 2: searchParams Must Be Awaited in Next.js 15+

**What goes wrong:** TypeScript error or runtime error when accessing `searchParams.page` directly in a page component.

**Why it happens:** Next.js 15 made `searchParams` and `params` in page/layout components async Promises, not synchronous objects.

**How to avoid:** Always `await searchParams` at the top of server component pages: `const params = await searchParams`.

**Warning signs:** TypeScript shows `searchParams` type as `Promise<...>` not `Record<string, string>`.

### Pitfall 3: useSearchParams Requires Suspense Boundary

**What goes wrong:** Build error or hydration mismatch: "useSearchParams() should be wrapped in a suspense boundary".

**Why it happens:** Next.js 16 requires Suspense around any component reading `useSearchParams()` to avoid breaking static rendering.

**How to avoid:** In `app/(dashboard)/trades/page.tsx`, wrap the filter bar client component in `<Suspense fallback={...}>`. The TradeFilterBar and any other client component using `useSearchParams` must be inside a Suspense boundary.

**Warning signs:** Build warning during `next build`; hydration errors in the browser console.

### Pitfall 4: Card Component max-width Constraint

**What goes wrong:** Trade form or table cards appear narrow (max 400px) — the Card component has `max-w-[400px]` baked into its className.

**Why it happens:** Card was built for the auth form context; the width constraint is hardcoded.

**How to avoid:** Pass `className="max-w-none w-full"` to override, or use a plain `<div>` with Card styling for wider content areas. Do NOT modify Card.tsx itself as it would break auth forms.

**Warning signs:** Table or form content is visually squashed into a narrow column.

### Pitfall 5: Zod v4 String-to-Number Coercion for Form Inputs

**What goes wrong:** `tradeCreateSchema` expects `entryPrice: number` but HTML inputs produce string values; safeParse fails with "Expected number, received string".

**Why it happens:** All `<input type="number">` values come through `e.target.value` as strings. Zod v4 does not auto-coerce unless `z.coerce.number()` is used in the schema.

**How to avoid:** Parse number fields with `parseFloat()` before passing to `safeParse`, or build a form submission transformer that converts string fields to numbers. Pattern:
```typescript
const payload = {
  ...formState,
  entryPrice: parseFloat(formState.entryPrice),
  exitPrice: formState.exitPrice ? parseFloat(formState.exitPrice) : undefined,
  quantity: parseFloat(formState.quantity),
  // ...
}
const result = tradeCreateSchema.safeParse(payload)
```

**Warning signs:** Zod validation always fails on first submit despite valid-looking data.

### Pitfall 6: DateTime String Format for Zod entryDate/exitDate

**What goes wrong:** Zod schema uses `z.string().datetime()` which requires full ISO 8601 with time and timezone (e.g., `2024-01-15T09:30:00.000Z`). Native `<input type="date">` produces `2024-01-15` which fails validation.

**Why it happens:** `z.string().datetime()` is strict — it requires a timezone-aware ISO string, not a date-only string.

**How to avoid:** Convert date input values to ISO strings before submitting:
```typescript
// Convert date input string to ISO datetime
const toISODatetime = (dateStr: string) => dateStr ? new Date(dateStr).toISOString() : undefined
// In the submission payload:
entryDate: toISODatetime(formState.entryDate)
```

For display purposes, format dates from the API with `new Date(trade.entryDate).toLocaleDateString()`.

**Warning signs:** Date fields fail Zod validation; "Invalid entry date" error appears.

### Pitfall 7: Options Conditional Fields Not Reset on assetClass Change

**What goes wrong:** When user selects `options` then switches to `stock`, strike price/expiration/contract type/premium values persist in form state and can cause unexpected validation failures.

**Why it happens:** Controlled inputs maintain their values in React state even when the UI hides them.

**How to avoid:** When `assetClass` changes away from `options`, clear the options-specific fields:
```typescript
if (newAssetClass !== "options") {
  setStrikePrice("")
  setExpirationDate("")
  setContractType("")
  setPremium("")
}
```

**Warning signs:** Hidden options fields cause "strikePrice is required for options trades" validation errors when asset class is not options.

---

## Code Examples

Verified patterns from the existing codebase:

### Sidebar Navigation Link (active state per D-04)
```typescript
// components/layout/Sidebar.tsx
"use client"
import { usePathname } from "next/navigation"
import Link from "next/link"

interface NavLinkProps {
  href: string
  label: string
  icon: React.ReactNode
}

function NavLink({ href, label, icon }: NavLinkProps) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + "/")

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
        isActive
          ? "text-[#00ff88] border-l-2 border-[#00ff88] pl-[14px]"
          : "text-[#6b7280] hover:text-[#e5e7eb]"
      }`}
    >
      {icon}
      {label}
    </Link>
  )
}
```

### Two-Step Inline Delete (per D-06)
```typescript
// Inside TradeTable row — no modal, two clicks
const [deletingId, setDeletingId] = useState<string | null>(null)

// First click: set confirming state
// Second click: execute delete
{deletingId === trade._id ? (
  <span className="flex gap-2">
    <button
      onClick={() => handleDelete(trade._id)}
      className="text-xs text-[#ef4444] hover:underline"
    >
      Confirm?
    </button>
    <button
      onClick={() => setDeletingId(null)}
      className="text-xs text-[#6b7280] hover:underline"
    >
      Cancel
    </button>
  </span>
) : (
  <button
    onClick={() => setDeletingId(trade._id)}
    className="opacity-0 group-hover:opacity-100 text-[#6b7280] hover:text-[#ef4444]"
  >
    <Trash2 size={14} />
  </button>
)}
```

### Sticky P&L Preview Bar (per D-10)
```typescript
// components/trades/PnlPreviewBar.tsx
// Sits inside the form container, sticky bottom
{livePreview && (
  <div className="sticky bottom-0 bg-[#1a1a1a] border-t border-[#2a2a2a] px-6 py-3 flex gap-6 text-sm">
    <span>
      P&L:{" "}
      <span
        className={`font-mono font-bold ${livePreview.pnl >= 0 ? "text-[#00ff88]" : "text-[#ef4444]"}`}
      >
        {livePreview.pnl >= 0 ? "+" : ""}
        {livePreview.pnl.toLocaleString("en-US", { style: "currency", currency: "USD" })}
      </span>
    </span>
    <span>
      {livePreview.pnlPercent.toFixed(2)}%
    </span>
    {livePreview.riskRewardRatio !== undefined && (
      <span>R:R {livePreview.riskRewardRatio.toFixed(2)}</span>
    )}
  </div>
)}
```

### Simple Toast Notification (per Claude's Discretion)
```typescript
// components/ui/Toast.tsx
"use client"
import { useEffect } from "react"

interface ToastProps {
  message: string
  type: "success" | "error"
  onDismiss: () => void
}

export function Toast({ message, type, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div
      className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm shadow-lg border ${
        type === "success"
          ? "bg-[#1a1a1a] border-[#00ff88] text-[#00ff88]"
          : "bg-[#1a1a1a] border-[#ef4444] text-[#ef4444]"
      }`}
    >
      {message}
    </div>
  )
}
```

### Tags Input (Enter-to-add, per Claude's Discretion)
```typescript
// Stored as string[] in state; display as removable chips
const [tagInput, setTagInput] = useState("")
const [tags, setTags] = useState<string[]>([])

function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault()
    const tag = tagInput.trim()
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag])
    }
    setTagInput("")
  }
}

function removeTag(tag: string) {
  setTags(tags.filter((t) => t !== tag))
}
```

### Image Upload Flow (per D-11)
```typescript
// 1. User selects file → show thumbnail
// 2. On form submit: upload first, then save trade
const handleSubmit = async () => {
  let chartImageUrl: string | undefined

  if (imageFile) {
    const formData = new FormData()
    formData.append("file", imageFile)
    try {
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData })
      const uploadData = await uploadRes.json()
      chartImageUrl = uploadData.data?.url
    } catch {
      showToast("Image upload failed. Trade will be saved without image.", "error")
      // Non-blocking: continue saving trade without image
    }
  }

  // Then save/update trade with chartImageUrl (may be undefined if upload failed)
  const payload = { ...formPayload, chartImageUrl }
  await fetch("/api/trades", { method: "POST", body: JSON.stringify(payload) })
}
```

### Pagination Controls
```typescript
// Simple prev/next + page number display
function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function goToPage(n: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(n))
    router.push(`/trades?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-3 text-sm text-[#6b7280]">
      <button
        disabled={page <= 1}
        onClick={() => goToPage(page - 1)}
        className="disabled:opacity-30"
      >
        <ChevronLeft size={16} />
      </button>
      <span>Page {page} of {totalPages}</span>
      <button
        disabled={page >= totalPages}
        onClick={() => goToPage(page + 1)}
        className="disabled:opacity-30"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `params`/`searchParams` synchronous in page components | Must be awaited (async) | Next.js 15 | All server page components need `await searchParams` |
| `useSearchParams()` anywhere in client component | Must be inside `<Suspense>` boundary | Next.js 13+ | Trade list page needs Suspense wrapper |
| `zod.errors` for ZodError | `zod.issues` (Zod v4) | Zod v4 | Already handled in codebase; replicate pattern |
| `findOneAndUpdate` triggers pre-save hook | Use `findOne` + `set` + `save` | Mongoose 8.x | Already decided in Phase 2; trade update route uses this correctly |

**Deprecated/outdated patterns this project avoids:**
- Pages Router (`/pages` directory): Not used — App Router only
- `getServerSideProps` / `getStaticProps`: Not applicable — server components handle data fetching
- `next/router` (Pages Router): Not used — `next/navigation` for App Router

---

## Open Questions

1. **Dashboard page layout conflict**
   - What we know: `app/(dashboard)/dashboard/page.tsx` currently uses `min-h-screen bg-[#0f0f0f] p-8` directly with no layout wrapper. Once `app/(dashboard)/layout.tsx` is added, the sidebar appears around this page too.
   - What's unclear: The dashboard page currently sets its own `min-h-screen` — this will double-nest with the layout. The page's outer div padding/min-height needs removing once the layout exists.
   - Recommendation: When creating the layout, update `dashboard/page.tsx` to remove `min-h-screen bg-[#0f0f0f]` from its outer div (keep only inner content styling). This is a trivial one-line change but must be planned as a task.

2. **Select component styling in Tailwind v4**
   - What we know: Native `<select>` elements do not respond to `appearance-none` + Tailwind utility styling in all browsers the same way.
   - What's unclear: Tailwind v4 may have changes to form element reset behavior.
   - Recommendation: Use `appearance-none` with explicit border/background styling matching Input.tsx. If arrow icon is needed, use a wrapper div with `relative` and an absolutely positioned lucide `ChevronDown` icon. Test during implementation.

3. **Trade detail page image display**
   - What we know: `chartImageUrl` is a Cloudinary URL stored on the trade.
   - What's unclear: Whether `next/image` or a plain `<img>` tag should be used; Cloudinary URLs require `remotePatterns` config in `next.config.ts` for `next/image`.
   - Recommendation: Use plain `<img>` with `max-w-full` for Phase 3. `next/image` optimization requires `remotePatterns` config which is a Phase 5 polish concern.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run --passWithNoTests` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOG-01 | Paginated list renders 20 trades, page controls change URL | manual-only | N/A — server component + URL navigation | N/A |
| LOG-02 | Each filter updates URL params and refetches correctly | manual-only | N/A — requires browser interaction | N/A |
| LOG-03 | Sort by entry date/P&L/symbol asc/desc changes order | manual-only | N/A — requires browser interaction | N/A |
| LOG-04 | Strategy and tag dropdowns populate from /api/trades/meta | manual-only | N/A — requires live API | N/A |
| LOG-05 | Trade row displays symbol, asset class, direction, entry date, P&L, status | manual-only | N/A — visual UI verification | N/A |
| TRADE-10 | Live P&L preview calculates correctly for all asset classes | unit | `npx vitest run __tests__/lib/calculations.test.ts` | ✅ EXISTS |

**Note on test strategy for Phase 3:** Phase 3 is primarily UI. The underlying P&L calculation logic (TRADE-10) is fully covered by the existing `__tests__/lib/calculations.test.ts` suite. The UI components (filter bar, trade table, forms) are manual-only verification — component testing with a DOM environment (jsdom) is not configured in `vitest.config.ts` (currently `environment: "node"`). Integration tests for the API are Phase 6 scope (INFRA-01 through INFRA-03). Phase 3 verification gate: visual smoke test — add a trade, view it in the list, edit it, delete it.

### Sampling Rate
- **Per task commit:** `npx vitest run --passWithNoTests` (verifies no regressions in calculation/schema tests)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + manual smoke test (add trade → view list → edit → delete) before `/gsd:verify-work`

### Wave 0 Gaps
- None for automated tests — the existing test infrastructure covers the one automatable requirement (TRADE-10 via calculations.test.ts). UI component tests are out of scope for Phase 3 (Phase 6 scope).

---

## Sources

### Primary (HIGH confidence)
- Codebase — `proxy.ts`, `app/(dashboard)/`, `components/ui/`, `lib/calculations.ts`, `schemas/trade.ts` directly read
- `package.json` — exact installed versions verified
- `vitest.config.ts` — test configuration directly read

### Secondary (MEDIUM confidence)
- Next.js 16 App Router docs — `searchParams` async behavior, Suspense requirement for `useSearchParams()` — consistent with Next.js 15 release notes and current Next.js documentation patterns
- Zod v4 API — `.issues` vs `.errors` already documented in `STATE.md` decisions; verified against existing codebase usage

### Tertiary (LOW confidence — flag for validation)
- Tailwind v4 `<select>` styling behavior — training knowledge; verify `appearance-none` works as expected during implementation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json
- Architecture: HIGH — based on existing codebase patterns and Next.js App Router conventions
- Pitfalls: HIGH — proxy.ts gap verified by reading the file; Zod/datetime pitfalls verified from STATE.md decisions; async searchParams verified from Next.js 15+ changelog

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (Next.js 16 stable; no major breaking changes expected in 30 days)
