import Link from "next/link"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#020617]">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[200px] bg-[#00ff88]/4 rounded-full blur-3xl pointer-events-none" />

      <header className="relative h-16 flex items-center justify-between px-6 border-b border-[#1e293b]">
        <Link href="/" className="text-base font-bold text-[#f8fafc] tracking-tight">
          Trade<span className="text-[#00ff88]">Journal</span>
        </Link>
        <Link
          href="/"
          className="text-sm text-[#64748b] hover:text-[#f8fafc] transition-colors duration-150"
        >
          ← Home
        </Link>
      </header>

      <div className="relative flex-1 flex items-center justify-center p-6">{children}</div>
    </div>
  )
}
