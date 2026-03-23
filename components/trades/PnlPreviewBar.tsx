interface PnlPreviewBarProps {
  pnl: number
  pnlPercent: number
  riskRewardRatio?: number
}

export function PnlPreviewBar({ pnl, pnlPercent, riskRewardRatio }: PnlPreviewBarProps) {
  return (
    <div className="sticky bottom-0 bg-[#1a1a1a] border-t border-[#2a2a2a] px-6 py-3 flex items-center gap-6 text-sm">
      <span>
        P&amp;L:{" "}
        <span className={`font-mono text-base font-bold ${pnl >= 0 ? "text-[#00ff88]" : "text-[#ef4444]"}`}>
          {pnl >= 0 ? "+" : ""}
          {pnl.toLocaleString("en-US", { style: "currency", currency: "USD" })}
        </span>
      </span>
      <span className="font-mono text-[#e5e7eb]">
        {pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}%
      </span>
      {riskRewardRatio !== undefined && (
        <span className="font-mono text-[#e5e7eb]">
          R:R {riskRewardRatio.toFixed(2)}
        </span>
      )}
    </div>
  )
}
