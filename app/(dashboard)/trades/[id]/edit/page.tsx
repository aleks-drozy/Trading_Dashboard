import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import dbConnect from "@/lib/db"
import Trade from "@/lib/models/Trade"
import { isValidObjectId } from "mongoose"
import { TradeForm } from "@/components/trades/TradeForm"

export default async function EditTradePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params
  if (!isValidObjectId(id)) notFound()

  await dbConnect()
  const trade = await Trade.findOne({ _id: id, userId: session.user.id }).lean()
  if (!trade) notFound()

  // Serialize dates and ObjectId for client component
  const initialData = {
    _id: String(trade._id),
    symbol: trade.symbol,
    assetClass: trade.assetClass,
    direction: trade.direction,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    quantity: trade.quantity,
    stopLoss: trade.stopLoss,
    takeProfit: trade.takeProfit,
    entryDate: trade.entryDate ? new Date(trade.entryDate).toISOString() : undefined,
    exitDate: trade.exitDate ? new Date(trade.exitDate).toISOString() : undefined,
    strikePrice: trade.strikePrice,
    expirationDate: trade.expirationDate ? new Date(trade.expirationDate).toISOString() : undefined,
    contractType: trade.contractType,
    premium: trade.premium,
    pointValue: trade.pointValue,
    strategy: trade.strategy,
    tags: trade.tags,
    notes: trade.notes,
    chartImageUrl: trade.chartImageUrl,
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-[#e5e7eb] mb-6">Edit Trade</h1>
      <TradeForm mode="edit" initialData={initialData} />
    </div>
  )
}
