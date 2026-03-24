interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`bg-[#141c2e] border border-[#1e293b] rounded-xl p-8 max-w-[400px] w-full ${className}`}
    >
      {children}
    </div>
  )
}
