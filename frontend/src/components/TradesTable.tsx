import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface PaperTrade {
  id: number
  symbol: string
  direction: string
  entry_price: number
  exit_price: number | null
  stop_price: number
  target_price: number
  pnl: number | null
  outcome: string | null
  closed_at: string | null
}

function formatPrice(price: number, symbol: string): string {
  const dp = symbol.includes("USDT") || symbol.includes("BTC") ? 4 : 2
  return price.toFixed(dp)
}

const fmtUsd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

export function TradesTable({ trades }: { trades: PaperTrade[] }) {
  if (trades.length === 0) {
    return (
      <div className="py-12 text-center text-sm" style={{ color: "#6B7280" }}>
        No closed trades yet. Trades will appear here automatically when signals fire during the NY
        session.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow style={{ borderColor: "#2D3148" }}>
          <TableHead
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "#6B7280" }}
          >
            Symbol
          </TableHead>
          <TableHead
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "#6B7280" }}
          >
            Direction
          </TableHead>
          <TableHead
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "#6B7280" }}
          >
            Entry
          </TableHead>
          <TableHead
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "#6B7280" }}
          >
            Exit
          </TableHead>
          <TableHead
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "#6B7280" }}
          >
            Stop
          </TableHead>
          <TableHead
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "#6B7280" }}
          >
            Target
          </TableHead>
          <TableHead
            className="text-xs font-medium uppercase tracking-wider text-right"
            style={{ color: "#6B7280" }}
          >
            P&L ($)
          </TableHead>
          <TableHead
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "#6B7280" }}
          >
            Win/Loss
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {trades.map((t) => {
          const pnlColor = (t.pnl ?? 0) >= 0 ? "#22C55E" : "#EF4444"
          const pnlSign = (t.pnl ?? 0) >= 0 ? "+" : ""
          return (
            <TableRow key={t.id} style={{ borderColor: "#2D3148" }}>
              <TableCell className="text-sm font-semibold" style={{ color: "#F1F5F9" }}>
                {t.symbol}
              </TableCell>
              <TableCell style={{ color: t.direction === "Long" ? "#22C55E" : "#EF4444" }}>
                {t.direction}
              </TableCell>
              <TableCell className="text-sm" style={{ color: "#F1F5F9" }}>
                {formatPrice(t.entry_price, t.symbol)}
              </TableCell>
              <TableCell className="text-sm" style={{ color: "#F1F5F9" }}>
                {t.exit_price != null ? formatPrice(t.exit_price, t.symbol) : "-"}
              </TableCell>
              <TableCell className="text-sm" style={{ color: "#F1F5F9" }}>
                {formatPrice(t.stop_price, t.symbol)}
              </TableCell>
              <TableCell className="text-sm" style={{ color: "#F1F5F9" }}>
                {formatPrice(t.target_price, t.symbol)}
              </TableCell>
              <TableCell className="text-sm text-right" style={{ color: pnlColor }}>
                {t.pnl != null ? `${pnlSign}${fmtUsd.format(t.pnl)}` : "-"}
              </TableCell>
              <TableCell>
                {t.outcome && (
                  <span
                    className="rounded-full py-1 px-2.5 text-xs font-medium"
                    style={{
                      backgroundColor:
                        t.outcome === "Win" ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                      color: t.outcome === "Win" ? "#22C55E" : "#EF4444",
                    }}
                  >
                    {t.outcome}
                  </span>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
