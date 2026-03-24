"use client"

import { SelectHTMLAttributes } from "react"
import { ChevronDown } from "lucide-react"

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  id: string
}

export function Select({ label, error, id, className = "", children, ...props }: SelectProps) {
  const borderClass = error
    ? "border-[#ef4444] ring-2 ring-[#ef4444]/15"
    : "border-[#1e293b] focus:border-[#00ff88]/50 focus:ring-2 focus:ring-[#00ff88]/10"

  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="text-sm text-[#94a3b8] mb-1.5 block">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          className={`appearance-none bg-[#020617] ${borderClass} rounded-lg px-3 py-2 h-[44px] text-sm text-[#f8fafc] outline-none transition-colors duration-150 w-full pr-10 ${className}`}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          size={14}
          color="#94a3b8"
          className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm text-[#ef4444] mt-2">
          {error}
        </p>
      )}
    </div>
  )
}
