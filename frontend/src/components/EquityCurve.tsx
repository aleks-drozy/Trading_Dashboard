import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface EquityCurveProps {
  data: { date: string; cumPnl: number }[]
}

export function EquityCurve({ data }: EquityCurveProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: 200, color: '#6B7280' }}
      >
        No trades to plot.
      </div>
    )
  }

  return (
    <div>
      <h3
        className="text-sm uppercase tracking-wider mb-3"
        style={{ color: '#6B7280' }}
      >
        Cumulative P&L ($)
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2D3148" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#94A3B8', fontSize: 11 }}
            axisLine={{ stroke: '#2D3148' }}
            tickLine={{ stroke: '#2D3148' }}
            tickFormatter={(d: string) =>
              d.slice(5, 10).replace('-', '/') + ' ' + d.slice(11, 16)
            }
          />
          <YAxis
            tick={{ fill: '#94A3B8', fontSize: 11 }}
            axisLine={{ stroke: '#2D3148' }}
            tickLine={{ stroke: '#2D3148' }}
          />
          <Tooltip
            contentStyle={{
              background: '#1A1D27',
              border: 'none',
              color: '#F1F5F9',
            }}
          />
          <Area
            type="monotone"
            dataKey="cumPnl"
            stroke="#22C55E"
            strokeWidth={1.5}
            fill="rgba(34, 197, 94, 0.15)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
