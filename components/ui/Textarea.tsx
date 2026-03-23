"use client"

import { TextareaHTMLAttributes } from "react"

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  id: string
}

export function Textarea({ label, error, id, className = "", ...props }: TextareaProps) {
  const borderClass = error
    ? "border-[#ef4444] ring-2 ring-[#ef4444]/15"
    : "border-[#2a2a2a] focus:border-[#00ff88] focus:ring-2 focus:ring-[#00ff88]/15"

  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="text-sm text-[#e5e7eb] mb-1.5 block">
        {label}
      </label>
      <textarea
        id={id}
        className={`bg-[#0f0f0f] ${borderClass} rounded-lg px-4 py-3 text-sm text-[#e5e7eb] placeholder-[#6b7280] min-h-[120px] resize-y outline-none transition-colors duration-150 w-full ${className}`}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-[#ef4444] mt-2">
          {error}
        </p>
      )}
    </div>
  )
}
