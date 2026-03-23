import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import dbConnect from "@/lib/db"
import Trade from "@/lib/models/Trade"
import { isValidObjectId } from "mongoose"
import { TradeDetail } from "@/components/trades/TradeDetail"

export default async function TradeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params
  if (!isValidObjectId(id)) notFound()

  await dbConnect()
  const trade = await Trade.findOne({ _id: id, userId: session.user.id }).lean()
  if (!trade) notFound()

  // Serialize for client
  const serialized = {
    _id: String(trade._id),
    symbol: trade.symbol,
    assetClass: trade.assetClass,
    direction: trade.direction,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice ?? null,
    quantity: trade.quantity,
    stopLoss: trade.stopLoss ?? null,
    takeProfit: trade.takeProfit ?? null,
    entryDate: new Date(trade.entryDate).toISOString(),
    exitDate: trade.exitDate ? new Date(trade.exitDate).toISOString() : null,
    status: trade.status,
    pnl: trade.pnl ?? null,
    pnlPercent: trade.pnlPercent ?? null,
    riskRewardRatio: trade.riskRewardRatio ?? null,
    strikePrice: trade.strikePrice ?? null,
    expirationDate: trade.expirationDate ? new Date(trade.expirationDate).toISOString() : null,
    contractType: trade.contractType ?? null,
    premium: trade.premium ?? null,
    strategy: trade.strategy,
    tags: trade.tags,
    notes: trade.notes,
    chartImageUrl: trade.chartImageUrl ?? null,
  }

  return <TradeDetail trade={serialized} />
}
