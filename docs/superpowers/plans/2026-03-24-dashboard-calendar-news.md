# Dashboard Calendar & News Widgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a right sidebar panel to the dashboard containing a navigable monthly trade calendar (green/red days by P&L) and a ForexFactory economic calendar news widget (today + this week, filtered by impact level).

**Architecture:** Hybrid RSC + client components. The dashboard RSC fetches initial data for both widgets server-side so first paint is instant. Two new client components (`TradeCalendar`, `ForexNews`) handle interactivity (month navigation, auto-refresh). Two new API routes serve data for client-side updates. The two-column layout is responsive — stacks vertically below the `lg` breakpoint.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Mongoose, Vitest

**Spec:** `docs/superpowers/specs/2026-03-24-dashboard-calendar-news-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `app/(dashboard)/dashboard/page.tsx` | Modify | Add two-column grid; fetch initial calendar + news data; pass to components |
| `components/dashboard/TradeCalendar.tsx` | Create | Navigable monthly calendar with P&L-colored days |
| `components/dashboard/ForexNews.tsx` | Create | Economic news widget (today + this week) with impact coloring |
| `app/api/trade-calendar/route.ts` | Create | Returns per-day P&L for a given month for the authenticated user |
| `app/api/forex-news/route.ts` | Create | Proxies ForexFactory JSON, filters by impact, splits today vs upcoming |
| `lib/forex-calendar.ts` | Create | Pure utility: fetch + parse + filter ForexFactory data (testable in isolation) |
| `lib/trade-calendar.ts` | Create | Pure utility: group trade records by day, summing P&L (testable in isolation) |
| `__tests__/api/trade-calendar.test.ts` | Create | Unit tests for calendar grouping logic |
| `__tests__/lib/forex-calendar.test.ts` | Create | Unit tests for FF data parsing and filtering |

---

## Task 1: forex-calendar utility (pure logic, testable)

**Files:**
- Create: `lib/forex-calendar.ts`
- Test: `__tests__/lib/forex-calendar.test.ts`

This utility owns the ForexFactory fetching and filtering logic. Keeping it separate from the route makes it unit-testable without mocking `NextRequest`.

- [ ] **Step 1.1: Write the failing tests**

Create `__tests__/lib/forex-calendar.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { filterForexEvents, splitByDay, type RawFFEvent, type ForexEvent } from "@/lib/forex-calendar"

describe("filterForexEvents", () => {
  const events: RawFFEvent[] = [
    { title: "NFP", country: "USD", date: "2026-03-28", time: "08:30am", impact: "High" },
    { title: "Holiday", country: "USD", date: "2026-03-28", time: "All Day", impact: "Holiday" },
    { title: "Consumer Sentiment", country: "USD", date: "2026-03-28", time: "10:00am", impact: "Medium" },
    { title: "Some Low Event", country: "EUR", date: "2026-03-28", time: "09:00am", impact: "Low" },
    { title: "Non-Economic", country: "USD", date: "2026-03-28", time: "All Day", impact: "" },
  ]

  it("keeps High, Medium, Low impact events", () => {
    const result = filterForexEvents(events)
    expect(result).toHaveLength(3)
    expect(result.map(e => e.title)).toContain("NFP")
    expect(result.map(e => e.title)).toContain("Consumer Sentiment")
    expect(result.map(e => e.title)).toContain("Some Low Event")
  })

  it("excludes Holiday and empty impact", () => {
    const result = filterForexEvents(events)
    expect(result.map(e => e.title)).not.toContain("Holiday")
    expect(result.map(e => e.title)).not.toContain("Non-Economic")
  })

  it("maps impact strings to ForexEvent shape", () => {
    const result = filterForexEvents(events)
    const nfp = result.find(e => e.title === "NFP")!
    expect(nfp.impact).toBe("High")
    expect(nfp.country).toBe("USD")
    expect(nfp.date).toBe("2026-03-28")
    expect(nfp.time).toBe("08:30am")
  })
})

describe("splitByDay", () => {
  const events: ForexEvent[] = [
    { title: "GDP", country: "USD", date: "2026-03-24", time: "08:30am", impact: "High" },
    { title: "FOMC", country: "USD", date: "2026-03-25", time: "02:00pm", impact: "High" },
    { title: "Claims", country: "USD", date: "2026-03-26", time: "08:30am", impact: "Medium" },
  ]

  it("puts events matching today into today array", () => {
    const { today, upcoming } = splitByDay(events, "2026-03-24")
    expect(today).toHaveLength(1)
    expect(today[0].title).toBe("GDP")
  })

  it("puts future events into upcoming array", () => {
    const { today, upcoming } = splitByDay(events, "2026-03-24")
    expect(upcoming).toHaveLength(2)
    expect(upcoming.map(e => e.title)).toContain("FOMC")
    expect(upcoming.map(e => e.title)).toContain("Claims")
  })

  it("returns empty today when no events match today's date", () => {
    const { today } = splitByDay(events, "2026-03-30")
    expect(today).toHaveLength(0)
  })
})
```

- [ ] **Step 1.2: Run tests to confirm they fail**

```bash
npx vitest run __tests__/lib/forex-calendar.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/forex-calendar'"

- [ ] **Step 1.3: Create `lib/forex-calendar.ts`**

```ts
export interface RawFFEvent {
  title: string
  country: string
  date: string   // "MMM DD, YYYY" or "YYYY-MM-DD" — FF format varies
  time: string
  impact: string
}

export interface ForexEvent {
  title: string
  country: string
  date: string   // normalized "YYYY-MM-DD"
  time: string
  impact: "High" | "Medium" | "Low"
}

const ALLOWED_IMPACTS = new Set(["High", "Medium", "Low"])

export function filterForexEvents(events: RawFFEvent[]): ForexEvent[] {
  return events
    .filter((e) => ALLOWED_IMPACTS.has(e.impact))
    .map((e) => ({
      title: e.title,
      country: e.country,
      date: e.date,
      time: e.time,
      impact: e.impact as ForexEvent["impact"],
    }))
}

export function splitByDay(
  events: ForexEvent[],
  todayStr: string // "YYYY-MM-DD"
): { today: ForexEvent[]; upcoming: ForexEvent[] } {
  const today: ForexEvent[] = []
  const upcoming: ForexEvent[] = []
  for (const event of events) {
    if (event.date === todayStr) {
      today.push(event)
    } else {
      upcoming.push(event)
    }
  }
  return { today, upcoming }
}

const FF_CALENDAR_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"

export async function fetchForexCalendar(): Promise<{ today: ForexEvent[]; upcoming: ForexEvent[] }> {
  const todayStr = new Date().toISOString().slice(0, 10)

  const res = await fetch(FF_CALENDAR_URL, { next: { revalidate: 3600 } })
  if (!res.ok) return { today: [], upcoming: [] }

  let raw: RawFFEvent[]
  try {
    raw = await res.json()
  } catch {
    return { today: [], upcoming: [] }
  }

  const filtered = filterForexEvents(raw)
  return splitByDay(filtered, todayStr)
}
```

- [ ] **Step 1.4: Run tests to confirm they pass**

```bash
npx vitest run __tests__/lib/forex-calendar.test.ts
```

Expected: PASS — 6 tests

- [ ] **Step 1.5: Commit**

```bash
git add lib/forex-calendar.ts __tests__/lib/forex-calendar.test.ts
git commit -m "feat: add forex-calendar utility with filter and split logic"
```

---

## Task 2: `/api/forex-news` route

**Files:**
- Create: `app/api/forex-news/route.ts`

No DB involved — just proxies `fetchForexCalendar()`. No auth required.

- [ ] **Step 2.1: Create `app/api/forex-news/route.ts`**

```ts
import { NextResponse } from "next/server"
import { fetchForexCalendar } from "@/lib/forex-calendar"

export async function GET() {
  try {
    const data = await fetchForexCalendar()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ today: [], upcoming: [] })
  }
}
```

- [ ] **Step 2.2: Manual smoke test**

Start dev server (`npm run dev`) and open `http://localhost:3000/api/forex-news` in the browser. Confirm you get a JSON response with `today` and `upcoming` arrays containing objects with `title`, `country`, `date`, `time`, `impact` fields. Impact values should only be `"High"`, `"Medium"`, or `"Low"`.

- [ ] **Step 2.3: Commit**

```bash
git add app/api/forex-news/route.ts
git commit -m "feat: add /api/forex-news route proxying ForexFactory calendar"
```

---

## Task 3: `/api/trade-calendar` route + tests

**Files:**
- Create: `app/api/trade-calendar/route.ts`
- Test: `__tests__/api/trade-calendar.test.ts`

This route queries the user's closed trades for a given month and groups P&L by day.

- [ ] **Step 3.1: Write the failing tests**

The grouping logic is pure — extract it so it can be tested without mocking Next.js/Mongoose.

Create `__tests__/api/trade-calendar.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { groupTradesByDay } from "@/lib/trade-calendar"

describe("groupTradesByDay", () => {
  it("sums P&L for multiple trades on the same day", () => {
    const trades = [
      { entryDate: new Date("2026-03-10T10:00:00Z"), pnl: 100 },
      { entryDate: new Date("2026-03-10T14:00:00Z"), pnl: 50 },
    ]
    const result = groupTradesByDay(trades)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ date: "2026-03-10", pnl: 150 })
  })

  it("creates separate entries for different days", () => {
    const trades = [
      { entryDate: new Date("2026-03-10T10:00:00Z"), pnl: 100 },
      { entryDate: new Date("2026-03-11T10:00:00Z"), pnl: -50 },
    ]
    const result = groupTradesByDay(trades)
    expect(result).toHaveLength(2)
  })

  it("handles missing pnl (treats as 0)", () => {
    const trades = [{ entryDate: new Date("2026-03-10T10:00:00Z"), pnl: undefined }]
    const result = groupTradesByDay(trades as never)
    expect(result[0].pnl).toBe(0)
  })

  it("returns empty array for empty input", () => {
    expect(groupTradesByDay([])).toEqual([])
  })
})
```

- [ ] **Step 3.2: Run tests to confirm they fail**

```bash
npx vitest run __tests__/api/trade-calendar.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/trade-calendar'"

- [ ] **Step 3.3: Create `lib/trade-calendar.ts`**

```ts
export interface TradeSummary {
  entryDate: Date
  pnl?: number
}

export interface DayPnl {
  date: string  // "YYYY-MM-DD"
  pnl: number
}

export function groupTradesByDay(trades: TradeSummary[]): DayPnl[] {
  const map = new Map<string, number>()
  for (const trade of trades) {
    const dateStr = trade.entryDate.toISOString().slice(0, 10)
    map.set(dateStr, (map.get(dateStr) ?? 0) + (trade.pnl ?? 0))
  }
  return Array.from(map.entries()).map(([date, pnl]) => ({ date, pnl }))
}
```

- [ ] **Step 3.4: Run tests to confirm they pass**

```bash
npx vitest run __tests__/api/trade-calendar.test.ts
```

Expected: PASS — 4 tests

- [ ] **Step 3.5: Create `app/api/trade-calendar/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import dbConnect from "@/lib/db"
import Trade from "@/lib/models/Trade"
import { groupTradesByDay } from "@/lib/trade-calendar"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ days: [] })

  const month = req.nextUrl.searchParams.get("month") ?? ""
  // month must be "YYYY-MM"
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Invalid month format. Use YYYY-MM." }, { status: 400 })
  }

  const [year, mon] = month.split("-").map(Number)
  const startOfMonth = new Date(year, mon - 1, 1)
  const endOfMonth = new Date(year, mon, 0, 23, 59, 59, 999)

  await dbConnect()
  const trades = await Trade.find({
    userId: session.user.id,
    status: "closed",
    entryDate: { $gte: startOfMonth, $lte: endOfMonth },
  })
    .select("entryDate pnl")
    .lean()

  const days = groupTradesByDay(trades as { entryDate: Date; pnl?: number }[])
  return NextResponse.json({ days })
}
```

- [ ] **Step 3.6: Manual smoke test**

With dev server running, open `http://localhost:3000/api/trade-calendar?month=2026-03`. Confirm you get `{ days: [...] }` with your logged trades.

- [ ] **Step 3.7: Commit**

```bash
git add lib/trade-calendar.ts __tests__/api/trade-calendar.test.ts app/api/trade-calendar/route.ts
git commit -m "feat: add trade-calendar utility and /api/trade-calendar route"
```

---

## Task 4: `TradeCalendar` client component

**Files:**
- Create: `components/dashboard/TradeCalendar.tsx`

- [ ] **Step 4.1: Create `components/dashboard/TradeCalendar.tsx`**

```tsx
"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface DayPnl {
  date: string  // "YYYY-MM-DD"
  pnl: number
}

interface Props {
  initialData: DayPnl[]
  initialMonth: string  // "YYYY-MM"
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
  // 0 = Sunday. We want Monday-first, so shift: Mon=0..Sun=6
  const day = new Date(year, month - 1, 1).getDay()
  return (day + 6) % 7
}

function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

export function TradeCalendar({ initialData, initialMonth }: Props) {
  const [month, setMonth] = useState(initialMonth)
  const [data, setData] = useState<DayPnl[]>(initialData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const [year, mon] = month.split("-").map(Number)

  async function navigate(direction: -1 | 1) {
    const d = new Date(year, mon - 1 + direction, 1)
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/trade-calendar?month=${newMonth}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      setData(json.days)
      setMonth(newMonth)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const pnlMap = new Map(data.map((d) => [d.date, d.pnl]))
  const daysInMonth = getDaysInMonth(year, mon)
  const firstDow = getFirstDayOfWeek(year, mon)  // 0=Mon offset
  const todayStr = new Date().toISOString().slice(0, 10)

  const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"]

  return (
    <div className="bg-[#0e1223] border border-[#1e293b] rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold text-[#475569] uppercase tracking-widest">
          Trading Days
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigate(-1)}
            disabled={loading}
            className="w-5 h-5 rounded flex items-center justify-center bg-[#141c2e] hover:bg-[#1e293b] transition-colors disabled:opacity-40"
          >
            <ChevronLeft size={11} className="text-[#94a3b8]" />
          </button>
          <span className="text-[11px] font-semibold text-[#f8fafc] w-20 text-center">
            {formatMonthLabel(year, mon)}
          </span>
          <button
            onClick={() => navigate(1)}
            disabled={loading}
            className="w-5 h-5 rounded flex items-center justify-center bg-[#141c2e] hover:bg-[#1e293b] transition-colors disabled:opacity-40"
          >
            <ChevronRight size={11} className="text-[#94a3b8]" />
          </button>
        </div>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((label, i) => (
          <div key={i} className="text-center text-[9px] text-[#475569]">
            {label}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty offset cells */}
        {Array.from({ length: firstDow }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateStr = `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`
          const pnl = pnlMap.get(dateStr)
          const isToday = dateStr === todayStr
          const hasTrades = pnl !== undefined
          const isGreen = hasTrades && pnl > 0
          const isRed = hasTrades && pnl < 0

          // Determine if this day is a weekend (Saturday=6, Sunday=0)
          // firstDow is the Mon-based offset of day 1; (firstDow + i) % 7 gives Mon=0..Sun=6
          const isWeekend = ((firstDow + i) % 7) >= 5

          return (
            <div
              key={day}
              title={hasTrades ? `${pnl > 0 ? "+" : ""}${pnl.toFixed(2)}` : undefined}
              className={[
                "aspect-square rounded flex items-center justify-center text-[10px] font-semibold transition-colors",
                isGreen
                  ? "bg-[rgba(0,255,136,0.15)] text-[#00ff88]"
                  : isRed
                    ? "bg-[rgba(239,68,68,0.15)] text-[#ef4444]"
                    : "bg-[#141c2e] text-[#475569]",
                isToday ? "ring-2 ring-[#00ff88] ring-offset-1 ring-offset-[#0e1223]" : "",
                isWeekend && !hasTrades ? "opacity-40" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {day}
            </div>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <p className="text-[10px] text-[#ef4444] mt-2 text-center">Couldn't load data</p>
      )}

      {/* Legend */}
      <div className="flex gap-3 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-[rgba(0,255,136,0.2)] border border-[rgba(0,255,136,0.4)]" />
          <span className="text-[9px] text-[#475569]">Green day</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-[rgba(239,68,68,0.2)] border border-[rgba(239,68,68,0.4)]" />
          <span className="text-[9px] text-[#475569]">Red day</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4.2: Run the full test suite to confirm nothing is broken**

```bash
npm test
```

Expected: all existing tests still pass

- [ ] **Step 4.3: Commit**

```bash
git add components/dashboard/TradeCalendar.tsx
git commit -m "feat: add TradeCalendar client component"
```

---

## Task 5: `ForexNews` client component

**Files:**
- Create: `components/dashboard/ForexNews.tsx`

- [ ] **Step 5.1: Create `components/dashboard/ForexNews.tsx`**

```tsx
"use client"

import { useEffect, useState } from "react"

interface ForexEvent {
  title: string
  country: string
  date: string
  time: string
  impact: "High" | "Medium" | "Low"
}

interface Props {
  initialEvents: {
    today: ForexEvent[]
    upcoming: ForexEvent[]
  }
}

const IMPACT_COLOR: Record<ForexEvent["impact"], string> = {
  High: "#ef4444",
  Medium: "#f59e0b",
  Low: "#eab308",
}

function EventRow({ event, dim }: { event: ForexEvent; dim?: boolean }) {
  const color = IMPACT_COLOR[event.impact]
  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#141c2e] border-l-2 transition-opacity ${dim ? "opacity-60" : ""}`}
      style={{ borderLeftColor: color }}
    >
      <span className="text-[9px] text-[#64748b] w-14 flex-shrink-0 tabular-nums">{event.time}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium text-[#e2e8f0] truncate">{event.title}</p>
        <p className="text-[9px] text-[#475569]">{event.country}</p>
      </div>
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
    </div>
  )
}

export function ForexNews({ initialEvents }: Props) {
  const [events, setEvents] = useState(initialEvents)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/forex-news")
        if (!res.ok) throw new Error()
        const data = await res.json()
        setEvents(data)
        setUnavailable(false)
      } catch {
        setUnavailable(true)
      }
    }, 30 * 60 * 1000) // 30 minutes
    return () => clearInterval(id)
  }, [])

  const noEvents = events.today.length === 0 && events.upcoming.length === 0

  return (
    <div className="bg-[#0e1223] border border-[#1e293b] rounded-2xl p-4 flex flex-col gap-3 flex-1 min-h-0">
      <span className="text-[10px] font-semibold text-[#475569] uppercase tracking-widest">
        Economic Calendar
      </span>

      {unavailable || noEvents ? (
        <p className="text-[11px] text-[#475569] text-center py-4">
          {unavailable ? "Economic calendar unavailable." : "No high-impact events this week."}
        </p>
      ) : (
        <div className="overflow-y-auto flex-1 flex flex-col gap-3 pr-0.5" style={{ maxHeight: "320px" }}>
          {events.today.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88]" />
                <span className="text-[10px] font-semibold text-[#f8fafc]">
                  Today
                </span>
              </div>
              {events.today.map((e, i) => (
                <EventRow key={i} event={e} />
              ))}
            </div>
          )}

          {events.upcoming.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-[#475569]">This Week</span>
              {events.upcoming.map((e, i) => (
                <EventRow key={i} event={e} dim />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-3 flex-wrap">
        {(["High", "Medium", "Low"] as const).map((impact) => (
          <div key={impact} className="flex items-center gap-1">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: IMPACT_COLOR[impact] }}
            />
            <span className="text-[9px] text-[#475569]">{impact}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5.2: Run the full test suite**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 5.3: Commit**

```bash
git add components/dashboard/ForexNews.tsx
git commit -m "feat: add ForexNews client component with auto-refresh"
```

---

## Task 6: Wire up dashboard page layout

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`

This is the final wiring step. The RSC fetches initial data for both widgets and switches the layout to two columns.

- [ ] **Step 6.1: Update `app/(dashboard)/dashboard/page.tsx`**

Add imports at the top (after existing imports):

```tsx
import { TradeCalendar } from "@/components/dashboard/TradeCalendar"
import { ForexNews } from "@/components/dashboard/ForexNews"
import { groupTradesByDay } from "@/lib/trade-calendar"
import { fetchForexCalendar } from "@/lib/forex-calendar"
```

Add data fetching inside `DashboardPage`. The file currently has this block (around line 40):

```tsx
  const [total, closed, trades, recentTrades] = await Promise.all([
    Trade.countDocuments({ userId }),
    Trade.countDocuments({ userId, status: "closed" }),
    Trade.find({ userId, status: "closed" }).select("pnl entryDate").sort({ entryDate: 1 }).lean(),
    Trade.find({ userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("symbol direction pnl status assetClass entryDate")
      .lean(),
  ])
```

Add `const now = ...` and `const currentMonth = ...` **before** that block, then replace the entire `Promise.all` block (shown above) with:

```tsx
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const [total, closed, trades, recentTrades, calendarTrades, forexEvents] = await Promise.all([
    Trade.countDocuments({ userId }),
    Trade.countDocuments({ userId, status: "closed" }),
    Trade.find({ userId, status: "closed" }).select("pnl entryDate").sort({ entryDate: 1 }).lean(),
    Trade.find({ userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("symbol direction pnl status assetClass entryDate")
      .lean(),
    Trade.find({ userId, status: "closed", entryDate: { $gte: startOfMonth, $lte: endOfMonth } })
      .select("entryDate pnl")
      .lean(),
    fetchForexCalendar().catch(() => ({ today: [], upcoming: [] })),
  ])

  const calendarInitialData = groupTradesByDay(
    calendarTrades as { entryDate: Date; pnl?: number }[]
  )
```

The return statement currently starts with `<div className="max-w-[900px] space-y-6">` and ends with `</div>` wrapping all existing content. Replace it so the outer wrapper becomes a two-column flex container and the existing content is nested inside the left column. The final return structure must look like this:

```tsx
  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* ── Main content column ── */}
      <div className="flex-1 min-w-0 space-y-6">

        {/* ── ALL EXISTING JSX GOES HERE UNCHANGED ── */}
        {/* Header, stat cards, performance charts, empty state, recent activity */}

      </div>{/* end main column */}

      {/* ── Right sidebar ── */}
      <aside className="w-full lg:w-[260px] flex-shrink-0 flex flex-col gap-4">
        <TradeCalendar initialData={calendarInitialData} initialMonth={currentMonth} />
        <ForexNews initialEvents={forexEvents} />
      </aside>
    </div>
  )
```

In practice: change the opening `<div className="max-w-[900px] space-y-6">` to `<div className="flex flex-col lg:flex-row gap-6 items-start">`, then immediately add `<div className="flex-1 min-w-0 space-y-6">` on the next line. Then before the final closing `</div>` of the return, add `</div>` to close the main column div, followed by the `<aside>` block above.

- [ ] **Step 6.2: Run the full test suite**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 6.3: Manual end-to-end check**

Start the dev server:

```bash
npm run dev
```

Open `http://localhost:3000/dashboard` in fullscreen. Verify:

1. Two-column layout: main content on left, sidebar on right
2. Calendar shows current month with green days matching your logged trades
3. Prev/next arrows navigate months and re-color days correctly
4. News widget shows today's events (if any) and upcoming week events
5. Impact dots/borders are red (High), orange (Medium), yellow (Low)
6. Resize browser to below 1024px — sidebar stacks below main content

- [ ] **Step 6.4: Commit**

```bash
git add app/(dashboard)/dashboard/page.tsx
git commit -m "feat: wire dashboard two-column layout with calendar and news sidebar"
```

---

## Task 7: Final test run and cleanup

- [ ] **Step 7.1: Run full test suite one last time**

```bash
npm test
```

Expected: all tests pass (existing 29 + 10 new = 39 tests)

- [ ] **Step 7.2: Add `.superpowers/` to `.gitignore` if not already present**

```bash
grep -q ".superpowers" .gitignore || echo ".superpowers/" >> .gitignore
git add .gitignore
git commit -m "chore: ignore .superpowers brainstorm session files" || true
```
