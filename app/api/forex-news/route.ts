import { NextResponse } from "next/server"
import { fetchForexCalendar } from "@/lib/forex-calendar"

export async function GET() {
  try {
    const data = await fetchForexCalendar()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ today: [], upcoming: [] })
  }
}
