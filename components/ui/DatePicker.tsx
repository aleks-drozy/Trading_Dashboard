"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"

interface DatePickerProps {
  id: string
  label?: string
  value: string // YYYY-MM-DD
  onChange: (value: string) => void
  error?: string
  optional?: boolean
  placeholder?: string
  compact?: boolean // smaller h-[34px] variant for filter bars
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function parseLocalDate(s: string): Date | null {
  if (!s) return null
  const parts = s.split("-").map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) return null
  return new Date(parts[0], parts[1] - 1, parts[2])
}

function toYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${dd}`
}

function getToday(): Date {
  const t = new Date()
  return new Date(t.getFullYear(), t.getMonth(), t.getDate())
}

export function DatePicker({
  id,
  label,
  value,
  onChange,
  error,
  optional,
  placeholder = "Pick a date",
  compact = false,
}: DatePickerProps) {
  const today = getToday()
  const selected = parseLocalDate(value)

  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth())

  const containerRef = useRef<HTMLDivElement>(null)

  // Sync view to selected date when value changes externally
  useEffect(() => {
    if (selected) {
      setViewYear(selected.getFullYear())
      setViewMonth(selected.getMonth())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onMouseDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onMouseDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else setViewMonth((m) => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else setViewMonth((m) => m + 1)
  }

  function goToToday() {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    onChange(toYMD(today))
    setOpen(false)
  }

  // Build calendar grid: leading nulls + day dates + trailing nulls to fill rows
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: Array<Date | null> = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewYear, viewMonth, i + 1)),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function handleSelect(d: Date) {
    onChange(toYMD(d))
    setOpen(false)
  }

  const displayValue = selected
    ? selected.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : ""

  const triggerBorder = error
    ? "border-[#ef4444] ring-2 ring-[#ef4444]/15"
    : open
      ? "border-[#00ff88]/50 ring-2 ring-[#00ff88]/10"
      : "border-[#1e293b] hover:border-[#334155]"

  return (
    <div className="flex flex-col" ref={containerRef}>
      {label && (
        <label htmlFor={id} className="text-sm text-[#94a3b8] mb-1.5 block">
          {label}
          {optional && <span className="text-[#64748b] ml-1">(optional)</span>}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          id={id}
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={
            label ? `${label}: ${displayValue || "no date selected"}` : displayValue || placeholder
          }
          className={`
            flex items-center gap-2 w-full
            bg-[#020617] ${triggerBorder}
            rounded-lg px-3 ${compact ? "h-[34px]" : "px-4 h-[44px]"}
            ${compact ? "text-xs" : "text-sm"} outline-none transition-colors duration-150 cursor-pointer
          `}
        >
          <Calendar size={14} className="text-[#475569] flex-shrink-0" />
          <span
            className={`flex-1 text-left ${displayValue ? "text-[#f8fafc]" : "text-[#64748b]"}`}
          >
            {displayValue || placeholder}
          </span>
        </button>

        {open && (
          <div
            role="listbox"
            aria-label={`Calendar for ${label}`}
            className="
              absolute top-full left-0 mt-1.5 z-50
              bg-[#0b1120] border border-[#1e293b]
              rounded-2xl shadow-2xl shadow-black/70
              p-4 w-[272px]
            "
          >
            {/* Month / year navigation */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={prevMonth}
                aria-label="Previous month"
                className="
                  w-8 h-8 flex items-center justify-center rounded-lg
                  text-[#475569] hover:text-[#f8fafc] hover:bg-[#141c2e]
                  transition-colors duration-100
                "
              >
                <ChevronLeft size={15} />
              </button>

              <span className="text-sm font-semibold text-[#e2e8f0] tabular-nums tracking-tight">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>

              <button
                type="button"
                onClick={nextMonth}
                aria-label="Next month"
                className="
                  w-8 h-8 flex items-center justify-center rounded-lg
                  text-[#475569] hover:text-[#f8fafc] hover:bg-[#141c2e]
                  transition-colors duration-100
                "
              >
                <ChevronRight size={15} />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_LABELS.map((d) => (
                <div
                  key={d}
                  className="text-center text-[10px] font-semibold text-[#334155] py-1 uppercase tracking-wider"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {cells.map((d, i) => {
                if (!d) return <div key={`empty-${i}`} />
                const ymd = toYMD(d)
                const isSelected = ymd === value
                const isToday = d.getTime() === today.getTime()

                return (
                  <button
                    key={ymd}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(d)}
                    className={`
                      h-8 w-full rounded-lg text-[13px] font-medium
                      transition-all duration-100 select-none
                      ${
                        isSelected
                          ? "bg-[#00ff88] text-[#020617] font-semibold shadow-sm shadow-[#00ff88]/20"
                          : isToday
                            ? "text-[#00ff88] ring-1 ring-inset ring-[#00ff88]/30 hover:bg-[#00ff88]/10"
                            : "text-[#94a3b8] hover:bg-[#141c2e] hover:text-[#f8fafc]"
                      }
                    `}
                  >
                    {d.getDate()}
                  </button>
                )
              })}
            </div>

            {/* Footer */}
            <div className="mt-3 pt-3 border-t border-[#1a2235] flex items-center justify-between">
              <button
                type="button"
                onClick={goToToday}
                className="text-[11px] font-medium text-[#475569] hover:text-[#00ff88] transition-colors duration-100"
              >
                Today
              </button>
              {value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange("")
                    setOpen(false)
                  }}
                  className="text-[11px] font-medium text-[#475569] hover:text-[#ef4444] transition-colors duration-100"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p id={`${id}-error`} className="text-sm text-[#ef4444] mt-2">
          {error}
        </p>
      )}
    </div>
  )
}
