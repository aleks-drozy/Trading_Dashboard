"use client"

import { ButtonHTMLAttributes } from "react"
import { Spinner } from "@/components/ui/Spinner"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary"
  loading?: boolean
}

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading

  const baseClasses =
    "w-full rounded-lg text-sm font-bold transition-colors duration-150 flex items-center justify-center"

  const variantClasses =
    variant === "primary"
      ? "bg-[#00ff88] text-[#020617] font-bold h-[44px] hover:bg-[#00e67a] active:bg-[#00cc6a] disabled:bg-[#1a3d2b] disabled:text-[#2a5a3a] disabled:cursor-not-allowed"
      : "bg-transparent border border-[#1e293b] text-[#94a3b8] font-normal h-[40px] hover:border-[#4a4a4a] hover:text-[#9ca3af]"

  return (
    <button
      disabled={isDisabled}
      className={`${baseClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {loading ? <Spinner /> : children}
    </button>
  )
}
