"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface DayPnl {
  date: string // "YYYY-MM-DD"
  pnl: number
}

interface Props {
  initialData: DayPnl[]
  initialMonth: string // "YYYY-MM"
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
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  })
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
  const firstDow = getFirstDayOfWeek(year, mon) // 0=Mon offset
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
          const isWeekend = (firstDow + i) % 7 >= 5

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
        <p className="text-[10px] text-[#ef4444] mt-2 text-center">Couldn&apos;t load data</p>
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
