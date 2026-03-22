import { NextRequest, NextResponse } from "next/server"
import { isValidObjectId } from "mongoose"
import { auth } from "@/lib/auth"
import dbConnect from "@/lib/db"
import Trade from "@/lib/models/Trade"
import { tradeUpdateSchema } from "@/schemas/trade"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const userId = session!.user!.id
  const { id } = await params

  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid trade ID" }, { status: 400 })
  }

  await dbConnect()

  const trade = await Trade.findOne({ _id: id, userId }).lean()

  if (!trade) {
    return NextResponse.json({ error: "Trade not found" }, { status: 404 })
  }

  return NextResponse.json({ data: trade })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const userId = session!.user!.id
  const { id } = await params

  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid trade ID" }, { status: 400 })
  }

  await dbConnect()

  const trade = await Trade.findOne({ _id: id, userId })

  if (!trade) {
    return NextResponse.json({ error: "Trade not found" }, { status: 404 })
  }

  await trade.deleteOne()

  return new NextResponse(null, { status: 204 })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const userId = session!.user!.id
  const { id } = await params

  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid trade ID" }, { status: 400 })
  }

  const body = await req.json()
  const parsed = tradeUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    )
  }

  await dbConnect()

  // MUST use findOne + set + .save() so the pre-save hook fires
  // DO NOT use findOneAndUpdate — the hook won't fire and P&L won't recalculate
  const trade = await Trade.findOne({ _id: id, userId })

  if (!trade) {
    return NextResponse.json({ error: "Trade not found" }, { status: 404 })
  }

  trade.set(parsed.data)
  await trade.save() // pre-save hook fires: re-derives status, recalculates P&L

  return NextResponse.json({ data: trade })
}
