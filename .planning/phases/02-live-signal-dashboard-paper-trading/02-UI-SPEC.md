---
phase: 2
slug: live-signal-dashboard-paper-trading
status: draft
shadcn_initialized: false
preset: none
created: 2026-03-16
---

# Phase 2 — UI Design Contract

> Visual and interaction contract for the live signal dashboard and paper trading UI.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | tailwind |
| Preset | not applicable |
| Component library | shadcn/ui (to be initialized in Phase 2 frontend scaffold) |
| Icon library | lucide-react |
| Font | Inter (via Google Fonts or Fontsource) |

---

## Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, pill internal padding (horizontal) |
| sm | 8px | Table cell padding, button padding vertical |
| md | 16px | Card padding, form field gaps |
| lg | 24px | Section padding, panel gaps |
| xl | 32px | Layout column gaps |
| 2xl | 48px | Major section breaks (signal table → portfolio section) |
| 3xl | 64px | Page-level top/bottom padding |

Exceptions: Signal pills use 4px vertical / 10px horizontal padding to maintain compact table rows.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400 | 1.5 |
| Label | 12px | 500 | 1.4 |
| Heading | 20px | 600 | 1.3 |
| Display | 28px | 700 | 1.2 |

Notes:
- Table cell text uses Body (14px / 400).
- Table column headers use Label (12px / 500) in uppercase with 0.05em letter-spacing.
- Portfolio value dollar amount uses Display (28px / 700) for single-glance read.
- NY session indicator label uses Label (12px / 500).

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | #0F1117 | Page background, table background |
| Secondary (30%) | #1A1D27 | Cards, header bar, sidebar (if any), table row hover |
| Accent (10%) | #3B82F6 | Active nav item underline, focused input border, WS connected dot pulse |
| Destructive | #EF4444 | Bearish signal pills, Below-EMA pill, error toasts, Win/Loss "Loss" label |
| Signal-Bull | #22C55E | Bullish signal pills, Above-EMA pill, Win/Loss "Win" label |
| Signal-Bear | #EF4444 | Bearish signal pills, Below-EMA pill (same as Destructive — bears are red) |

Additional semantic tokens:

| Role | Value | Usage |
|------|-------|-------|
| Signal-None | #6B7280 | IFVG "None" pill |
| Signal-Expired | #F97316 | IFVG "Expired" pill |
| Surface-border | #2D3148 | Table borders, card borders, dividers |
| Text-primary | #F1F5F9 | All primary text on dark surfaces |
| Text-muted | #6B7280 | Timestamps, secondary labels, muted captions |
| NY-Active | #22C55E | NY session active indicator dot + label |
| NY-Inactive | #6B7280 | NY session inactive indicator dot + label |

Accent reserved for: focused input ring, connected WebSocket status dot animation, active navigation underline. Not for data signals or status indicators.

---

## Component Inventory

Components needed for this phase:

| Component | Source | Notes |
|-----------|--------|-------|
| Button | shadcn/ui | Login submit, logout |
| Input | shadcn/ui | Email and password fields on login page |
| Label | shadcn/ui | Form field labels |
| Card | shadcn/ui | Portfolio value card, closed trades panel container |
| Badge | shadcn/ui (custom variant) | Signal state pills (IFVG, CISD, EMA condition) — custom color variants via tailwind |
| Table | shadcn/ui | Signal table, closed trades table |
| Separator | shadcn/ui | Section dividers between signal table, portfolio section, trades table |
| Toast / Sonner | shadcn/ui | Trade recorded success toast, error toast |
| SessionIndicator | custom | NY session status pill in header — dot + label, two states: active/inactive |
| WSStatusDot | custom | WebSocket connection status dot in header — three states: connecting/connected/disconnected |
| SignalPill | custom | Coloured text pill wrapping shadcn Badge variants — accepts state string, maps to color token |
| LoginForm | custom | Email + password inputs + submit button + error message |
| DashboardHeader | custom | App name, NY session indicator, WS status dot, logout button |
| SignalTable | custom | Table of watchlist symbols with IFVG/CISD/EMA columns, last-updated timestamps |
| PortfolioCard | custom | Starting balance + cumulative P&L display |
| TradesTable | custom | Closed paper trades with all columns |

---

## Layout Contract

### Dashboard Layout

Single-page vertical stack, no sidebar. Full-width layout with max-width 1280px centered, horizontal padding 24px.

```
┌──────────────────────────────────────────────────────────┐
│  DashboardHeader                                         │
│  [App Name]        [NY Session: Active ●]  [WS ●] [Out] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Signal Table                                            │
│  Symbol | IFVG     | CISD     | EMA Condition | Updated  │
│  ───────────────────────────────────────────────────     │
│  SPY    | Bullish  | Bullish  | ↑ Above       | 14:32:00 │
│  BTCUSD | None     | Bearish  | ↓ Below       | 14:32:01 │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Portfolio Value                                         │
│  $102,450.00   (+$2,450.00 / +2.45%)                    │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Closed Trades                                           │
│  Symbol | Dir | Entry | Exit | Stop | Target | P&L | W/L │
│  ────────────────────────────────────────────────────   │
│  ...                                                     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Header: sticky, height 56px, background Secondary (#1A1D27), border-bottom Surface-border (#2D3148).
Body area: background Dominant (#0F1117), min-height 100vh.
Section order (top to bottom): header → signal table → 48px break → portfolio card → 48px break → closed trades table.

### Signal Card (Signal Table Row)

Each watchlist symbol occupies one table row. The table is not clickable in Phase 2 (no row action — charts are Phase 3).

Columns:
- **Symbol** — uppercase ticker, Text-primary, 14px/600 weight, width ~100px
- **IFVG** — SignalPill: Bullish (green), Bearish (red), None (grey), Expired (orange)
- **CISD** — SignalPill: Bullish (green), Bearish (red)
- **EMA Condition** — SignalPill: "↑ Above" (green), "↓ Below" (red)
- **Updated** — ISO time string formatted as HH:MM:SS, Text-muted, 12px

Row hover state: background shifts to Secondary (#1A1D27). No click cursor (cursor: default).
Table header row: Label style (12px/500/uppercase/letter-spacing), Text-muted color, no background.
Empty state (no watchlist symbols): centred text "No symbols in watchlist. Add symbols to begin tracking signals." in Text-muted.

SignalPill anatomy: rounded-full pill, 4px vertical padding, 10px horizontal padding, 12px/500 text, colored background at 15% opacity, colored text at full opacity (e.g., green text on green/15% bg).

### Paper Trades Panel

Closed trades table, full-width below portfolio card.

Columns (all left-aligned except P&L which is right-aligned):
- **Symbol** — ticker string
- **Direction** — "Long" (green text) or "Short" (red text)
- **Entry** — price formatted to 2 decimal places (stocks) or 4 (crypto)
- **Exit** — same format as entry
- **Stop** — same format
- **Target** — same format
- **P&L ($)** — dollar value, green if positive, red if negative, prefixed with + or −
- **Win/Loss** — "Win" (green badge) or "Loss" (red badge)

Sorting: default sort is newest trade first (descending by closed timestamp). No pagination in Phase 2 — all closed trades shown.
Empty state: centred text "No closed trades yet. Trades will appear here automatically when signals fire during the NY session." in Text-muted.
Table header: same Label style as signal table.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | Log In |
| NY Session Active | NY Session Active |
| NY Session Inactive | NY Session Closed |
| Signal Firing | (no UI notification in Phase 2 — trade auto-recorded silently, toast fires) |
| No Signals | No symbols in watchlist. Add symbols to begin tracking signals. |
| Trade Recorded | Trade recorded — {SYMBOL} {Direction} at {price} |
| Error state — WS disconnect | Connection lost. Reconnecting… |
| Error state — login failure | Invalid email or password. |
| Error state — generic API | Something went wrong. Try refreshing the page. |
| Portfolio section label | Portfolio Value |
| Closed trades section label | Closed Trades |
| Empty trades table | No closed trades yet. Trades will appear here automatically when signals fire during the NY session. |
| Login page heading | Trading Dashboard |
| Login page sub-heading | Sign in to view live signals |

---

## WebSocket / Real-time States

| State | Visual Treatment |
|-------|-----------------|
| Connecting | WSStatusDot: amber dot (#F59E0B), no animation, label "Connecting…" shown on hover tooltip |
| Connected | WSStatusDot: accent blue dot (#3B82F6) with CSS pulse animation (scale 1→1.4, opacity 1→0, 2s infinite), label "Live" on hover tooltip |
| Disconnected | WSStatusDot: red dot (#EF4444), no animation, toast fires: "Connection lost. Reconnecting…", label "Disconnected" on hover tooltip |
| Data updating | Signal table row: no animation. Last-updated timestamp column updates in place. No flash or highlight — silent update to avoid distraction during live trading. |

Reconnect strategy: exponential back-off starting at 1s, cap at 30s, max 10 retries before showing a persistent banner "Unable to reconnect. Please refresh the page."

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | Button, Input, Label, Card, Badge, Table, Separator, Sonner | not required |

All components sourced from the official shadcn/ui registry (https://ui.shadcn.com). No third-party shadcn registries used in Phase 2. Custom components (SignalPill, SessionIndicator, WSStatusDot, DashboardHeader, SignalTable, PortfolioCard, TradesTable, LoginForm) are hand-authored inside `frontend/src/components/` — no external registry dependency.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
