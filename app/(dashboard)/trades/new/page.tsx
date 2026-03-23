import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { TradeForm } from "@/components/trades/TradeForm"

export default function NewTradePage() {
  return (
    <div className="max-w-[760px]">
      <div className="mb-8">
        <Link
          href="/trades"
          className="inline-flex items-center gap-1.5 text-sm text-[#4b5563] hover:text-[#e5e7eb] transition-colors mb-4"
        >
          <ChevronLeft size={15} />
          Back to trades
        </Link>
        <h1 className="text-2xl font-bold text-[#e5e7eb]">Log a trade</h1>
        <p className="text-sm text-[#4b5563] mt-1">Fill in what you know. Exit price and date are optional for open trades.</p>
      </div>
      <TradeForm mode="create" />
    </div>
  )
}
