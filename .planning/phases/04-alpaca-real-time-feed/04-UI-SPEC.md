---
status: draft
phase: 4
phase_name: Alpaca Real-time Feed
design_system: shadcn/ui new-york (slate, CSS variables)
authored: 2026-03-21
---

# UI-SPEC: Phase 4 — Alpaca Real-time Feed

## 0. Scope Assessment

Phase 4 requirements (DATA-05, DATA-06, DATA-07) are entirely backend:
replacing yfinance polling with Alpaca WebSocket, seeding BarStore on startup,
and adding exponential-backoff reconnect. There are **no new UI surfaces** in
this phase.

The design contract exists to answer three questions:
1. Does any existing component need to change in response to the new data source?
2. What interaction behavior does DATA-07's "no alert unless stale for 3+ minutes" require from the frontend?
3. What copy is locked for the affected states?

Answer: No existing component changes. Two interaction contracts are locked
below. The executor must not add, change, or remove any visual elements.

---

## 1. Design System

| Setting | Value | Source |
|---------|-------|--------|
| Tool | shadcn/ui | `frontend/components.json` |
| Style | new-york | `components.json` |
| Base color | slate | `components.json` |
| CSS variables | yes | `components.json` |
| Icon library | lucide | `components.json` |
| Tailwind version | v4 (`@import "tailwindcss"`) | `src/index.css` |
| Registry | shadcn official only | — |
| Third-party blocks | none | — |

No shadcn components are added in Phase 4. The existing component inventory
is sufficient.

---

## 2. Color Tokens (existing — no change)

All values are from `src/index.css`. The executor must not modify these.

| Role | CSS Variable | Resolved Value | Usage |
|------|-------------|----------------|-------|
| Page background | `--background` | `hsl(222 47% 7%)` → `#0F1117` | Full-page `min-h-screen` bg |
| Card / nav surface | `--card` | `hsl(225 24% 13%)` → `#1A1D27` | Header bg, card bg |
| Primary text | `--foreground` | `hsl(210 40% 96%)` → `#F1F5F9` | Body copy, table cells |
| Muted text | `--muted-foreground` | `hsl(220 9% 46%)` → `#6B7280` | Table headers, timestamps, labels |
| Border | `--border` | `hsl(228 25% 23%)` → `#2D3148` | Table dividers, header border |
| Accent / primary | `--primary` | `hsl(217 91% 60%)` → `#3B82F6` | Active nav link, WS "Live" dot |
| Destructive | `--destructive` | `hsl(0 84% 60%)` → `#EF4444` | WS "Disconnected" dot, Bearish pills |
| Warning | (no variable) | `#F59E0B` | WS "Connecting..." dot |
| Success | (no variable) | `#22C55E` | NY Session Active dot, Bullish pills |
| Expired state | (no variable) | `#F97316` | Expired IFVG pill |

**60/30/10 split:**
- 60% `#0F1117` — page background
- 30% `#1A1D27` — header, card surfaces
- 10% `#3B82F6` — active links, live indicator

---

## 3. Typography (existing — no change)

Two font weights only: **400 (regular)** and **600 (semibold)**.

| Role | Size | Weight | Line-height | Color | Element |
|------|------|--------|-------------|-------|---------|
| Page title | 20px (text-xl) | 600 (semibold) | 1.2 | `#F1F5F9` | `DashboardHeader` h1 |
| Section heading | 20px (text-xl) | 600 (semibold) | 1.2 | `#F1F5F9` | "Closed Trades" h2 |
| Nav link | 14px (text-sm) | 400 (regular) | — | `#3B82F6` active / `#6B7280` inactive | `<Link>` |
| Table cell — symbol | 14px (text-sm) | 600 (semibold) | 1.5 | `#F1F5F9` | `TableCell` |
| Table cell — body | 14px (text-sm) | 400 (regular) | 1.5 | `#F1F5F9` | `TableCell` |
| Table header | 12px (text-xs) | 400 (regular) | — | `#6B7280` | `TableHead` uppercase tracking-wider |
| Timestamp / meta | 12px (text-xs) | 400 (regular) | — | `#6B7280` | Updated column, session label |
| Signal pill | 12px (text-xs) | 400 (regular) | — | per state | `SignalPill` |
| Body base | 16px | 400 (regular) | 1.5 | `#F1F5F9` | `body` (Inter) |

Font family: **Inter** (loaded externally; fallback: `sans-serif`).

---

## 4. Spacing (existing — no change)

8-point scale used throughout existing codebase:

| Token | px | Usage in project |
|-------|----|-----------------|
| 4px | 4 | `py-1 px-2.5` pill internal padding |
| 8px | 8 | `gap-2` in SessionIndicator, WSStatusDot icon margin |
| 16px | 16 | `gap-4` in nav and header right cluster; `px-6` page gutters |
| 24px | 24 | `pt-6` main content top padding |
| 48px | 48 | `pt-12` between Dashboard sections |
| 56px | 56 | `h-14` sticky header height — **structural layout constraint, not a content spacing value** |
| 64px | 64 | `pb-16` last section bottom padding |
| 1280px | — | `max-w-[1280px]` content column max-width |

No new spacing values are introduced in Phase 4.

---

## 5. Component Inventory (existing — no additions)

| Component | File | Role | Phase 4 change |
|-----------|------|------|----------------|
| `DashboardHeader` | `components/DashboardHeader.tsx` | Sticky nav + status row | None |
| `WSStatusDot` | `components/WSStatusDot.tsx` | WS feed status indicator | None — see Interaction Contract §6.1 |
| `SessionIndicator` | `components/SessionIndicator.tsx` | NY session active/inactive | None |
| `SignalTable` | `components/SignalTable.tsx` | Signal state per symbol | None — see Copy Contract §7 |
| `SignalPill` | `components/SignalPill.tsx` | State badge per signal type | None |
| `PortfolioCard` | `components/PortfolioCard.tsx` | Portfolio value | None |
| `TradesTable` | `components/TradesTable.tsx` | Closed trades | None |
| `Toaster` (sonner) | `components/ui/sonner.tsx` | Toast notifications | None — see Interaction Contract §6.2 |

No new shadcn components are installed. No new application components are created.

---

## 6. Interaction Contracts

### 6.1 WSStatusDot — Feed Status Display

**Context:** `WSStatusDot` reflects the status of the frontend's WebSocket
connection to `/ws/signals`. It does NOT reflect the Alpaca backend feed
health directly. The Alpaca feed runs entirely on the backend.

**Locked behavior (do not change):**

| `status` prop | Dot color | Label (title attr) | Animation |
|---|---|---|---|
| `'connecting'` | `#F59E0B` (amber) | "Connecting..." | none |
| `'connected'` | `#3B82F6` (blue) | "Live" | `animate-pulse` |
| `'disconnected'` | `#EF4444` (red) | "Disconnected" | none |

The WS signal connection status is driven by `useSignalWebSocket()` hook.
When Alpaca's backend feed is healthy, the frontend WS will emit signals
normally — so `wsStatus` will reach `'connected'`. There is no new status
value for "Alpaca stale" exposed on the frontend in Phase 4.

**DATA-07 alignment:** The 3-minute stale threshold is enforced by the
backend watchdog logger. The frontend does not detect Alpaca staleness
independently in Phase 4. If Alpaca goes stale but the signal WebSocket
remains open, `wsStatus` stays `'connected'` and no user-visible alert fires.
This is correct per the requirement: "no alert is shown to the user unless the
feed remains stale for more than 3 minutes" — the backend logs the error;
the frontend only alerts on WebSocket disconnection.

### 6.2 Toast Notifications — Existing Rules Preserved

The existing `wasConnectedRef` guard in `DashboardPage.tsx` must not be
modified. Rules are:

| Condition | Toast shown? | Copy |
|-----------|-------------|------|
| WS first connects on page load | No | — |
| WS transitions from `'connected'` to `'disconnected'` | Yes | "Connection lost. Reconnecting..." |
| WS reconnects after disconnect | No (no reconnect toast) | — |
| Alpaca backend feed stale (backend-only) | No | — |

No new toast types are introduced in Phase 4.

### 6.3 Signal Table — Latency Improvement (invisible to user)

After Phase 4 completes, signals update at ~2s after each minute bar closes
(Alpaca WebSocket push) instead of ~60s (yfinance poll). The table's "Updated"
timestamp column (`updated_at` formatted as `HH:MM:SS`) will reflect the new
cadence automatically. No component or copy change is required.

### 6.4 Cold Start — Pre-seeded BarStore (invisible to user)

Before Phase 4, BarStore was empty on startup — signals were None until
60+ bars accumulated. After Phase 4 (DATA-06), BarStore is pre-seeded with
200 bars, so signals compute immediately. The existing empty-state copy in
`SignalTable` handles the brief window between startup and first signal
broadcast. No copy change is required.

---

## 7. Copywriting Contract

All copy below is **locked** — use verbatim. Phase 4 does not add new copy.

### Existing copy preserved as-is

| Location | State | Copy | Source |
|----------|-------|------|--------|
| `SignalTable` empty state | No signals yet | "Awaiting market open — signals will appear during the NY session (9:30–10:30 AM ET)." | `SignalTable.tsx` line 24 |
| `SessionIndicator` | Active | "NY Session Active" | `SessionIndicator.tsx` |
| `SessionIndicator` | Inactive | "NY Session Closed" | `SessionIndicator.tsx` |
| `WSStatusDot` title | Connected | "Live" | `WSStatusDot.tsx` |
| `WSStatusDot` title | Connecting | "Connecting..." | `WSStatusDot.tsx` |
| `WSStatusDot` title | Disconnected | "Disconnected" | `WSStatusDot.tsx` |
| Sonner toast | WS drops | "Connection lost. Reconnecting..." | `DashboardPage.tsx` |

### No new copy is introduced in Phase 4

Phase 4 has no new UI surfaces, no new dialogs, no new error states visible
to the user, and no new loading states. The executor must not add any new
visible copy.

---

## 8. Layout Contract (existing — no change)

The page layout established in Phase 2–3 is unchanged:

```
┌─────────────────────────────────── header (h-14, sticky) ─┐
│  Trading Dashboard  [Dashboard] [Chart] [Backtest]         │
│                         [NY Session ●] [WS ●] [Out]        │
└────────────────────────────────────────────────────────────┘
┌──────────────── main (max-w-[1280px] mx-auto px-6) ────────┐
│  SignalTable (pt-6)                                         │
│  PortfolioCard (pt-12)                                      │
│  Closed Trades heading + TradesTable (pt-12 pb-16)          │
└────────────────────────────────────────────────────────────┘
```

Phase 4 does not modify this layout.

---

## 9. Accessibility

No new interactive elements. Existing contracts apply:

- WSStatusDot uses `title` attribute for screen reader state — "Live" /
  "Connecting..." / "Disconnected".
- SessionIndicator uses a visible text label alongside the dot (not
  dot-only).
- All interactive elements (Button, Link) have visible focus rings via
  `--ring` token (`#3B82F6`).

---

## 10. Registry Safety Gate

shadcn official registry only. No third-party blocks declared. Gate: not
applicable for Phase 4.

---

## 11. Out of Scope for Phase 4

The following are explicitly deferred (do not implement in Phase 4):

| Item | Deferred To |
|------|------------|
| Feed source label ("Alpaca" vs "yfinance") visible in UI | Not required by any requirement |
| Alpaca stale-feed indicator on frontend | Phase 4 DATA-07 is backend-only alerting |
| Watchlist sidebar add/remove UI | Phase 6 (ASSET-04, ASSET-05) |
| Timeframe switcher (1m/5m/15m/1h) | Phase 5 (CHART-06, CHART-07) |
| Dynamic subscription change feedback in UI | Phase 6 |

---

## 12. Pre-Population Audit

| Field | Source | Status |
|-------|--------|--------|
| Design system (shadcn new-york/slate) | `frontend/components.json` | Pre-populated |
| Color tokens | `frontend/src/index.css` | Pre-populated |
| Typography | `frontend/src/components/*.tsx` inspection | Pre-populated |
| Spacing | Existing component className inspection | Pre-populated |
| Component inventory | `frontend/src/components/` directory scan | Pre-populated |
| WSStatusDot behavior | `frontend/src/components/WSStatusDot.tsx` | Pre-populated |
| Toast rules | `frontend/src/pages/DashboardPage.tsx` | Pre-populated |
| Empty state copy | `frontend/src/components/SignalTable.tsx` | Pre-populated |
| DATA-07 frontend alignment | `04-RESEARCH.md` Pattern 4 + ROADMAP.md Phase 4 SC #3 | Pre-populated |
| Out of scope | ROADMAP.md Phase 4 vs Phase 5/6 scope boundaries | Pre-populated |
| User questions asked | 0 | All answered from upstream |
