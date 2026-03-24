interface DividerProps {
  label?: string
}

export function Divider({ label = "or continue with email" }: DividerProps) {
  return (
    <div className="flex items-center my-6">
      <div className="border-t border-[#1e293b] flex-1" />
      <span className="text-sm text-[#94a3b8] px-4">{label}</span>
      <div className="border-t border-[#1e293b] flex-1" />
    </div>
  )
}
