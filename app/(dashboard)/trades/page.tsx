import { Suspense } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import dbConnect from "@/lib/db"
import Trade from "@/lib/models/Trade"
import { Types } from "mongoose"
import { TradeFilterBar } from "@/components/trades/TradeFilterBar"
import { TradeTable } from "@/components/trades/TradeTable"

export default async function TradesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const params = await searchParams
  const userId = session.user.id

  await dbConnect()

  // Build filter (replicate logic from app/api/trades/route.ts GET)
  const filter: Record<string, unknown> = { userId }
  if (params.assetClass) filter.assetClass = params.assetClass
  if (params.direction) filter.direction = params.direction
  if (params.status) filter.status = params.status
  if (params.strategy) filter.strategy = params.strategy
  if (params.tags) filter.tags = { $in: params.tags.split(",") }
  if (params.from || params.to) {
    filter.entryDate = {} as Record<string, unknown>
    if (params.from) (filter.entryDate as Record<string, unknown>).$gte = new Date(params.from)
    if (params.to) (filter.entryDate as Record<string, unknown>).$lte = new Date(params.to)
  }

  // Sort
  const sortBy = params.sortBy ?? "entryDate"
  const allowedSortFields = ["entryDate", "pnl", "symbol"]
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : "entryDate"
  const sortDir = params.sortDir === "asc" ? 1 : -1

  // Pagination
  const page = Math.max(1, parseInt(params.page ?? "1"))
  const limit = 20

  // Fetch data
  const [total, trades, metaStrategies, metaTagsResult] = await Promise.all([
    Trade.countDocuments(filter),
    Trade.find(filter)
      .sort({ [safeSortBy]: sortDir })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Trade.distinct("strategy", { userId, strategy: { $ne: "" } }),
    Trade.aggregate([
      { $match: { userId: new Types.ObjectId(userId) } },
      { $unwind: "$tags" },
      { $group: { _id: "$tags" } },
      { $project: { _id: 0, tag: "$_id" } },
    ]),
  ])

  const totalPages = Math.ceil(total / limit)
  const metaTags = metaTagsResult.map((r: { tag: string }) => r.tag)

  // Serialize trades for client (convert _id, dates to strings)
  const serializedTrades = trades.map((t) => ({
    ...t,
    _id: String(t._id),
    userId: String(t.userId),
    entryDate: new Date(t.entryDate).toISOString(),
    exitDate: t.exitDate ? new Date(t.exitDate).toISOString() : null,
    expirationDate: t.expirationDate ? new Date(t.expirationDate).toISOString() : null,
    createdAt: new Date(t.createdAt).toISOString(),
    updatedAt: new Date(t.updatedAt).toISOString(),
  }))

  return (
    <div className="max-w-[1100px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#e5e7eb]">Trade Log</h1>
          <p className="text-sm text-[#4b5563] mt-1">
            {total > 0 ? `${total} trade${total !== 1 ? "s" : ""} total` : "No trades yet"}
          </p>
        </div>
        <Link
          href="/trades/new"
          className="inline-flex items-center gap-2 bg-[#00ff88] text-[#0f0f0f] font-bold text-sm rounded-lg px-4 h-10 hover:bg-[#00e67a] transition-colors"
        >
          <Plus size={15} />
          Log Trade
        </Link>
      </div>
      <Suspense
        fallback={
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 mb-4 h-[60px]" />
        }
      >
        <TradeFilterBar strategies={metaStrategies} availableTags={metaTags} />
      </Suspense>
      <TradeTable
        trades={serializedTrades}
        pagination={{ page, totalPages, total }}
      />
    </div>
  )
}
