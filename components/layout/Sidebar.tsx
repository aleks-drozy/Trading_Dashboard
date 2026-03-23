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

  const initial = user.name?.[0] ?? user.email?.[0] ?? "?"

  return (
    <aside className="w-[216px] min-h-screen bg-[#1a1a1a] border-r border-[#2a2a2a] flex flex-col">
      {/* Top — logo/app name */}
      <div className="h-16 flex items-center px-6">
        <span className="text-lg font-bold text-[#e5e7eb]">TradeJournal</span>
      </div>

      {/* Middle — nav links */}
      <nav className="flex-1 flex flex-col gap-1 px-3">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "text-[#00ff88] border-l-2 border-[#00ff88] pl-[14px]"
                  : "text-[#6b7280] hover:text-[#e5e7eb]"
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom — user info + sign out */}
      <div className="border-t border-[#2a2a2a] p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#2a2a2a] rounded-full flex items-center justify-center text-xs text-[#e5e7eb] flex-shrink-0">
            {initial.toUpperCase()}
          </div>
          <span className="text-xs text-[#6b7280] truncate max-w-[130px]">{user.email}</span>
        </div>
        <button
          onClick={() => signOut()}
          className="mt-3 flex items-center gap-1.5 text-xs text-[#6b7280] hover:text-[#ef4444] transition-colors"
          aria-label="Sign out"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
