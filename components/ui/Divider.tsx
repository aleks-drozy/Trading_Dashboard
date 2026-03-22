interface DividerProps {
  label?: string
}

export function Divider({ label = "or continue with email" }: DividerProps) {
  return (
    <div className="flex items-center my-6">
      <div className="border-t border-[#2a2a2a] flex-1" />
      <span className="text-sm text-[#6b7280] px-4">{label}</span>
      <div className="border-t border-[#2a2a2a] flex-1" />
    </div>
  )
}
