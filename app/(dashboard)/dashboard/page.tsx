import Link from "next/link"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import dbConnect from "@/lib/db"
import Trade from "@/lib/models/Trade"
import { Plus, TrendingUp, TrendingDown, Activity, BookOpen } from "lucide-react"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  await dbConnect()
  const userId = session.user.id

  const [total, closed, trades] = await Promise.all([
    Trade.countDocuments({ userId }),
    Trade.countDocuments({ userId, status: "closed" }),
    Trade.find({ userId, status: "closed" }).select("pnl").lean(),
  ])

  const open = total - closed
  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
  const winners = trades.filter((t) => (t.pnl ?? 0) > 0).length
  const winRate = closed > 0 ? Math.round((winners / closed) * 100) : null

  const pnlColor = totalPnl > 0 ? "text-[#00ff88]" : totalPnl < 0 ? "text-[#ef4444]" : "text-[#6b7280]"
  const pnlFormatted =
    totalPnl === 0
      ? "$0.00"
      : (totalPnl > 0 ? "+" : "") +
        totalPnl.toLocaleString("en-US", { style: "currency", currency: "USD" })

  const firstName = session.user.name?.split(" ")[0] ?? null

  const stats = [
    {
      label: "Total Trades",
      value: String(total),
      icon: BookOpen,
      sub: total === 0 ? "Log your first trade" : `${open} open`,
    },
    {
      label: "Total P&L",
      value: closed > 0 ? pnlFormatted : "--",
      icon: totalPnl >= 0 ? TrendingUp : TrendingDown,
      valueColor: closed > 0 ? pnlColor : "text-[#6b7280]",
      sub: closed > 0 ? `${closed} closed trades` : "No closed trades yet",
    },
    {
      label: "Win Rate",
      value: winRate !== null ? `${winRate}%` : "--",
      icon: Activity,
      valueColor:
        winRate === null
          ? "text-[#6b7280]"
          : winRate >= 50
          ? "text-[#00ff88]"
          : "text-[#ef4444]",
      sub: winRate !== null ? `${winners} of ${closed} trades` : "No closed trades yet",
    },
  ]

  return (
    <div className="max-w-[900px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#e5e7eb]">
            {firstName ? `Hey, ${firstName}` : "Dashboard"}
          </h1>
          <p className="text-sm text-[#4b5563] mt-1">
            {total === 0 ? "Start logging trades to see your stats." : "Here's how you're doing."}
          </p>
        </div>
        <Link
          href="/trades/new"
          className="inline-flex items-center gap-2 bg-[#00ff88] text-[#0f0f0f] font-bold text-sm rounded-lg px-4 h-10 hover:bg-[#00e67a] transition-colors"
        >
          <Plus size={15} />
          Log Trade
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-[#4b5563] font-medium uppercase tracking-wider">
                  {stat.label}
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center">
                  <Icon size={15} className="text-[#6b7280]" />
                </div>
              </div>
              <p className={`text-2xl font-bold font-mono ${stat.valueColor ?? "text-[#e5e7eb]"}`}>
                {stat.value}
              </p>
              <p className="text-xs text-[#4b5563] mt-1">{stat.sub}</p>
            </div>
          )
        })}
      </div>

      {/* Quick actions */}
      {total === 0 && (
        <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#00ff88]/10 flex items-center justify-center mx-auto mb-4">
            <BookOpen size={22} className="text-[#00ff88]" />
          </div>
          <h2 className="text-base font-semibold text-[#e5e7eb] mb-2">No trades yet</h2>
          <p className="text-sm text-[#4b5563] mb-5">
            Log your first trade and your stats will appear here automatically.
          </p>
          <Link
            href="/trades/new"
            className="inline-flex items-center gap-2 bg-[#00ff88] text-[#0f0f0f] font-bold text-sm rounded-lg px-5 h-10 hover:bg-[#00e67a] transition-colors"
          >
            <Plus size={15} />
            Log your first trade
          </Link>
        </div>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#4b5563]">
            {open > 0 ? `You have ${open} open trade${open === 1 ? "" : "s"}.` : "All trades closed."}
          </p>
          <Link href="/trades" className="text-sm text-[#00ff88] hover:underline">
            View all trades
          </Link>
        </div>
      )}
    </div>
  )
}
