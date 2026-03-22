import { NextRequest, NextResponse } from "next/server"
import { isValidObjectId } from "mongoose"
import { auth } from "@/lib/auth"
import dbConnect from "@/lib/db"
import Trade from "@/lib/models/Trade"

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
