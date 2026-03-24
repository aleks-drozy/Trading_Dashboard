export interface RawFFEvent {
  title: string
  country: string
  date: string // "MMM DD, YYYY" or "YYYY-MM-DD" — FF format varies
  time: string
  impact: string
}

export interface ForexEvent {
  title: string
  country: string
  date: string // normalized "YYYY-MM-DD"
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

export async function fetchForexCalendar(): Promise<{
  today: ForexEvent[]
  upcoming: ForexEvent[]
}> {
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
