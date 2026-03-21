import { useState, useEffect, useCallback, useRef } from 'react'
import { Toaster, toast } from 'sonner'
import { DashboardHeader } from '@/components/DashboardHeader'
import { SignalTable } from '@/components/SignalTable'
import { PortfolioCard } from '@/components/PortfolioCard'
import { TradesTable } from '@/components/TradesTable'
import { WatchlistSidebar } from '@/components/WatchlistSidebar'
import { useSignalWebSocket } from '@/hooks/useSignalWebSocket'
import { fetchPortfolio, fetchTrades, type Portfolio, type PaperTrade } from '@/lib/api'

export default function DashboardPage() {
  const { signals, nySessionActive, wsStatus } = useSignalWebSocket()
  const signalSymbols = signals.map(s => s.symbol)
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [trades, setTrades] = useState<PaperTrade[]>([])
  const wasConnectedRef = useRef(false)

  const loadData = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([fetchPortfolio(), fetchTrades()])
      setPortfolio(p)
      setTrades(t)
    } catch (e) {
      console.error('Failed to load paper trading data:', e)
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 60000)
    return () => clearInterval(interval)
  }, [loadData])

  // Show toast only when a previously established connection drops
  useEffect(() => {
    if (wsStatus === 'connected') {
      wasConnectedRef.current = true
    } else if (wsStatus === 'disconnected' && wasConnectedRef.current) {
      toast.error('Connection lost. Reconnecting...')
    }
  }, [wsStatus])

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0F1117' }}>
      <DashboardHeader nySessionActive={nySessionActive} wsStatus={wsStatus} />
      <Toaster position="top-right" theme="dark" />

      <div className="flex">
        <WatchlistSidebar signalSymbols={signalSymbols} />
        <main className="flex-1 max-w-[1280px] mx-auto px-6 pt-6">
          {/* Signal Table */}
          <section>
            <SignalTable signals={signals} />
          </section>

          {/* Portfolio Value */}
          <section className="pt-12">
            <PortfolioCard portfolio={portfolio} />
          </section>

          {/* Closed Trades */}
          <section className="pt-12 pb-16">
            <h2 className="text-xl font-semibold mb-4" style={{ color: '#F1F5F9' }}>
              Closed Trades
            </h2>
            <TradesTable trades={trades} />
          </section>
        </main>
      </div>
    </div>
  )
}
