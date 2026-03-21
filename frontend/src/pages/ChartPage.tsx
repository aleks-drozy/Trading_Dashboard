import { useState, useEffect } from 'react'
import { DashboardHeader } from '@/components/DashboardHeader'
import { CandlestickChart } from '@/components/CandlestickChart'
import { fetchWithAuth } from '@/lib/api'

interface ChartBar {
  time: number
  open: number
  high: number
  low: number
  close: number
}

interface EmaPoint {
  time: number
  value: number
}

interface IFVGZone {
  top: number
  bottom: number
  startTime: number
  endTime: number
  type: 'bullish' | 'bearish'
}

interface EntryMarker {
  time: number
  direction: 'Long' | 'Short'
}

interface ChartResponse {
  bars: ChartBar[]
  ema: EmaPoint[]
  ifvg_zones: IFVGZone[]
  cisd_level: number | null
  markers: EntryMarker[]
}

export default function ChartPage() {
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [selectedSymbol, setSelectedSymbol] = useState<string>('SPY')
  const [chartData, setChartData] = useState<ChartResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch watchlist on mount
  useEffect(() => {
    fetchWithAuth('/watchlist')
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .then((data: { symbol: string }[]) => {
        const symbols = data.map(item => item.symbol)
        setWatchlist(symbols)
        if (symbols.length > 0) {
          setSelectedSymbol(symbols[0])
        }
      })
      .catch(() => {
        // Fall back to default symbol if watchlist unavailable
      })
  }, [])

  // Fetch chart data when selectedSymbol changes
  useEffect(() => {
    if (!selectedSymbol) return
    setLoading(true)
    setError(null)
    fetchWithAuth(`/chart/bars/${selectedSymbol}`)
      .then(res => {
        if (res.status === 404) return null
        if (!res.ok) return Promise.reject(res)
        return res.json()
      })
      .then((data: ChartResponse | null) => {
        setChartData(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Chart data failed to load. Check your connection and try again.')
        setLoading(false)
      })
  }, [selectedSymbol])

  const hasData = chartData && chartData.bars.length > 0

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0F1117' }}>
      <DashboardHeader nySessionActive={false} />

      <main className="w-full max-w-[1280px] mx-auto px-6 pt-12 pb-16">
        <h2 className="text-xl font-semibold mb-6" style={{ color: '#F1F5F9' }}>
          Live Chart
        </h2>

        {/* Symbol selector */}
        {watchlist.length > 0 && (
          <div className="flex items-center gap-2 mb-6">
            {watchlist.map(symbol => (
              <button
                key={symbol}
                onClick={() => setSelectedSymbol(symbol)}
                className="px-3 py-1 rounded text-sm font-medium transition-colors"
                style={{
                  backgroundColor: selectedSymbol === symbol ? '#3B82F6' : 'transparent',
                  color: selectedSymbol === symbol ? '#FFFFFF' : '#6B7280',
                  border: `1px solid ${selectedSymbol === symbol ? '#3B82F6' : '#2D3148'}`,
                }}
              >
                {symbol}
              </button>
            ))}
          </div>
        )}

        {/* Chart or empty state */}
        {!loading && !error && !hasData ? (
          <div
            style={{
              height: 400,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6B7280',
            }}
          >
            No chart data available. Add a symbol to your watchlist and wait for the first bar.
          </div>
        ) : (
          <CandlestickChart
            bars={chartData?.bars ?? []}
            ema={chartData?.ema ?? []}
            ifvgZones={chartData?.ifvg_zones ?? []}
            cisdLevel={chartData?.cisd_level ?? null}
            markers={chartData?.markers ?? []}
            loading={loading}
            error={error}
          />
        )}
      </main>
    </div>
  )
}
