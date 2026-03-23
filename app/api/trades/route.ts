import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import dbConnect from "@/lib/db"
import Trade from "@/lib/models/Trade"
import { tradeCreateSchema } from "@/schemas/trade"

export async function POST(req: NextRequest) {
  const session = await auth()
  const userId = session!.user!.id // proxy.ts guarantees session exists (D-15)

  const body = await req.json()
  const parsed = tradeCreateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message }, // Zod v4: .issues not .errors
      { status: 400 }
    )
  }

  await dbConnect()
  try {
    const trade = new Trade({ ...parsed.data, userId })
    await trade.save() // pre-save hook fires: derives status, calculates P&L if closed
    return NextResponse.json({ data: trade }, { status: 201 }) // D-01, D-03
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[POST /api/trades] save failed:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  const userId = session!.user!.id

  const { searchParams } = req.nextUrl

  // Pagination
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20"))

  // Sorting — allowed fields: entryDate, pnl, symbol
  const sortBy = searchParams.get("sortBy") ?? "entryDate"
  const allowedSortFields = ["entryDate", "pnl", "symbol"]
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : "entryDate"
  const sortDir = searchParams.get("sortDir") === "asc" ? 1 : -1

  // Build filter — always scoped to userId
  const filter: Record<string, unknown> = { userId }

  // Optional filters
  const assetClass = searchParams.get("assetClass")
  if (assetClass) filter.assetClass = assetClass

  const direction = searchParams.get("direction")
  if (direction) filter.direction = direction

  const status = searchParams.get("status")
  if (status) filter.status = status

  const strategy = searchParams.get("strategy")
  if (strategy) filter.strategy = strategy

  const tags = searchParams.get("tags")
  if (tags) filter.tags = { $in: tags.split(",") }

  // Date range filter on entryDate
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  if (from || to) {
    filter.entryDate = {} as Record<string, unknown>
    if (from) (filter.entryDate as Record<string, unknown>).$gte = new Date(from)
    if (to) (filter.entryDate as Record<string, unknown>).$lte = new Date(to)
  }

  await dbConnect()
  const total = await Trade.countDocuments(filter)
  const trades = await Trade.find(filter)
    .sort({ [safeSortBy]: sortDir })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean()

  return NextResponse.json({
    data: trades,
    pagination: { page, totalPages: Math.ceil(total / limit), total },
  }) // D-02
}
