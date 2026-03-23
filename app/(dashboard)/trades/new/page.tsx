import { TradeForm } from "@/components/trades/TradeForm"

export default function NewTradePage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-[#e5e7eb] mb-6">Log a Trade</h1>
      <TradeForm mode="create" />
    </div>
  )
}
