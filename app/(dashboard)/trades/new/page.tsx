import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { TradeForm } from "@/components/trades/TradeForm"

export default function NewTradePage() {
  return (
    <div className="max-w-[760px]">
      <div className="mb-8">
        <Link
          href="/trades"
          className="inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#f8fafc] transition-colors duration-150 mb-4"
        >
          <ChevronLeft size={15} />
          Back to trades
        </Link>
        <p className="text-xs font-medium text-[#64748b] uppercase tracking-widest mb-1">
          New Trade
        </p>
        <h1 className="text-2xl font-bold text-[#f8fafc] tracking-tight">Log a trade</h1>
        <p className="text-sm text-[#64748b] mt-1">
          Fill in what you know. Exit price and date are optional for open trades.
        </p>
      </div>
      <TradeForm mode="create" />
    </div>
  )
}
