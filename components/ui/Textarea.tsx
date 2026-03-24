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
    : "border-[#1e293b] focus:border-[#00ff88] focus:ring-2 focus:ring-[#00ff88]/15"

  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="text-sm text-[#f8fafc] mb-1.5 block">
        {label}
      </label>
      <textarea
        id={id}
        className={`bg-[#020617] ${borderClass} rounded-lg px-4 py-3 text-sm text-[#f8fafc] placeholder-[#94a3b8] min-h-[120px] resize-y outline-none transition-colors duration-150 w-full ${className}`}
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
