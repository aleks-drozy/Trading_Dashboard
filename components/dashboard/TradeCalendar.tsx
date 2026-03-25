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

/** Format P&L into a compact label: "+142" or "-38" (no $ to save space) */
function fmtPnlCompact(pnl: number): string {
  const abs = Math.abs(pnl)
  const sign = pnl >= 0 ? "+" : "-"
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}k`
  return `${sign}${Math.round(abs)}`
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

  // Summary counts for legend
  const tradeDays = data.filter((d) => d.pnl !== 0)
  const greenDays = tradeDays.filter((d) => d.pnl > 0).length
  const redDays = tradeDays.filter((d) => d.pnl < 0).length

  return (
    <div className="bg-[#0e1223] border border-[#1e293b] rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-semibold text-[#475569] uppercase tracking-widest leading-none mb-1">
            Trading Days
          </p>
          <p className="text-sm font-bold text-[#f8fafc] leading-none">
            {formatMonthLabel(year, mon)}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(-1)}
            disabled={loading}
            aria-label="Previous month"
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#141c2e] hover:bg-[#1e293b] active:bg-[#253352] transition-colors duration-150 disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft size={13} className="text-[#94a3b8]" />
          </button>
          <button
            onClick={() => navigate(1)}
            disabled={loading}
            aria-label="Next month"
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#141c2e] hover:bg-[#1e293b] active:bg-[#253352] transition-colors duration-150 disabled:opacity-40 cursor-pointer"
          >
            <ChevronRight size={13} className="text-[#94a3b8]" />
          </button>
        </div>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 gap-[3px] mb-1.5">
        {DAY_LABELS.map((label, i) => (
          <div
            key={i}
            className={[
              "text-center text-[9px] font-semibold tracking-wide",
              i >= 5 ? "text-[#334155]" : "text-[#475569]",
            ].join(" ")}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day cells grid with optional loading overlay */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 rounded-lg bg-[#0e1223]/70 flex items-center justify-center">
            <div className="w-4 h-4 rounded-full border-2 border-[#1e293b] border-t-[#475569] animate-spin" />
          </div>
        )}

        <div className="grid grid-cols-7 gap-[3px]">
          {/* Empty offset cells */}
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`empty-${i}`} className="h-8" />
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

            const isWeekend = (firstDow + i) % 7 >= 5

            return (
              <div
                key={day}
                title={hasTrades ? `${pnl > 0 ? "+" : ""}${pnl.toFixed(2)}` : undefined}
                className={[
                  "h-8 rounded-md flex flex-col items-center justify-center transition-colors duration-100 relative overflow-hidden",
                  isGreen
                    ? "bg-[rgba(0,255,136,0.14)] border border-[rgba(0,255,136,0.22)]"
                    : isRed
                      ? "bg-[rgba(239,68,68,0.13)] border border-[rgba(239,68,68,0.20)]"
                      : isToday
                        ? "bg-[#141c2e] border border-[#1e293b]"
                        : "bg-[#0c1220] border border-transparent",
                  isToday ? "ring-1 ring-[#00ff88] ring-offset-1 ring-offset-[#0e1223]" : "",
                  isWeekend && !hasTrades ? "opacity-40" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {/* Subtle top-edge accent line for trade days */}
                {isGreen && (
                  <div className="absolute top-0 left-1 right-1 h-[2px] rounded-full bg-[#00ff88]/50" />
                )}
                {isRed && (
                  <div className="absolute top-0 left-1 right-1 h-[2px] rounded-full bg-[#ef4444]/50" />
                )}

                <span
                  className={[
                    "text-[10px] font-bold leading-none tabular-nums",
                    isGreen
                      ? "text-[#00ff88]"
                      : isRed
                        ? "text-[#ef4444]"
                        : isToday
                          ? "text-[#cbd5e1]"
                          : "text-[#334155]",
                  ].join(" ")}
                >
                  {day}
                </span>

                {hasTrades && (
                  <span
                    className={[
                      "text-[7px] font-semibold leading-none tabular-nums mt-[2px]",
                      isGreen ? "text-[#00ff88]/70" : "text-[#ef4444]/70",
                    ].join(" ")}
                  >
                    {fmtPnlCompact(pnl!)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-[10px] text-[#ef4444] mt-2 text-center">Couldn&apos;t load data</p>
      )}

      {/* Legend */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#131e30]">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm bg-[rgba(0,255,136,0.35)] border border-[rgba(0,255,136,0.4)]" />
            <span className="text-[9px] font-medium text-[#475569]">
              Win{greenDays > 0 ? ` · ${greenDays}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm bg-[rgba(239,68,68,0.30)] border border-[rgba(239,68,68,0.38)]" />
            <span className="text-[9px] font-medium text-[#475569]">
              Loss{redDays > 0 ? ` · ${redDays}` : ""}
            </span>
          </div>
        </div>
        {(greenDays > 0 || redDays > 0) && (
          <span className="text-[9px] text-[#334155]">{greenDays + redDays}d traded</span>
        )}
      </div>
    </div>
  )
}
