export interface TradeSummary {
  entryDate: Date
  pnl?: number
}

export interface DayPnl {
  date: string // "YYYY-MM-DD"
  pnl: number
}

export function groupTradesByDay(trades: TradeSummary[]): DayPnl[] {
  const map = new Map<string, number>()
  for (const trade of trades) {
    const dateStr = trade.entryDate.toISOString().slice(0, 10)
    map.set(dateStr, (map.get(dateStr) ?? 0) + (trade.pnl ?? 0))
  }
  return Array.from(map.entries()).map(([date, pnl]) => ({ date, pnl }))
}
