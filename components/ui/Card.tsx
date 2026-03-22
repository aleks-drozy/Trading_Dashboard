interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-8 max-w-[400px] w-full ${className}`}
    >
      {children}
    </div>
  )
}
