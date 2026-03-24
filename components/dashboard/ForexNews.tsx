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
      <span className="text-[9px] text-[#64748b] w-14 flex-shrink-0 tabular-nums">
        {event.time}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium text-[#e2e8f0] truncate">{event.title}</p>
        <p className="text-[9px] text-[#475569]">{event.country}</p>
      </div>
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
    </div>
  )
}

export function ForexNews({ initialEvents }: Props) {
  const [events, setEvents] = useState(initialEvents)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    const id = setInterval(
      async () => {
        try {
          const res = await fetch("/api/forex-news")
          if (!res.ok) throw new Error()
          const data = await res.json()
          setEvents(data)
          setUnavailable(false)
        } catch {
          setUnavailable(true)
        }
      },
      30 * 60 * 1000
    ) // 30 minutes
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
        <div
          className="overflow-y-auto flex-1 flex flex-col gap-3 pr-0.5"
          style={{ maxHeight: "320px" }}
        >
          {events.today.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88]" />
                <span className="text-[10px] font-semibold text-[#f8fafc]">Today</span>
              </div>
              {events.today.map((e) => (
                <EventRow key={`${e.date}-${e.time}-${e.title}`} event={e} />
              ))}
            </div>
          )}

          {events.upcoming.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-[#475569]">This Week</span>
              {events.upcoming.map((e) => (
                <EventRow key={`${e.date}-${e.time}-${e.title}`} event={e} dim />
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
