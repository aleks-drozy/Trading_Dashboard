import Link from "next/link"

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-[#0f0f0f]/80 backdrop-blur-md border-b border-[#2a2a2a] h-16">
      <div className="flex items-center justify-between h-full max-w-[1100px] mx-auto px-6">
        <Link href="/" className="text-xl font-bold text-[#e5e7eb] tracking-tight">
          Trade<span className="text-[#00ff88]">Journal</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-[#6b7280] hover:text-[#e5e7eb] transition-colors duration-150 px-3 py-2"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center bg-[#00ff88] text-[#0f0f0f] text-sm font-bold h-9 px-5 rounded-lg hover:bg-[#00e67a] transition-colors duration-150"
          >
            Start for free
          </Link>
        </div>
      </div>
    </nav>
  )
}
