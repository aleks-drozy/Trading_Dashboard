"use client"

import { InputHTMLAttributes } from "react"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  id: string
}

export function Input({ label, error, id, className = "", ...props }: InputProps) {
  const borderClass = error
    ? "border-[#ef4444] ring-2 ring-[#ef4444]/15"
    : "border-[#1e1e1e] focus:border-[#00ff88]/50 focus:ring-2 focus:ring-[#00ff88]/10"

  return (
    <div className="flex flex-col">
      <label
        htmlFor={id}
        className="text-sm text-[#6b7280] mb-1.5 block"
      >
        {label}
      </label>
      <input
        id={id}
        className={`bg-[#0f0f0f] ${borderClass} rounded-lg px-4 py-3 h-[44px] text-sm text-[#e5e7eb] placeholder-[#4b5563] outline-none transition-colors duration-150 ${className}`}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && (
        <p
          id={`${id}-error`}
          className="text-sm text-[#ef4444] mt-2"
        >
          {error}
        </p>
      )}
    </div>
  )
}
