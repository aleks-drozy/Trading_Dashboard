import Link from "next/link"

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-[#1a1a1a] border-b border-[#2a2a2a] h-16">
      <div className="flex items-center justify-between h-full px-8">
        {/* Logo */}
        <Link
          href="/"
          className="text-2xl font-bold text-[#e5e7eb]"
        >
          Trade<span className="text-[#00ff88]">/</span>Journal
        </Link>

        {/* Nav actions */}
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm text-[#6b7280] hover:text-[#e5e7eb] transition-colors duration-150"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center bg-[#00ff88] text-[#0f0f0f] text-sm font-bold h-9 px-5 rounded-lg hover:bg-[#00e67a] transition-colors duration-150"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  )
}
