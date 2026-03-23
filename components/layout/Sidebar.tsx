"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { LayoutDashboard, LineChart, LogOut } from "lucide-react"

interface SidebarProps {
  user: { name?: string | null; email?: string | null; image?: string | null }
}

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/trades", label: "Trades", icon: LineChart },
]

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()

  const initial = (user.name?.[0] ?? user.email?.[0] ?? "?").toUpperCase()
  const displayName = user.name ?? user.email ?? "User"

  return (
    <aside className="w-[220px] min-h-screen bg-[#111111] border-r border-[#1e1e1e] flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-[#1e1e1e]">
        <Link href="/dashboard" className="text-base font-bold text-[#e5e7eb] tracking-tight">
          Trade<span className="text-[#00ff88]">Journal</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-0.5 p-3 pt-4">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-[#00ff88]/10 text-[#00ff88]"
                  : "text-[#6b7280] hover:text-[#e5e7eb] hover:bg-[#1a1a1a]"
              }`}
            >
              <Icon size={17} strokeWidth={isActive ? 2.5 : 1.75} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="border-t border-[#1e1e1e] p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-7 h-7 bg-[#00ff88]/15 rounded-full flex items-center justify-center text-[11px] font-bold text-[#00ff88] flex-shrink-0">
            {initial}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-[#e5e7eb] truncate">{displayName}</span>
            {user.name && (
              <span className="text-[11px] text-[#4b5563] truncate">{user.email}</span>
            )}
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="mt-1 w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-[#6b7280] hover:text-[#ef4444] hover:bg-[#1a1a1a] transition-all duration-150"
          aria-label="Sign out"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
