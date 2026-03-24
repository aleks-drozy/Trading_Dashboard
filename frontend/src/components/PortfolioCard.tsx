import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Portfolio {
  starting_balance: number
  total_pnl: number
  current_balance: number
  pnl_percent: number
}

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

export function PortfolioCard({ portfolio }: { portfolio: Portfolio | null }) {
  const pnlColor = (portfolio?.total_pnl ?? 0) >= 0 ? "#22C55E" : "#EF4444"
  const sign = (portfolio?.total_pnl ?? 0) >= 0 ? "+" : ""

  return (
    <Card style={{ backgroundColor: "#1A1D27", borderColor: "#2D3148" }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium" style={{ color: "#6B7280" }}>
          Portfolio Value
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-[28px] font-bold" style={{ color: "#F1F5F9" }}>
          {portfolio ? fmt.format(portfolio.current_balance) : "--"}
        </div>
        {portfolio && (
          <p className="text-sm mt-1" style={{ color: pnlColor }}>
            ({sign}
            {fmt.format(portfolio.total_pnl)} / {sign}
            {portfolio.pnl_percent.toFixed(2)}%)
          </p>
        )}
      </CardContent>
    </Card>
  )
}
