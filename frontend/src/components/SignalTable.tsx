import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SignalPill } from './SignalPill'

interface Signal {
  symbol: string
  ifvg_state: string
  cisd_state: string
  ema_condition: string
  ema_value: number
  updated_at: string
}

export function SignalTable({ signals }: { signals: Signal[] }) {
  if (signals.length === 0) {
    return (
      <div className="py-12 text-center text-sm" style={{ color: '#6B7280' }}>
        No symbols in watchlist. Add symbols to begin tracking signals.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-b" style={{ borderColor: '#2D3148' }}>
          <TableHead className="text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>Symbol</TableHead>
          <TableHead className="text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>IFVG</TableHead>
          <TableHead className="text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>CISD</TableHead>
          <TableHead className="text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>EMA Condition</TableHead>
          <TableHead className="text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {signals.map((s) => {
          const time = s.updated_at
            ? new Date(s.updated_at).toLocaleTimeString('en-US', { hour12: false })
            : '--:--:--'
          return (
            <TableRow
              key={s.symbol}
              className="cursor-default hover:bg-[#1A1D27]"
              style={{ borderColor: '#2D3148' }}
            >
              <TableCell className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>
                {s.symbol.toUpperCase()}
              </TableCell>
              <TableCell><SignalPill state={s.ifvg_state} type="ifvg" /></TableCell>
              <TableCell><SignalPill state={s.cisd_state} type="cisd" /></TableCell>
              <TableCell><SignalPill state={s.ema_condition} type="ema" /></TableCell>
              <TableCell className="text-xs" style={{ color: '#6B7280' }}>{time}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
