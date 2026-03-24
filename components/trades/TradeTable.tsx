"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/Badge"
import { Toast } from "@/components/ui/Toast"
import { Trash2, Edit2, ChevronLeft, ChevronRight, Plus } from "lucide-react"

interface SerializedTrade {
  _id: string
  symbol: string
  assetClass: "stock" | "crypto" | "forex" | "futures" | "options"
  direction: "long" | "short"
  entryDate: string
  pnl?: number | null
  pnlPercent?: number | null
  status: "open" | "closed"
}

interface TradeTableProps {
  trades: SerializedTrade[]
  pagination: { page: number; totalPages: number; total: number }
}

export function TradeTable({ trades, pagination }: TradeTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  const hasActiveFilters = Boolean(
    searchParams.get("assetClass") ||
    searchParams.get("direction") ||
    searchParams.get("status") ||
    searchParams.get("strategy") ||
    searchParams.get("tags") ||
    searchParams.get("from") ||
    searchParams.get("to")
  )

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/trades/${id}`, { method: "DELETE" })
      if (res.status === 204) {
        setDeletingId(null)
        setToast({ message: "Trade deleted.", type: "success" })
        router.refresh()
      } else {
        setToast({ message: "Failed to delete trade.", type: "error" })
      }
    } catch {
      setToast({ message: "Failed to delete trade.", type: "error" })
    }
  }

  function goToPage(n: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(n))
    router.push(`/trades?${params.toString()}`)
  }

  function formatPnl(pnl: number | null | undefined) {
    if (pnl === null || pnl === undefined) {
      return <span className="text-[#64748b]">--</span>
    }
    const color = pnl > 0 ? "text-[#00ff88]" : pnl < 0 ? "text-[#ef4444]" : "text-[#94a3b8]"
    const formatted =
      pnl === 0
        ? "$0.00"
        : (pnl > 0 ? "+" : "") + pnl.toLocaleString("en-US", { style: "currency", currency: "USD" })
    return <span className={`font-mono ${color}`}>{formatted}</span>
  }

  // Empty states
  if (trades.length === 0) {
    if (!hasActiveFilters) {
      return (
        <div className="bg-[#0e1223] border border-[#1e293b] rounded-2xl p-14 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#00ff88]/10 flex items-center justify-center mx-auto mb-4">
            <Plus size={22} className="text-[#00ff88]" />
          </div>
          <h2 className="text-base font-semibold text-[#f8fafc] mb-2">No trades yet</h2>
          <p className="text-sm text-[#64748b] mb-5">Log your first trade to see it here.</p>
          <Link
            href="/trades/new"
            className="inline-flex items-center gap-2 bg-[#00ff88] text-[#020617] font-bold text-sm rounded-lg px-5 h-10 hover:bg-[#00e67a] transition-colors"
          >
            Log Trade
          </Link>
        </div>
      )
    } else {
      return (
        <div className="bg-[#0e1223] border border-[#1e293b] rounded-2xl p-14 text-center">
          <p className="text-sm text-[#94a3b8] mb-3">No trades match your filters.</p>
          <button
            onClick={() => router.push("/trades")}
            className="text-sm text-[#00ff88] hover:underline"
          >
            Clear filters
          </button>
        </div>
      )
    }
  }

  return (
    <>
      <div className="bg-[#0e1223] border border-[#1e293b] rounded-2xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-[#1e293b]">
              <th className="px-5 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider">
                Symbol
              </th>
              <th className="px-5 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider">
                Class
              </th>
              <th className="px-5 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider">
                Side
              </th>
              <th className="px-5 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider">
                Date
              </th>
              <th className="px-5 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider">
                P&amp;L
              </th>
              <th className="px-5 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider">
                Status
              </th>
              <th className="px-5 py-3.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e293b]">
            {trades.map((trade) => (
              <tr
                key={trade._id}
                className="group cursor-pointer hover:bg-[#141c2e] transition-colors duration-100"
                onClick={() => router.push(`/trades/${trade._id}`)}
              >
                <td className="px-5 py-4 font-semibold text-[#f8fafc] tracking-wide">
                  {trade.symbol}
                </td>
                <td className="px-5 py-4">
                  <Badge variant={trade.assetClass}>{trade.assetClass}</Badge>
                </td>
                <td className="px-5 py-4">
                  <Badge variant={trade.direction}>{trade.direction}</Badge>
                </td>
                <td className="px-5 py-4 text-[#94a3b8] tabular-nums">
                  {new Date(trade.entryDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </td>
                <td className="px-5 py-4">{formatPnl(trade.pnl)}</td>
                <td className="px-5 py-4">
                  <Badge variant={trade.status}>{trade.status}</Badge>
                </td>
                <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href={`/trades/${trade._id}/edit`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#64748b] hover:text-[#f8fafc]"
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Edit ${trade.symbol}`}
                    >
                      <Edit2 size={14} />
                    </Link>

                    {deletingId !== trade._id ? (
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#64748b] hover:text-[#ef4444]"
                        onClick={() => setDeletingId(trade._id)}
                        aria-label={`Delete ${trade.symbol}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          className="text-xs text-[#ef4444] hover:underline font-medium"
                          onClick={() => handleDelete(trade._id)}
                        >
                          Delete
                        </button>
                        <button
                          className="text-xs text-[#64748b] hover:text-[#94a3b8]"
                          onClick={() => setDeletingId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#1e293b]">
          <span className="text-xs text-[#64748b]">
            {pagination.total} trade{pagination.total !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-3">
            <button
              disabled={pagination.page <= 1}
              onClick={() => goToPage(pagination.page - 1)}
              className="text-[#94a3b8] hover:text-[#f8fafc] disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-[#64748b] tabular-nums">
              {pagination.page} / {pagination.totalPages || 1}
            </span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => goToPage(pagination.page + 1)}
              className="text-[#94a3b8] hover:text-[#f8fafc] disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </>
  )
}
