import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import dbConnect from "@/lib/db"
import Trade from "@/lib/models/Trade"
import { groupTradesByDay } from "@/lib/trade-calendar"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ days: [] })

  const month = req.nextUrl.searchParams.get("month") ?? ""
  // month must be "YYYY-MM"
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Invalid month format. Use YYYY-MM." }, { status: 400 })
  }

  const [year, mon] = month.split("-").map(Number)
  const startOfMonth = new Date(year, mon - 1, 1)
  const endOfMonth = new Date(year, mon, 0, 23, 59, 59, 999)

  await dbConnect()
  const trades = await Trade.find({
    userId: session.user.id,
    status: "closed",
    entryDate: { $gte: startOfMonth, $lte: endOfMonth },
  })
    .select("entryDate pnl")
    .lean()

  const days = groupTradesByDay(trades as { entryDate: Date; pnl?: number }[])
  return NextResponse.json({ days })
}
