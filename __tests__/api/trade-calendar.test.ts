import { describe, it, expect } from "vitest"
import { groupTradesByDay } from "@/lib/trade-calendar"

describe("groupTradesByDay", () => {
  it("sums P&L for multiple trades on the same day", () => {
    const trades = [
      { entryDate: new Date("2026-03-10T10:00:00Z"), pnl: 100 },
      { entryDate: new Date("2026-03-10T14:00:00Z"), pnl: 50 },
    ]
    const result = groupTradesByDay(trades)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ date: "2026-03-10", pnl: 150 })
  })

  it("creates separate entries for different days", () => {
    const trades = [
      { entryDate: new Date("2026-03-10T10:00:00Z"), pnl: 100 },
      { entryDate: new Date("2026-03-11T10:00:00Z"), pnl: -50 },
    ]
    const result = groupTradesByDay(trades)
    expect(result).toHaveLength(2)
  })

  it("handles missing pnl (treats as 0)", () => {
    const trades = [{ entryDate: new Date("2026-03-10T10:00:00Z"), pnl: undefined }]
    const result = groupTradesByDay(trades as never)
    expect(result[0].pnl).toBe(0)
  })

  it("returns empty array for empty input", () => {
    expect(groupTradesByDay([])).toEqual([])
  })
})
