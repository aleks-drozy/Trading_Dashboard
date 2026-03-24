"use client"

interface PnlChartProps {
  series: number[] // cumulative P&L starting at 0: [0, c1, c2, ...]
  totalPnl: number
}

const VW = 480
const VH = 108
const PAD = { t: 10, r: 8, b: 10, l: 8 }
const CW = VW - PAD.l - PAD.r // 464
const CH = VH - PAD.t - PAD.b // 88

export function PnlChart({ series, totalPnl }: PnlChartProps) {
  if (series.length < 2) return null

  // Y domain — always include 0 so the baseline is visible
  const rawMin = Math.min(0, ...series)
  const rawMax = Math.max(0, ...series)
  const yPad = (rawMax - rawMin) * 0.12 || 5
  const yMin = rawMin - yPad
  const yMax = rawMax + yPad
  const yRange = yMax - yMin

  function xOf(i: number) {
    return PAD.l + (i / (series.length - 1)) * CW
  }
  function yOf(v: number) {
    return PAD.t + ((yMax - v) / yRange) * CH
  }

  const pts = series.map((v, i) => ({ x: xOf(i), y: yOf(v) }))
  const polyline = pts.map((p) => `${p.x},${p.y}`).join(" ")

  const isPositive = totalPnl >= 0
  const color = isPositive ? "#00ff88" : "#ef4444"
  const gradId = isPositive ? "pnlGradPos" : "pnlGradNeg"

  // Zero baseline Y
  const zeroY = yOf(0)
  const clampedZeroY = Math.min(PAD.t + CH, Math.max(PAD.t, zeroY))
  const showZeroLine = zeroY > PAD.t + 1 && zeroY < PAD.t + CH - 1

  // Closed area path: trace line then close back along zero baseline
  const areaPath = [
    `M ${pts[0].x} ${clampedZeroY}`,
    ...pts.map((p) => `L ${p.x} ${p.y}`),
    `L ${pts[pts.length - 1].x} ${clampedZeroY}`,
    "Z",
  ].join(" ")

  const lastPt = pts[pts.length - 1]

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      className="w-full"
      style={{ height: VH }}
      aria-label="Cumulative P&L chart"
      role="img"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
        {/* Subtle horizontal grid lines via pattern */}
      </defs>

      {/* Top horizontal guide */}
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l + CW} y2={PAD.t} stroke="#1e293b" strokeWidth="0.5" />

      {/* Zero baseline */}
      {showZeroLine && (
        <line
          x1={PAD.l}
          y1={zeroY}
          x2={PAD.l + CW}
          y2={zeroY}
          stroke="#334155"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
      )}

      {/* Bottom horizontal guide */}
      <line
        x1={PAD.l}
        y1={PAD.t + CH}
        x2={PAD.l + CW}
        y2={PAD.t + CH}
        stroke="#1e293b"
        strokeWidth="0.5"
      />

      {/* Gradient area */}
      <path d={areaPath} fill={`url(#${gradId})`} />

      {/* Equity line */}
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Start dot */}
      <circle cx={pts[0].x} cy={pts[0].y} r="2.5" fill={color} opacity="0.5" />

      {/* End dot */}
      <circle cx={lastPt.x} cy={lastPt.y} r="4" fill={color} stroke="#0e1223" strokeWidth="2" />
    </svg>
  )
}
