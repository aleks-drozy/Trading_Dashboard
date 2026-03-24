export function SessionIndicator({ active }: { active: boolean }) {
  const color = active ? "#22C55E" : "#6B7280"
  const label = active ? "NY Session Active" : "NY Session Closed"

  return (
    <div className="flex items-center gap-2">
      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs font-medium" style={{ color }}>
        {label}
      </span>
    </div>
  )
}
