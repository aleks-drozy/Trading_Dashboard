"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/Badge"
import { Toast } from "@/components/ui/Toast"
import { Trash2, Edit2, ChevronLeft, ChevronRight } from "lucide-react"

interface SerializedTrade {
  _id: string
  symbol: string
  assetClass: "stock" | "crypto" | "forex" | "options"
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
      return <span className="text-[#6b7280]">--</span>
    }
    const color = pnl > 0 ? "text-[#00ff88]" : pnl < 0 ? "text-[#ef4444]" : "text-[#6b7280]"
    const formatted =
      pnl === 0
        ? "$0.00"
        : (pnl > 0 ? "+" : "") +
          pnl.toLocaleString("en-US", { style: "currency", currency: "USD" })
    return <span className={color}>{formatted}</span>
  }

  // Empty states
  if (trades.length === 0) {
    if (!hasActiveFilters) {
      return (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-12 text-center">
          <h2 className="text-lg font-semibold text-[#e5e7eb] mb-2">No trades yet</h2>
          <p className="text-[#6b7280] mb-6">Log your first trade to see it here.</p>
          <Link
            href="/trades/new"
            className="inline-flex items-center gap-2 bg-[#00ff88] text-[#0f0f0f] font-bold text-sm rounded-lg px-4 h-[44px] hover:bg-[#00e67a] transition-colors"
          >
            Log Trade
          </Link>
        </div>
      )
    } else {
      return (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-12 text-center">
          <p className="text-[#6b7280] mb-3">No trades match your filters.</p>
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
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="bg-[#0f0f0f] text-[#6b7280] text-xs uppercase tracking-wider">
              <th className="px-4 py-3">Symbol</th>
              <th className="px-4 py-3">Asset Class</th>
              <th className="px-4 py-3">Direction</th>
              <th className="px-4 py-3">Entry Date</th>
              <th className="px-4 py-3">P&amp;L</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => (
              <tr
                key={trade._id}
                className="group cursor-pointer border-t border-[#2a2a2a] hover:bg-[#1a1a1a]/80 transition-colors"
                onClick={() => router.push(`/trades/${trade._id}`)}
              >
                <td className="px-4 py-3 text-[#e5e7eb] font-medium">{trade.symbol}</td>
                <td className="px-4 py-3">
                  <Badge variant={trade.assetClass}>{trade.assetClass}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={trade.direction}>{trade.direction}</Badge>
                </td>
                <td className="px-4 py-3 text-[#6b7280]">
                  {new Date(trade.entryDate).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 font-mono">{formatPnl(trade.pnl)}</td>
                <td className="px-4 py-3">
                  <Badge variant={trade.status}>{trade.status}</Badge>
                </td>
                <td
                  className="px-4 py-3 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-end gap-2">
                    {/* Edit button */}
                    <Link
                      href={`/trades/${trade._id}/edit`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-[#6b7280] hover:text-[#e5e7eb]"
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Edit trade ${trade.symbol}`}
                    >
                      <Edit2 size={14} />
                    </Link>

                    {/* Delete — two-step inline */}
                    {deletingId !== trade._id ? (
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-[#6b7280] hover:text-[#ef4444]"
                        onClick={() => setDeletingId(trade._id)}
                        aria-label={`Delete trade ${trade.symbol}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          className="text-xs text-[#ef4444] hover:underline"
                          onClick={() => handleDelete(trade._id)}
                        >
                          Confirm?
                        </button>
                        <button
                          className="text-xs text-[#6b7280] hover:underline"
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
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#2a2a2a]">
          <span className="text-sm text-[#6b7280]">{pagination.total} trades</span>
          <div className="flex items-center gap-3">
            <button
              disabled={pagination.page <= 1}
              onClick={() => goToPage(pagination.page - 1)}
              className="text-[#6b7280] hover:text-[#e5e7eb] disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-[#6b7280]">
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => goToPage(pagination.page + 1)}
              className="text-[#6b7280] hover:text-[#e5e7eb] disabled:opacity-30 disabled:cursor-not-allowed"
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
