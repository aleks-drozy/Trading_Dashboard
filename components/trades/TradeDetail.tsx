"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Edit2 } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"

interface TradeDetailProps {
  trade: {
    _id: string
    symbol: string
    assetClass: "stock" | "crypto" | "forex" | "options"
    direction: "long" | "short"
    entryPrice: number
    exitPrice?: number | null
    quantity: number
    stopLoss?: number | null
    takeProfit?: number | null
    entryDate: string
    exitDate?: string | null
    status: "open" | "closed"
    pnl?: number | null
    pnlPercent?: number | null
    riskRewardRatio?: number | null
    strikePrice?: number | null
    expirationDate?: string | null
    contractType?: "call" | "put" | null
    premium?: number | null
    strategy: string
    tags: string[]
    notes: string
    chartImageUrl?: string | null
  }
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

function formatPnl(value: number): string {
  const prefix = value >= 0 ? "+" : ""
  return `${prefix}${formatCurrency(value)}`
}

function formatPnlPercent(value: number): string {
  const prefix = value >= 0 ? "+" : ""
  return `${prefix}${value.toFixed(2)}%`
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm text-[#6b7280]">{label}</p>
      <p className="font-mono text-[#e5e7eb]">{value}</p>
    </div>
  )
}

export function TradeDetail({ trade }: TradeDetailProps) {
  const router = useRouter()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/trades")}
            className="flex items-center gap-1 text-sm text-[#6b7280] hover:text-[#e5e7eb] transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#e5e7eb]">{trade.symbol}</h1>
            <Badge variant={trade.status}>{trade.status}</Badge>
            <Badge variant={trade.direction}>{trade.direction}</Badge>
            <Badge variant={trade.assetClass}>{trade.assetClass}</Badge>
          </div>
        </div>
        <Link
          href={`/trades/${trade._id}/edit`}
          className="flex items-center gap-2 bg-transparent border border-[#2a2a2a] text-[#6b7280] text-sm font-normal h-[40px] px-4 rounded-lg hover:border-[#4a4a4a] hover:text-[#9ca3af] transition-colors"
        >
          <Edit2 size={14} />
          Edit
        </Link>
      </div>

      {/* Trade Info */}
      <Card className="max-w-none w-full">
        <h2 className="text-base font-bold text-[#e5e7eb] mb-4">Trade Info</h2>
        <div className="grid grid-cols-2 lg:grid-cols-2 gap-4">
          <DetailRow label="Entry Price" value={formatCurrency(trade.entryPrice)} />
          <DetailRow
            label="Exit Price"
            value={trade.exitPrice != null ? formatCurrency(trade.exitPrice) : "--"}
          />
          <DetailRow label="Quantity" value={trade.quantity.toLocaleString("en-US")} />
          <DetailRow
            label="Stop Loss"
            value={trade.stopLoss != null ? formatCurrency(trade.stopLoss) : "--"}
          />
          <DetailRow
            label="Take Profit"
            value={trade.takeProfit != null ? formatCurrency(trade.takeProfit) : "--"}
          />
          <DetailRow label="Entry Date" value={new Date(trade.entryDate).toLocaleDateString()} />
          <DetailRow
            label="Exit Date"
            value={trade.exitDate ? new Date(trade.exitDate).toLocaleDateString() : "--"}
          />
        </div>
      </Card>

      {/* P&L Section — only for closed trades */}
      {trade.status === "closed" && (
        <Card className="max-w-none w-full">
          <h2 className="text-base font-bold text-[#e5e7eb] mb-4">P&L</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-[#6b7280]">P&L</p>
              <p
                className={`font-mono text-base font-bold ${
                  trade.pnl != null && trade.pnl >= 0 ? "text-[#00ff88]" : "text-[#ef4444]"
                }`}
              >
                {trade.pnl != null ? formatPnl(trade.pnl) : "--"}
              </p>
            </div>
            <div>
              <p className="text-sm text-[#6b7280]">P&L %</p>
              <p
                className={`font-mono ${
                  trade.pnlPercent != null && trade.pnlPercent >= 0
                    ? "text-[#00ff88]"
                    : "text-[#ef4444]"
                }`}
              >
                {trade.pnlPercent != null ? formatPnlPercent(trade.pnlPercent) : "--"}
              </p>
            </div>
            <div>
              <p className="text-sm text-[#6b7280]">R:R</p>
              <p className="font-mono text-[#e5e7eb]">
                {trade.riskRewardRatio != null ? trade.riskRewardRatio.toFixed(2) : "--"}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Options Section — only for options trades */}
      {trade.assetClass === "options" && (
        <Card className="max-w-none w-full">
          <h2 className="text-base font-bold text-[#e5e7eb] mb-4">Options Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <DetailRow
              label="Strike Price"
              value={trade.strikePrice != null ? formatCurrency(trade.strikePrice) : "--"}
            />
            <DetailRow
              label="Expiration Date"
              value={
                trade.expirationDate ? new Date(trade.expirationDate).toLocaleDateString() : "--"
              }
            />
            <DetailRow label="Contract Type" value={trade.contractType ?? "--"} />
            <DetailRow
              label="Premium"
              value={trade.premium != null ? formatCurrency(trade.premium) : "--"}
            />
          </div>
        </Card>
      )}

      {/* Context Section */}
      <Card className="max-w-none w-full">
        <h2 className="text-base font-bold text-[#e5e7eb] mb-4">Context</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-[#6b7280]">Strategy</p>
            <p className="text-[#e5e7eb]">
              {trade.strategy || <span className="text-[#6b7280]">--</span>}
            </p>
          </div>
          <div>
            <p className="text-sm text-[#6b7280] mb-1">Tags</p>
            {trade.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {trade.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-[#2a2a2a] text-[#6b7280]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[#6b7280]">--</p>
            )}
          </div>
          <div>
            <p className="text-sm text-[#6b7280] mb-1">Notes</p>
            {trade.notes ? (
              <p className="text-[#e5e7eb]">{trade.notes}</p>
            ) : (
              <p className="text-[#6b7280] italic">No notes.</p>
            )}
          </div>
        </div>
      </Card>

      {/* Chart Image Section */}
      <Card className="max-w-none w-full">
        <h2 className="text-base font-bold text-[#e5e7eb] mb-4">Chart</h2>
        {trade.chartImageUrl ? (
          <img
            src={trade.chartImageUrl}
            alt="Trade chart"
            className="max-w-full rounded-lg border border-[#2a2a2a]"
          />
        ) : (
          <p className="text-[#6b7280] italic">No chart uploaded.</p>
        )}
      </Card>
    </div>
  )
}
