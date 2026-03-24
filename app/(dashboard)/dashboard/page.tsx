import Link from "next/link"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import dbConnect from "@/lib/db"
import Trade from "@/lib/models/Trade"
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Activity,
  BookOpen,
  ArrowRight,
  Clock,
  BarChart2,
} from "lucide-react"
import { PnlChart } from "@/components/dashboard/PnlChart"
import { WinRateChart } from "@/components/dashboard/WinRateChart"
import { TradeCalendar } from "@/components/dashboard/TradeCalendar"
import { ForexNews } from "@/components/dashboard/ForexNews"
import { groupTradesByDay } from "@/lib/trade-calendar"
import { fetchForexCalendar } from "@/lib/forex-calendar"

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date | string | undefined): string {
  if (!d) return ""
  const date = d instanceof Date ? d : new Date(d)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  await dbConnect()
  const userId = session.user.id

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const [total, closed, trades, recentTrades, calendarTrades, forexEvents] = await Promise.all([
    Trade.countDocuments({ userId }),
    Trade.countDocuments({ userId, status: "closed" }),
    Trade.find({ userId, status: "closed" }).select("pnl entryDate").sort({ entryDate: 1 }).lean(),
    Trade.find({ userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("symbol direction pnl status assetClass entryDate")
      .lean(),
    Trade.find({ userId, status: "closed", entryDate: { $gte: startOfMonth, $lte: endOfMonth } })
      .select("entryDate pnl")
      .lean(),
    fetchForexCalendar().catch(() => ({ today: [], upcoming: [] })),
  ])

  const calendarInitialData = groupTradesByDay(
    calendarTrades as { entryDate: Date; pnl?: number }[]
  )

  const open = total - closed
  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
  const winners = trades.filter((t) => (t.pnl ?? 0) > 0).length
  const losers = closed - winners
  const winRate = closed > 0 ? Math.round((winners / closed) * 100) : null

  const cumulativeSeries = trades.reduce<number[]>(
    (acc, t) => {
      acc.push(acc[acc.length - 1] + (t.pnl ?? 0))
      return acc
    },
    [0]
  )

  const pnlIsPos = totalPnl > 0
  const pnlIsNeg = totalPnl < 0
  const pnlColor = pnlIsPos ? "text-[#00ff88]" : pnlIsNeg ? "text-[#ef4444]" : "text-[#94a3b8]"
  const pnlFormatted =
    totalPnl === 0
      ? "$0.00"
      : (totalPnl > 0 ? "+" : "") +
        totalPnl.toLocaleString("en-US", { style: "currency", currency: "USD" })

  const firstName = session.user.name?.split(" ")[0] ?? null

  // ── stat card definitions ──────────────────────────────────────────────────
  const statCards = [
    {
      label: "Total Trades",
      value: String(total),
      icon: BookOpen,
      sub: total === 0 ? "No trades logged yet" : `${open} open · ${closed} closed`,
      accentColor: "#94a3b8",
      valueColor: "text-[#f8fafc]",
      glow: null,
    },
    {
      label: "Total P&L",
      value: closed > 0 ? pnlFormatted : "--",
      icon: pnlIsNeg ? TrendingDown : TrendingUp,
      sub:
        closed > 0
          ? `Across ${closed} closed trade${closed === 1 ? "" : "s"}`
          : "No closed trades yet",
      accentColor: pnlIsPos ? "#00ff88" : pnlIsNeg ? "#ef4444" : "#94a3b8",
      valueColor: closed > 0 ? pnlColor : "text-[#94a3b8]",
      glow:
        closed > 0
          ? pnlIsPos
            ? "rgba(0,255,136,0.07)"
            : pnlIsNeg
              ? "rgba(239,68,68,0.07)"
              : null
          : null,
    },
    {
      label: "Win Rate",
      value: winRate !== null ? `${winRate}%` : "--",
      icon: Activity,
      sub:
        winRate !== null
          ? `${winners} win${winners === 1 ? "" : "s"} · ${losers} loss${losers === 1 ? "" : "es"}`
          : "No closed trades yet",
      accentColor: winRate === null ? "#94a3b8" : winRate >= 50 ? "#00ff88" : "#ef4444",
      valueColor:
        winRate === null ? "text-[#94a3b8]" : winRate >= 50 ? "text-[#00ff88]" : "text-[#ef4444]",
      glow:
        winRate !== null ? (winRate >= 50 ? "rgba(0,255,136,0.07)" : "rgba(239,68,68,0.07)") : null,
    },
  ]

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      <div className="flex-1 min-w-0 space-y-6">
        {/* ── Header ── */}
        <div className="flex items-start justify-between pt-1">
          <div>
            <p className="text-[10px] font-semibold text-[#475569] uppercase tracking-widest mb-1.5">
              Overview
            </p>
            <h1 className="text-2xl font-bold text-[#f8fafc] tracking-tight leading-none">
              {firstName ? `Hey, ${firstName}` : "Dashboard"}
            </h1>
            <p className="text-sm text-[#64748b] mt-2">
              {total === 0
                ? "Start logging trades to track your performance."
                : open > 0
                  ? `${open} open position${open === 1 ? "" : "s"} · tracking your edge`
                  : "All positions closed · reviewing your edge"}
            </p>
          </div>
          <Link
            href="/trades/new"
            className="inline-flex items-center gap-2 bg-[#00ff88] text-[#020617] font-bold text-sm rounded-xl px-4 h-10 hover:bg-[#00e67a] transition-colors duration-150 flex-shrink-0"
          >
            <Plus size={15} strokeWidth={2.5} />
            Log Trade
          </Link>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {statCards.map((card) => {
            const Icon = card.icon
            return (
              <div
                key={card.label}
                className="relative bg-[#0e1223] border border-[#1e293b] rounded-2xl p-5 overflow-hidden"
              >
                {/* Ambient corner glow for coloured cards */}
                {card.glow && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: `radial-gradient(ellipse at 90% 10%, ${card.glow} 0%, transparent 65%)`,
                    }}
                  />
                )}

                {/* Top row: label + icon badge */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-semibold text-[#475569] uppercase tracking-widest">
                    {card.label}
                  </span>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/5"
                    style={{ backgroundColor: `${card.accentColor}18` }}
                  >
                    <Icon size={14} style={{ color: card.accentColor }} />
                  </div>
                </div>

                {/* Value */}
                <p
                  className={`text-[28px] font-bold font-mono leading-none tracking-tight ${card.valueColor}`}
                >
                  {card.value}
                </p>

                {/* Divider */}
                <div className="h-px bg-[#1e293b] my-3" />

                {/* Sub */}
                <p className="text-xs text-[#475569] leading-relaxed">{card.sub}</p>
              </div>
            )
          })}
        </div>

        {/* ── Performance Charts ── */}
        {closed > 0 && (
          <div>
            <p className="text-xs font-medium text-[#64748b] uppercase tracking-widest mb-3">
              Performance
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Equity Curve */}
              <div className="sm:col-span-2 bg-[#0e1223] border border-[#1e293b] rounded-2xl p-5 overflow-hidden">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <p className="text-[10px] font-semibold text-[#475569] uppercase tracking-widest mb-2">
                      Equity Curve
                    </p>
                    <p
                      className={`text-2xl font-bold font-mono tracking-tight leading-none ${pnlColor}`}
                    >
                      {pnlFormatted}
                    </p>
                    <p className="text-xs text-[#475569] mt-1.5">
                      cumulative · {closed} trade{closed === 1 ? "" : "s"} closed
                    </p>
                  </div>
                  {/* Badge: win rate */}
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 ${
                      pnlIsPos
                        ? "bg-[#00ff88]/10 text-[#00ff88]"
                        : pnlIsNeg
                          ? "bg-[#ef4444]/10 text-[#ef4444]"
                          : "bg-[#94a3b8]/10 text-[#94a3b8]"
                    }`}
                  >
                    <BarChart2 size={12} />
                    {winRate !== null ? `${winRate}% WR` : "--"}
                  </div>
                </div>
                <PnlChart series={cumulativeSeries} totalPnl={totalPnl} />
              </div>

              {/* Win Rate */}
              <div className="bg-[#0e1223] border border-[#1e293b] rounded-2xl p-5 flex flex-col gap-4">
                <p className="text-[10px] font-semibold text-[#475569] uppercase tracking-widest">
                  Win / Loss
                </p>

                <div className="flex-1 flex items-center justify-center">
                  <WinRateChart winners={winners} losers={losers} winRate={winRate ?? 0} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#00ff88]/5 border border-[#00ff88]/10 rounded-xl px-3 py-3 text-center">
                    <p className="text-xl font-bold font-mono text-[#00ff88] leading-none">
                      {winners}
                    </p>
                    <p className="text-[10px] font-semibold text-[#475569] uppercase tracking-wide mt-1.5">
                      Wins
                    </p>
                  </div>
                  <div className="bg-[#ef4444]/5 border border-[#ef4444]/10 rounded-xl px-3 py-3 text-center">
                    <p className="text-xl font-bold font-mono text-[#ef4444] leading-none">
                      {losers}
                    </p>
                    <p className="text-[10px] font-semibold text-[#475569] uppercase tracking-wide mt-1.5">
                      Losses
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Empty State ── */}
        {total === 0 && (
          <div className="bg-[#0e1223] border border-[#1e293b] rounded-2xl p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#00ff88]/8 border border-[#00ff88]/12 flex items-center justify-center mx-auto mb-5">
              <BookOpen size={24} className="text-[#00ff88]" />
            </div>
            <h2 className="text-base font-semibold text-[#f8fafc] mb-2">No trades yet</h2>
            <p className="text-sm text-[#64748b] mb-7 max-w-xs mx-auto leading-relaxed">
              Log your first trade and your performance stats will appear here automatically.
            </p>
            <Link
              href="/trades/new"
              className="inline-flex items-center gap-2 bg-[#00ff88] text-[#020617] font-bold text-sm rounded-xl px-5 h-10 hover:bg-[#00e67a] transition-colors duration-150"
            >
              <Plus size={15} strokeWidth={2.5} />
              Log your first trade
            </Link>
          </div>
        )}

        {/* ── Recent Activity ── */}
        {total > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-[#64748b] uppercase tracking-widest">
                Recent Activity
              </p>
              <Link
                href="/trades"
                className="inline-flex items-center gap-1 text-xs text-[#00ff88] hover:text-[#00e67a] transition-colors duration-150 font-medium"
              >
                View all <ArrowRight size={12} />
              </Link>
            </div>

            <div className="bg-[#0e1223] border border-[#1e293b] rounded-2xl overflow-hidden divide-y divide-[#111827]">
              {recentTrades.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm text-[#64748b]">No recent trades.</p>
                </div>
              ) : (
                recentTrades.map((trade) => {
                  const isLong = trade.direction === "long"
                  const isClosed = trade.status === "closed"
                  const pnlVal = trade.pnl ?? 0
                  const pnlPos = pnlVal > 0
                  const pnlNeg = pnlVal < 0
                  const pnlStr = isClosed
                    ? (pnlPos ? "+" : "") +
                      pnlVal.toLocaleString("en-US", { style: "currency", currency: "USD" })
                    : null

                  return (
                    <div
                      key={String(trade._id)}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-[#141c2e]/70 transition-colors duration-100"
                    >
                      {/* Status icon */}
                      <div className="w-9 h-9 rounded-xl bg-[#141c2e] border border-[#1e293b] flex items-center justify-center flex-shrink-0">
                        {isClosed ? (
                          pnlPos ? (
                            <TrendingUp size={15} className="text-[#00ff88]" />
                          ) : pnlNeg ? (
                            <TrendingDown size={15} className="text-[#ef4444]" />
                          ) : (
                            <Activity size={15} className="text-[#94a3b8]" />
                          )
                        ) : (
                          <Clock size={15} className="text-[#64748b]" />
                        )}
                      </div>

                      {/* Symbol + meta */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#f8fafc] font-mono tracking-wide">
                            {String(trade.symbol).toUpperCase()}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wide ${
                              isLong
                                ? "bg-[#00ff88]/10 text-[#00ff88]"
                                : "bg-[#ef4444]/10 text-[#ef4444]"
                            }`}
                          >
                            {isLong ? "Long" : "Short"}
                          </span>
                        </div>
                        <p className="text-xs text-[#475569] mt-0.5">
                          {(trade as { assetClass?: string }).assetClass
                            ? capitalise(String((trade as { assetClass?: string }).assetClass))
                            : "Trade"}
                          {(trade as { entryDate?: Date }).entryDate
                            ? ` · ${fmtDate((trade as { entryDate?: Date }).entryDate)}`
                            : ""}
                        </p>
                      </div>

                      {/* P&L / status */}
                      <div className="text-right flex-shrink-0">
                        {pnlStr !== null ? (
                          <>
                            <span
                              className={`text-sm font-bold font-mono ${
                                pnlPos
                                  ? "text-[#00ff88]"
                                  : pnlNeg
                                    ? "text-[#ef4444]"
                                    : "text-[#94a3b8]"
                              }`}
                            >
                              {pnlStr}
                            </span>
                            <p className="text-[10px] text-[#475569] mt-0.5 uppercase tracking-wide">
                              closed
                            </p>
                          </>
                        ) : (
                          <span className="text-xs font-semibold text-[#00ff88] bg-[#00ff88]/8 border border-[#00ff88]/15 px-2.5 py-1 rounded-full">
                            Open
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      <aside className="w-full lg:w-[260px] flex-shrink-0 flex flex-col gap-4">
        <TradeCalendar initialData={calendarInitialData} initialMonth={currentMonth} />
        <ForexNews initialEvents={forexEvents} />
      </aside>
    </div>
  )
}
