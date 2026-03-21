import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchWatchlist,
  addWatchlistSymbol,
  removeWatchlistSymbol,
  type WatchlistItem,
} from '@/lib/api'

export function WatchlistSidebar({ signalSymbols }: { signalSymbols: string[] }) {
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [addValue, setAddValue] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchWatchlist()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd() {
    const sym = addValue.trim().toUpperCase()
    if (!sym) return

    if (items.some(i => i.symbol === sym)) {
      setAddError('Already in watchlist')
      return
    }
    if (!/^[A-Z0-9.]{1,10}$/.test(sym)) {
      setAddError('Invalid ticker format')
      return
    }

    setAddError(null)
    setAddValue('')
    setItems(prev => [...prev, { symbol: sym, asset_type: 'stock' }])

    try {
      await addWatchlistSymbol(sym, 'stock')
      inputRef.current?.focus()
    } catch (err) {
      setItems(prev => prev.filter(i => i.symbol !== sym))
      setAddError(err instanceof Error ? err.message : 'Failed to add symbol')
    }
  }

  async function handleRemove(symbol: string) {
    setItems(prev => prev.filter(i => i.symbol !== symbol))
    try {
      await removeWatchlistSymbol(symbol)
    } catch {
      fetchWatchlist().then(setItems)
      toast.error(`Failed to remove ${symbol}`)
    }
  }

  return (
    <div
      className="flex flex-col"
      style={{
        width: 240,
        borderRight: '1px solid #2D3148',
        backgroundColor: '#0F1117',
        position: 'sticky',
        top: 56,
        height: 'calc(100vh - 56px)',
        overflowY: 'auto',
      }}
    >
      <div className="px-4 pt-6">
        <h2 className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>
          Watchlist
        </h2>
        <div style={{ borderBottom: '1px solid #2D3148' }} className="mt-2 mb-2" />

        {/* Add input row */}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            className="h-9 flex-1"
            value={addValue}
            placeholder="Ticker e.g. SPY"
            aria-label="Symbol ticker"
            onChange={e => {
              setAddValue(e.target.value.toUpperCase())
              setAddError(null)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdd()
            }}
          />
          <Button
            size="sm"
            variant="default"
            aria-label="Add symbol"
            onClick={handleAdd}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {addError && (
          <p className="text-xs mt-1" style={{ color: '#EF4444' }} role="alert">
            {addError}
          </p>
        )}

        {/* Symbol list */}
        <div className="mt-3 flex flex-col gap-2">
          {loading ? (
            <p className="text-xs" style={{ color: '#6B7280' }}>
              Loading...
            </p>
          ) : items.length === 0 ? (
            <div>
              <p className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>
                No symbols
              </p>
              <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
                Add a ticker above to start tracking signals.
              </p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.symbol} className="flex justify-between items-center">
                <div>
                  <span className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>
                    {item.symbol}
                  </span>
                  {!signalSymbols.includes(item.symbol) && (
                    <span className="text-xs ml-2" style={{ color: '#6B7280' }}>
                      awaiting data
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleRemove(item.symbol)}
                  aria-label={`Remove ${item.symbol}`}
                  className="p-1 rounded hover:bg-white/10"
                >
                  <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
