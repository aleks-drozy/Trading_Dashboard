const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  Bullish: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22C55E' },
  Bearish: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444' },
  None: { bg: 'rgba(107, 114, 128, 0.15)', text: '#6B7280' },
  Expired: { bg: 'rgba(249, 115, 22, 0.15)', text: '#F97316' },
  above: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22C55E' },
  below: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444' },
}

const DISPLAY_MAP: Record<string, string> = {
  above: '↑ Above',
  below: '↓ Below',
}

interface SignalPillProps {
  state: string
  type?: 'ifvg' | 'cisd' | 'ema'
}

export function SignalPill({ state, type: _type }: SignalPillProps) {
  const colors = COLOR_MAP[state] || COLOR_MAP['None']
  const display = DISPLAY_MAP[state] || state

  return (
    <span
      className="rounded-full py-1 px-2.5 text-xs font-medium inline-flex items-center"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {display}
    </span>
  )
}
