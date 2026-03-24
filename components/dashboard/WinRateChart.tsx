"use client"

interface WinRateChartProps {
  winners: number
  losers: number
  winRate: number // 0–100 integer
}

const CX = 70
const CY = 70
const R = 46 // stroke path radius (midpoint of ring)
const SW = 13 // stroke width (ring thickness)
const C = 2 * Math.PI * R // ≈ 289.03

export function WinRateChart({ winners, losers, winRate }: WinRateChartProps) {
  const total = winners + losers
  if (total === 0) return null

  const winFrac = winners / total
  const lossFrac = losers / total

  const winLen = winFrac * C
  const lossLen = lossFrac * C

  // Rotation angles: SVG circles start at 3 o'clock; rotate -90 to start at 12 o'clock
  const winStartAngle = -90
  const lossStartAngle = -90 + winFrac * 360

  const rateColor = winRate >= 50 ? "#00ff88" : "#ef4444"

  return (
    <svg
      viewBox="0 0 140 140"
      className="w-full max-w-[156px] mx-auto block"
      aria-label={`Win rate ${winRate}%`}
      role="img"
    >
      {/* Background ring */}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#141c2e" strokeWidth={SW} />

      {/* Loss arc (red) */}
      {lossFrac > 0 && (
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="#ef4444"
          strokeWidth={SW}
          strokeDasharray={`${lossLen} ${C}`}
          transform={`rotate(${lossStartAngle}, ${CX}, ${CY})`}
          strokeLinecap="butt"
          opacity="0.85"
        />
      )}

      {/* Win arc (green) */}
      {winFrac > 0 && (
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="#00ff88"
          strokeWidth={SW}
          strokeDasharray={`${winLen} ${C}`}
          transform={`rotate(${winStartAngle}, ${CX}, ${CY})`}
          strokeLinecap="butt"
        />
      )}

      {/* Center rate */}
      <text
        x={CX}
        y={CY - 7}
        textAnchor="middle"
        dominantBaseline="auto"
        fill={rateColor}
        fontSize="22"
        fontWeight="700"
        fontFamily="ui-monospace, monospace"
      >
        {winRate}%
      </text>

      {/* Center label */}
      <text
        x={CX}
        y={CY + 9}
        textAnchor="middle"
        dominantBaseline="auto"
        fill="#64748b"
        fontSize="9.5"
        fontFamily="ui-sans-serif, sans-serif"
        letterSpacing="0.04em"
      >
        WIN RATE
      </text>
    </svg>
  )
}
