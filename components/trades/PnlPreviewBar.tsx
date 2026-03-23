interface PnlPreviewBarProps {
  pnl: number
  pnlPercent: number
  riskRewardRatio?: number
}

export function PnlPreviewBar({ pnl, pnlPercent, riskRewardRatio }: PnlPreviewBarProps) {
  const isPositive = pnl >= 0
  const color = isPositive ? "text-[#00ff88]" : "text-[#ef4444]"
  const bg = isPositive ? "bg-[#00ff88]/5 border-[#00ff88]/15" : "bg-[#ef4444]/5 border-[#ef4444]/15"

  const pnlFormatted =
    (isPositive ? "+" : "") +
    pnl.toLocaleString("en-US", { style: "currency", currency: "USD" })

  return (
    <div className={`sticky bottom-0 border-t ${bg} backdrop-blur-sm px-6 py-3 flex items-center gap-6`}>
      <div className="flex items-baseline gap-2">
        <span className="text-xs text-[#4b5563] font-medium">P&amp;L</span>
        <span className={`font-mono text-xl font-bold ${color}`}>{pnlFormatted}</span>
        <span className={`font-mono text-sm ${color} opacity-70`}>
          {isPositive ? "+" : ""}{pnlPercent.toFixed(2)}%
        </span>
      </div>

      {riskRewardRatio !== undefined && (
        <>
          <div className="w-px h-4 bg-[#2a2a2a]" />
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-[#4b5563] font-medium">R:R</span>
            <span className="font-mono text-sm text-[#e5e7eb] font-semibold">
              {riskRewardRatio.toFixed(2)}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
