"use client"

import { useEffect } from "react"
import { X } from "lucide-react"

interface ToastProps {
  message: string
  type: "success" | "error"
  onDismiss: () => void
}

export function Toast({ message, type, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  const colorClasses =
    type === "success" ? "border-[#00ff88] text-[#00ff88]" : "border-[#ef4444] text-[#ef4444]"

  return (
    <div
      role="alert"
      className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm shadow-lg border flex items-center gap-2 bg-[#1a1a1a] ${colorClasses}`}
    >
      <span>{message}</span>
      <button
        onClick={onDismiss}
        className="ml-2 cursor-pointer opacity-70 hover:opacity-100"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  )
}
