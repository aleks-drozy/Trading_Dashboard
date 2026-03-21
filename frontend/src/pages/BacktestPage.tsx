import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { DashboardHeader } from '@/components/DashboardHeader'
import { CandlestickChart } from '@/components/CandlestickChart'
import { EquityCurve } from '@/components/EquityCurve'
import { BacktestStatsPanel } from '@/components/BacktestStatsPanel'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
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

interface EntryMarker {
  time: number
  direction: 'Long' | 'Short'
}

interface BacktestResponse {
  bars: ChartBar[]
  ema: EmaPoint[]
  markers: EntryMarker[]
  equity_curve: { date: string; cumPnl: number }[]
  stats: { total_trades: number; win_rate: number; avg_r_multiple: number }
}

function toDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}

export default function BacktestPage() {
  const today = new Date()
  const todayStr = toDateString(today)

  const fiveDaysAgo = new Date(today)
  fiveDaysAgo.setDate(today.getDate() - 5)
  const fiveDaysAgoStr = toDateString(fiveDaysAgo)

  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(today.getDate() - 7)
  const sevenDaysAgoStr = toDateString(sevenDaysAgo)

  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const yesterdayStr = toDateString(yesterday)

  const [symbol, setSymbol] = useState('SPY')
  const [startDate, setStartDate] = useState(fiveDaysAgoStr)
  const [endDate, setEndDate] = useState(todayStr)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<BacktestResponse | null>(null)
  const [watchlist, setWatchlist] = useState<string[]>([])

  // Fetch watchlist on mount
  useEffect(() => {
    fetchWithAuth('/watchlist')
      .then(res => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: { symbol: string }[]) => {
        const symbols = data.map(item => item.symbol)
        setWatchlist(symbols)
        if (symbols.length > 0) {
          setSymbol(symbols[0])
        }
      })
      .catch(() => {
        // Fall back to default symbol if watchlist unavailable
      })
  }, [])

  const handleRunBacktest = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchWithAuth('/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, start_date: startDate, end_date: endDate }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg =
          data.detail ||
          'Backtest failed. Check the date range (max 7 days) and try again.'
        toast.error(msg)
        setError(msg)
        return
      }
      const data = await res.json()
      setResults(data)
    } catch {
      toast.error('Backtest failed. Check the date range (max 7 days) and try again.')
      setError('Backtest failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0F1117' }}>
      <DashboardHeader nySessionActive={false} />

      <main className="w-full max-w-[1280px] mx-auto px-6 pt-12 pb-16">
        <h2 className="text-xl font-semibold mb-6" style={{ color: '#F1F5F9' }}>
          Backtest
        </h2>

        {/* Symbol selector */}
        {watchlist.length > 0 && (
          <div className="flex items-center gap-2 mb-6">
            {watchlist.map(s => (
              <button
                key={s}
                onClick={() => setSymbol(s)}
                className="px-3 py-1 rounded text-sm font-medium transition-colors"
                style={{
                  backgroundColor: symbol === s ? '#3B82F6' : 'transparent',
                  color: symbol === s ? '#FFFFFF' : '#6B7280',
                  border: `1px solid ${symbol === s ? '#3B82F6' : '#2D3148'}`,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Date range form */}
        <div
          className="rounded-lg p-6 mb-6"
          style={{ backgroundColor: '#1A1D27', border: '1px solid #2D3148' }}
        >
          <p className="text-xs mb-4 font-medium" style={{ color: '#6B7280' }}>
            Symbol: <span style={{ color: '#F1F5F9' }}>{symbol}</span>
          </p>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="start-date" style={{ color: '#F1F5F9' }}>
                From
              </Label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                min={sevenDaysAgoStr}
                max={yesterdayStr}
                onChange={e => setStartDate(e.target.value)}
                className="rounded px-3 py-2 text-sm"
                style={{
                  backgroundColor: '#0F1117',
                  border: '1px solid #2D3148',
                  color: '#F1F5F9',
                  colorScheme: 'dark',
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="end-date" style={{ color: '#F1F5F9' }}>
                To
              </Label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                min={sevenDaysAgoStr}
                max={todayStr}
                onChange={e => setEndDate(e.target.value)}
                className="rounded px-3 py-2 text-sm"
                style={{
                  backgroundColor: '#0F1117',
                  border: '1px solid #2D3148',
                  color: '#F1F5F9',
                  colorScheme: 'dark',
                }}
              />
            </div>
          </div>

          <p className="text-xs mb-4" style={{ color: '#6B7280' }}>
            1-minute data is limited to the last 7 days
          </p>

          <Button
            onClick={handleRunBacktest}
            disabled={loading || !symbol || !startDate || !endDate}
            className="w-full md:w-auto"
            style={{ backgroundColor: loading ? '#6B7280' : '#3B82F6' }}
          >
            {loading ? 'Running backtest...' : 'Run Backtest'}
          </Button>
        </div>

        {/* Error state */}
        {error && !loading && (
          <p className="text-sm mb-4" style={{ color: '#EF4444' }}>
            {error}
          </p>
        )}

        {/* Results */}
        {results && (
          <div className="flex flex-col gap-8">
            {/* Candlestick chart with entry markers */}
            <CandlestickChart
              bars={results.bars}
              ema={results.ema}
              ifvgZones={[]}
              cisdLevel={null}
              markers={results.markers}
            />

            {/* Trade statistics */}
            <BacktestStatsPanel
              totalTrades={results.stats.total_trades}
              winRate={results.stats.win_rate}
              avgRMultiple={results.stats.avg_r_multiple}
            />

            {/* Equity curve */}
            <EquityCurve data={results.equity_curve} />
          </div>
        )}
      </main>
    </div>
  )
}
