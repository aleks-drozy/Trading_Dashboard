import { ReactNode } from "react"

interface BadgeProps {
  variant: "open" | "closed" | "long" | "short" | "stock" | "etf" | "crypto" | "forex" | "options"
  children: ReactNode
}

const variantClasses: Record<BadgeProps["variant"], string> = {
  open: "bg-[#2a2a2a] text-[#6b7280]",
  closed: "bg-[#0d2b1d] text-[#00ff88]",
  long: "bg-[#0d2b1d] text-[#00ff88]",
  short: "bg-[#2b0d0d] text-[#ef4444]",
  stock: "bg-[#1a1a2e] text-[#6b9fff]",
  etf: "bg-[#1a1a2e] text-[#6b9fff]",
  crypto: "bg-[#1a1a2e] text-[#6b9fff]",
  forex: "bg-[#1a1a2e] text-[#6b9fff]",
  options: "bg-[#1a1a2e] text-[#6b9fff]",
}

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variantClasses[variant]}`}
    >
      {children}
    </span>
  )
}
