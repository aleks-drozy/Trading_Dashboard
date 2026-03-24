# Dashboard: Trade Calendar & Economic News Widgets

**Date:** 2026-03-24
**Status:** Approved

## Overview

The dashboard currently has a hard `max-w-[900px]` constraint that leaves empty space on the right side in fullscreen/wide-screen views. This spec adds a right sidebar panel containing two new widgets:

1. **Trade Calendar** — a navigable monthly calendar that colors trading days green (profitable) or red (losing) based on net P&L from logged trades.
2. **Economic Calendar (ForexNews)** — an economic news widget sourcing from the ForexFactory calendar, showing high/medium/low impact events for today and the upcoming week.

## Layout

The dashboard page becomes a two-column grid:
- **Left column** (`main`): all existing content — stat cards, equity curve, win/loss chart, recent activity. The `max-w-[900px]` constraint is removed; the two-column grid naturally manages width.
- **Right column** (`aside`): 260px fixed width, containing the Trade Calendar stacked above the ForexNews widget.

**Responsive behavior:** Below the `lg` breakpoint (1024px), the grid collapses to a single column and the right panel stacks below the main content.

## Components

### `components/dashboard/TradeCalendar.tsx` (Client Component)

**Props:**
```ts
{
  initialData: { date: string; pnl: number }[]   // current month days with trade P&L
  initialMonth: string                            // "YYYY-MM"
}
```

**Behavior:**
- Manages `month` state locally (initialized from `initialMonth`).
- Prev/next arrows fetch `/api/trade-calendar?month=YYYY-MM` and update displayed days.
- Day coloring:
  - Net P&L > 0 → green background (`rgba(0,255,136,0.15)`) + green border + green text
  - Net P&L < 0 → red background (`rgba(239,68,68,0.15)`) + red border + red text
  - No trades → neutral (`#141c2e`), muted text
  - Today → accent ring border (bright `#00ff88`) regardless of P&L color
- Weekends are rendered but slightly dimmed.
- Month/year label displayed between prev/next nav arrows.
- Legend below the grid: green dot = "Green day", red dot = "Red day".

### `components/dashboard/ForexNews.tsx` (Client Component)

**Props:**
```ts
{
  initialEvents: {
    today: ForexEvent[]
    upcoming: ForexEvent[]
  }
}
```

**`ForexEvent` type:**
```ts
{
  title: string
  country: string
  date: string    // "YYYY-MM-DD"
  time: string    // "HH:MM" or "Tentative" / "All Day"
  impact: "High" | "Medium" | "Low"
}
```

**Behavior:**
- Renders two sections: **Today** (green dot + date label) and **This Week**.
- Each event row: time/day, event name, currency country, impact dot + left border.
  - High impact → red (`#ef4444`)
  - Medium impact → orange (`#f59e0b`)
  - Low impact → yellow (`#eab308`)
- Today's events are full-brightness; upcoming events are slightly dimmed (`text-[#94a3b8]`).
- Auto-refreshes every 30 minutes via `setInterval` re-fetching `/api/forex-news`.
- Impact levels 0 (holidays/grey folder) are excluded — only High, Medium, Low shown.
- Legend at the bottom: red = High, orange = Medium, yellow = Low.

## API Routes

### `GET /api/trade-calendar?month=YYYY-MM`

**Auth:** Required — returns `{ days: [] }` on unauthenticated requests (no 401 crash).

**Logic:**
1. Parse `month` query param, derive `startOfMonth` and `endOfMonth`.
2. Query: `Trade.find({ userId, status: "closed", entryDate: { $gte: start, $lte: end } }).select("entryDate pnl")`
3. Group by `YYYY-MM-DD` date string, summing P&L per day.
4. Return: `{ days: { date: string, pnl: number }[] }`

### `GET /api/forex-news`

**Auth:** None required (public economic data).

**Logic:**
1. Fetch `https://nfs.faireconomy.media/ff_calendar_thisweek.json` server-side.
2. Filter to events where `impact` is `"High"`, `"Medium"`, or `"Low"` (exclude `"Holiday"` / empty).
3. Split into:
   - `today`: events matching today's date (`YYYY-MM-DD`)
   - `upcoming`: remaining events this week, sorted by date then time
4. Return: `{ today: ForexEvent[], upcoming: ForexEvent[] }`
5. Cache with `next: { revalidate: 3600 }` (1-hour server cache).

## Data Flow

```
DashboardPage (RSC)
  ├── fetches trade data (existing)
  ├── fetches /api/trade-calendar?month=current  → passes initialData to TradeCalendar
  └── fetches /api/forex-news                    → passes initialEvents to ForexNews

TradeCalendar (client)
  └── on month nav → GET /api/trade-calendar?month=YYYY-MM

ForexNews (client)
  └── every 30 min → GET /api/forex-news
```

The RSC handles initial data fetching so the first paint has no loading state or skeleton flash.

## Error Handling

| Scenario | Behavior |
|---|---|
| `/api/trade-calendar` fetch fails during navigation | Calendar stays on current month; shows subtle inline "Couldn't load data" message |
| FF endpoint unreachable on client refresh | ForexNews shows "Economic calendar unavailable" empty state |
| FF endpoint unreachable on initial RSC fetch | ForexNews receives empty arrays, renders empty state immediately |
| Unauthenticated request to `/api/trade-calendar` | Returns `{ days: [] }` — calendar shows no colored days |

## Files Changed / Created

| File | Change |
|---|---|
| `app/(dashboard)/dashboard/page.tsx` | Add two-column grid layout; fetch initial calendar + news data; pass props to new components |
| `components/dashboard/TradeCalendar.tsx` | **New** — navigable monthly trade calendar |
| `components/dashboard/ForexNews.tsx` | **New** — economic calendar news widget |
| `app/api/trade-calendar/route.ts` | **New** — per-day P&L API route |
| `app/api/forex-news/route.ts` | **New** — FF calendar proxy route |
