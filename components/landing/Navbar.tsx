import Link from "next/link"

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-[#020617]/90 backdrop-blur-md border-b border-[#1e293b] h-16">
      <div className="flex items-center justify-between h-full max-w-[1100px] mx-auto px-6">
        <Link href="/" className="text-xl font-bold text-[#f8fafc] tracking-tight">
          Trade<span className="text-[#00ff88]">Journal</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="text-sm text-[#94a3b8] hover:text-[#f8fafc] transition-colors duration-150 px-4 py-2 rounded-lg hover:bg-[#0e1223]"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center bg-[#00ff88] text-[#020617] text-sm font-bold h-9 px-5 rounded-lg hover:bg-[#00e67a] transition-colors duration-150"
          >
            Start for free
          </Link>
        </div>
      </div>
    </nav>
  )
}
