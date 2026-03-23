"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { ArrowUp, ArrowDown, X } from "lucide-react"

interface TradeFilterBarProps {
  strategies: string[]
  availableTags: string[]
}

export function TradeFilterBar({ strategies, availableTags }: TradeFilterBarProps) {
  const searchParams = useSearchParams()
  const router = useRouter()

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.set("page", "1") // Always reset to page 1 on filter change
    router.push(`/trades?${params.toString()}`)
  }

  const activeTags = searchParams.get("tags")?.split(",").filter(Boolean) ?? []
  const sortDir = searchParams.get("sortDir") ?? "desc"

  function addTag(tag: string) {
    if (!activeTags.includes(tag)) {
      const newTags = [...activeTags, tag]
      updateFilter("tags", newTags.join(","))
    }
  }

  function removeTag(tag: string) {
    const newTags = activeTags.filter((t) => t !== tag)
    updateFilter("tags", newTags.join(","))
  }

  // Check if any filter (not page/sortBy/sortDir) is active
  const hasActiveFilters = Boolean(
    searchParams.get("assetClass") ||
      searchParams.get("direction") ||
      searchParams.get("status") ||
      searchParams.get("strategy") ||
      searchParams.get("tags") ||
      searchParams.get("from") ||
      searchParams.get("to")
  )

  const selectStyle =
    "bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-[#e5e7eb] h-[36px] outline-none focus:border-[#00ff88] transition-colors appearance-none"

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 mb-4">
      <div className="flex flex-wrap gap-3 items-center">
        {/* Asset Class */}
        <select
          id="filter-assetClass"
          className={selectStyle}
          value={searchParams.get("assetClass") ?? ""}
          onChange={(e) => updateFilter("assetClass", e.target.value)}
          aria-label="Filter by asset class"
        >
          <option value="">All Classes</option>
          <option value="stock">Stock</option>
          <option value="crypto">Crypto</option>
          <option value="forex">Forex</option>
          <option value="options">Options</option>
        </select>

        {/* Direction */}
        <select
          id="filter-direction"
          className={selectStyle}
          value={searchParams.get("direction") ?? ""}
          onChange={(e) => updateFilter("direction", e.target.value)}
          aria-label="Filter by direction"
        >
          <option value="">All Directions</option>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>

        {/* Status */}
        <select
          id="filter-status"
          className={selectStyle}
          value={searchParams.get("status") ?? ""}
          onChange={(e) => updateFilter("status", e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>

        {/* Strategy */}
        <select
          id="filter-strategy"
          className={selectStyle}
          value={searchParams.get("strategy") ?? ""}
          onChange={(e) => updateFilter("strategy", e.target.value)}
          aria-label="Filter by strategy"
        >
          <option value="">All Strategies</option>
          {strategies.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {/* Tags */}
        {availableTags.length > 0 && (
          <select
            id="filter-tags"
            className={selectStyle}
            value=""
            onChange={(e) => {
              if (e.target.value) addTag(e.target.value)
            }}
            aria-label="Filter by tag"
          >
            <option value="">Add Tag</option>
            {availableTags
              .filter((t) => !activeTags.includes(t))
              .map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
          </select>
        )}

        {/* From date */}
        <input
          type="date"
          id="filter-from"
          className={selectStyle}
          value={searchParams.get("from") ?? ""}
          onChange={(e) => updateFilter("from", e.target.value)}
          aria-label="Filter from date"
        />

        {/* To date */}
        <input
          type="date"
          id="filter-to"
          className={selectStyle}
          value={searchParams.get("to") ?? ""}
          onChange={(e) => updateFilter("to", e.target.value)}
          aria-label="Filter to date"
        />

        {/* Sort By */}
        <select
          id="sort-by"
          className={selectStyle}
          value={searchParams.get("sortBy") ?? "entryDate"}
          onChange={(e) => updateFilter("sortBy", e.target.value)}
          aria-label="Sort by"
        >
          <option value="entryDate">Entry Date</option>
          <option value="pnl">P&amp;L</option>
          <option value="symbol">Symbol</option>
        </select>

        {/* Sort Direction */}
        <button
          onClick={() => updateFilter("sortDir", sortDir === "asc" ? "desc" : "asc")}
          className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-2 h-[36px] text-[#6b7280] hover:text-[#e5e7eb] transition-colors"
          aria-label={sortDir === "asc" ? "Sort ascending" : "Sort descending"}
        >
          {sortDir === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
        </button>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={() => router.push("/trades")}
            className="text-xs text-[#6b7280] hover:text-[#e5e7eb] underline transition-colors ml-1"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Active tag chips */}
      {activeTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {activeTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded-full px-3 py-1 text-xs text-[#e5e7eb]"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="text-[#6b7280] hover:text-[#ef4444] transition-colors"
                aria-label={`Remove tag ${tag}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
