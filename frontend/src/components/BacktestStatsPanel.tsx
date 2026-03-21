interface BacktestStatsPanelProps {
  totalTrades: number
  winRate: number // 0-1 float
  avgRMultiple: number // e.g. 1.43
}

export function BacktestStatsPanel({
  totalTrades,
  winRate,
  avgRMultiple,
}: BacktestStatsPanelProps) {
  const stats = [
    { label: 'Trades', value: String(totalTrades) },
    { label: 'Win Rate', value: `${(winRate * 100).toFixed(1)}%` },
    { label: 'Avg R', value: `${avgRMultiple.toFixed(2)}R` },
  ]

  return (
    <div>
      <h3 className="text-xl font-semibold mb-4" style={{ color: '#F1F5F9' }}>
        Results
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map(stat => (
          <div
            key={stat.label}
            className="rounded-lg p-4"
            style={{ backgroundColor: '#1A1D27', border: '1px solid #2D3148' }}
          >
            <div
              className="text-xs uppercase tracking-wider"
              style={{ color: '#6B7280' }}
            >
              {stat.label}
            </div>
            <div
              className="text-xl font-semibold mt-1"
              style={{ color: '#F1F5F9' }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
