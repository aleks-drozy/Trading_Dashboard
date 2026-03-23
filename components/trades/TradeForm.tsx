"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"
import { calculateTradeMetrics } from "@/lib/calculations"
import { tradeCreateSchema, tradeUpdateSchema } from "@/schemas/trade"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Textarea } from "@/components/ui/Textarea"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Toast } from "@/components/ui/Toast"
import { PnlPreviewBar } from "@/components/trades/PnlPreviewBar"

interface TradeFormProps {
  mode: "create" | "edit"
  initialData?: {
    _id?: string
    symbol?: string
    assetClass?: string
    direction?: string
    entryPrice?: number
    exitPrice?: number
    quantity?: number
    stopLoss?: number
    takeProfit?: number
    entryDate?: string
    exitDate?: string
    strikePrice?: number
    expirationDate?: string
    contractType?: string
    premium?: number
    strategy?: string
    tags?: string[]
    notes?: string
    chartImageUrl?: string
  }
}

export function TradeForm({ mode, initialData }: TradeFormProps) {
  const router = useRouter()

  // Core trade fields (all stored as strings per Pitfall 5)
  const [symbol, setSymbol] = useState(initialData?.symbol ?? "")
  const [assetClass, setAssetClass] = useState(initialData?.assetClass ?? "stock")
  const [direction, setDirection] = useState(initialData?.direction ?? "long")
  const [entryPrice, setEntryPrice] = useState(initialData?.entryPrice?.toString() ?? "")
  const [exitPrice, setExitPrice] = useState(initialData?.exitPrice?.toString() ?? "")
  const [quantity, setQuantity] = useState(initialData?.quantity?.toString() ?? "")
  const [stopLoss, setStopLoss] = useState(initialData?.stopLoss?.toString() ?? "")
  const [takeProfit, setTakeProfit] = useState(initialData?.takeProfit?.toString() ?? "")
  const [entryDate, setEntryDate] = useState(
    initialData?.entryDate ? initialData.entryDate.split("T")[0] : ""
  )
  const [exitDate, setExitDate] = useState(
    initialData?.exitDate ? initialData.exitDate.split("T")[0] : ""
  )

  // Options-specific fields
  const [strikePrice, setStrikePrice] = useState(initialData?.strikePrice?.toString() ?? "")
  const [expirationDate, setExpirationDate] = useState(
    initialData?.expirationDate ? initialData.expirationDate.split("T")[0] : ""
  )
  const [contractType, setContractType] = useState(initialData?.contractType ?? "")
  const [premium, setPremium] = useState(initialData?.premium?.toString() ?? "")

  // Context fields
  const [strategy, setStrategy] = useState(initialData?.strategy ?? "")
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? [])
  const [tagInput, setTagInput] = useState("")
  const [notes, setNotes] = useState(initialData?.notes ?? "")

  // Image upload
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.chartImageUrl ?? null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState("")
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  // Handle asset class change — clear options fields when switching away (Pitfall 7)
  function handleAssetClassChange(value: string) {
    setAssetClass(value)
    if (value !== "options") {
      setStrikePrice("")
      setExpirationDate("")
      setContractType("")
      setPremium("")
    }
  }

  // Live P&L preview via useMemo (Pattern 3 — no useEffect needed)
  const livePreview = useMemo(() => {
    if (!exitPrice || !entryPrice || !quantity) return null
    const ep = parseFloat(entryPrice)
    const xp = parseFloat(exitPrice)
    const q = parseFloat(quantity)
    if (isNaN(ep) || isNaN(xp) || isNaN(q)) return null
    return calculateTradeMetrics({
      assetClass: assetClass as "stock" | "crypto" | "forex" | "options",
      direction: direction as "long" | "short",
      entryPrice: ep,
      exitPrice: xp,
      quantity: q,
      premium: premium ? parseFloat(premium) : undefined,
      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
    })
  }, [exitPrice, entryPrice, quantity, assetClass, direction, premium, stopLoss])

  // Tags: Enter or comma to add
  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      const tag = tagInput.trim()
      if (tag && !tags.includes(tag)) {
        setTags([...tags, tag])
      }
      setTagInput("")
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag))
  }

  // Image file selection
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  // Form submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError("")
    setFieldErrors({})

    // Convert date strings to ISO datetime (Pitfall 6)
    const toISO = (d: string) => (d ? new Date(d).toISOString() : undefined)

    // Parse numbers from strings (Pitfall 5)
    const payload = {
      symbol,
      assetClass,
      direction,
      entryPrice: parseFloat(entryPrice),
      exitPrice: exitPrice ? parseFloat(exitPrice) : undefined,
      quantity: parseFloat(quantity),
      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
      takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
      entryDate: toISO(entryDate)!,
      exitDate: toISO(exitDate),
      strikePrice: strikePrice ? parseFloat(strikePrice) : undefined,
      expirationDate: toISO(expirationDate),
      contractType: contractType || undefined,
      premium: premium ? parseFloat(premium) : undefined,
      strategy,
      tags,
      notes,
      chartImageUrl: initialData?.chartImageUrl,
    }

    // Validate with Zod
    const schema = mode === "create" ? tradeCreateSchema : tradeUpdateSchema
    const result = schema.safeParse(payload)
    if (!result.success) {
      const errors: Record<string, string> = {}
      result.error.issues.forEach((issue) => {
        const field = String(issue.path[0])
        if (!errors[field]) errors[field] = issue.message
      })
      setFieldErrors(errors)
      return
    }

    setLoading(true)

    // Upload image first if a new file was selected (D-11)
    let chartImageUrl = payload.chartImageUrl
    if (imageFile) {
      const formData = new FormData()
      formData.append("file", imageFile)
      try {
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData })
        const uploadData = await uploadRes.json()
        chartImageUrl = uploadData.data?.url
      } catch {
        setToast({ message: "Image upload failed — trade saved without chart.", type: "error" })
      }
    }

    // Save or update trade
    const url = mode === "create" ? "/api/trades" : `/api/trades/${initialData?._id}`
    const method = mode === "create" ? "POST" : "PUT"
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...result.data, chartImageUrl }),
      })
      if (!res.ok) {
        const data = await res.json()
        setServerError(data.error || "Something went wrong. Please try again.")
        setLoading(false)
        return
      }
      setToast({
        message: mode === "create" ? "Trade saved." : "Trade updated.",
        type: "success",
      })
      setTimeout(() => router.push("/trades"), 500)
    } catch {
      setServerError("Something went wrong. Please try again.")
    }
    setLoading(false)
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 pb-20">
        {serverError && (
          <div className="border border-[#ef4444] bg-[#ef4444]/10 rounded-lg p-3 text-sm text-[#ef4444]">
            {serverError}
          </div>
        )}

        {/* Section 1: Trade Info */}
        <Card className="max-w-none w-full">
          <p className="text-base font-bold text-[#e5e7eb] mb-4">Trade Info</p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Input
              id="symbol"
              label="Symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              onBlur={() => {
                if (symbol) setSymbol(symbol.toUpperCase().trim())
              }}
              error={fieldErrors.symbol}
              placeholder="e.g. AAPL"
            />
            <Select
              id="assetClass"
              label="Asset Class"
              value={assetClass}
              onChange={(e) => handleAssetClassChange(e.target.value)}
              error={fieldErrors.assetClass}
            >
              <option value="stock">Stock</option>
              <option value="crypto">Crypto</option>
              <option value="forex">Forex</option>
              <option value="options">Options</option>
            </Select>
            <Select
              id="direction"
              label="Direction"
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              error={fieldErrors.direction}
            >
              <option value="long">Long</option>
              <option value="short">Short</option>
            </Select>
          </div>
        </Card>

        {/* Section 2: Entry / Exit */}
        <Card className="max-w-none w-full">
          <p className="text-base font-bold text-[#e5e7eb] mb-4">Entry / Exit</p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Input
              id="entryPrice"
              label="Entry Price"
              type="number"
              step="any"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              error={fieldErrors.entryPrice}
              placeholder="0.00"
            />
            <Input
              id="exitPrice"
              label="Exit Price (optional)"
              type="number"
              step="any"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              error={fieldErrors.exitPrice}
              placeholder="0.00"
            />
            <Input
              id="quantity"
              label="Quantity"
              type="number"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              error={fieldErrors.quantity}
              placeholder="0"
            />
            <Input
              id="stopLoss"
              label="Stop Loss (optional)"
              type="number"
              step="any"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              error={fieldErrors.stopLoss}
              placeholder="0.00"
            />
            <Input
              id="takeProfit"
              label="Take Profit (optional)"
              type="number"
              step="any"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              error={fieldErrors.takeProfit}
              placeholder="0.00"
            />
            <Input
              id="entryDate"
              label="Entry Date"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              error={fieldErrors.entryDate}
            />
            <Input
              id="exitDate"
              label="Exit Date (optional)"
              type="date"
              value={exitDate}
              onChange={(e) => setExitDate(e.target.value)}
              error={fieldErrors.exitDate}
            />
          </div>
        </Card>

        {/* Section 3: Options Details (conditional) */}
        {assetClass === "options" && (
          <Card className="max-w-none w-full">
            <p className="text-base font-bold text-[#e5e7eb] mb-4">Options Details</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Input
                id="strikePrice"
                label="Strike Price"
                type="number"
                step="any"
                value={strikePrice}
                onChange={(e) => setStrikePrice(e.target.value)}
                error={fieldErrors.strikePrice}
                placeholder="0.00"
              />
              <Input
                id="expirationDate"
                label="Expiration Date"
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                error={fieldErrors.expirationDate}
              />
              <Select
                id="contractType"
                label="Contract Type"
                value={contractType}
                onChange={(e) => setContractType(e.target.value)}
                error={fieldErrors.contractType}
              >
                <option value="">Select type</option>
                <option value="call">Call</option>
                <option value="put">Put</option>
              </Select>
              <Input
                id="premium"
                label="Premium"
                type="number"
                step="any"
                value={premium}
                onChange={(e) => setPremium(e.target.value)}
                error={fieldErrors.premium}
                placeholder="0.00"
              />
            </div>
          </Card>
        )}

        {/* Section 4: Context */}
        <Card className="max-w-none w-full">
          <p className="text-base font-bold text-[#e5e7eb] mb-4">Context</p>
          <div className="flex flex-col gap-4">
            <Input
              id="strategy"
              label="Strategy (optional)"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              error={fieldErrors.strategy}
              placeholder="e.g. Breakout, VWAP bounce"
            />

            {/* Tags */}
            <div className="flex flex-col">
              <label htmlFor="tagInput" className="text-sm text-[#e5e7eb] mb-1.5 block">
                Tags (optional)
              </label>
              <input
                id="tagInput"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Type a tag and press Enter"
                className="bg-[#0f0f0f] border border-[#2a2a2a] focus:border-[#00ff88] focus:ring-2 focus:ring-[#00ff88]/15 rounded-lg px-4 py-3 h-[44px] text-base text-[#e5e7eb] placeholder-[#6b7280] outline-none transition-colors duration-150"
              />
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-[#2a2a2a] text-[#e5e7eb] text-xs px-2 py-1 flex items-center gap-1"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-[#6b7280] hover:text-[#ef4444] transition-colors"
                        aria-label={`Remove tag ${tag}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <Textarea
              id="notes"
              label="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              error={fieldErrors.notes}
              placeholder="Post-trade reflection, lessons learned..."
            />

            {/* Chart Screenshot upload */}
            <div className="flex flex-col">
              <span className="text-sm text-[#e5e7eb] mb-1.5 block">Chart Screenshot (optional)</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                aria-label="Upload chart image"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                className="max-w-[160px]"
              >
                Upload Chart
              </Button>
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="Chart preview"
                  className="w-20 h-20 object-cover rounded mt-2"
                />
              )}
            </div>
          </div>
        </Card>

        <Button
          type="submit"
          variant="primary"
          loading={loading}
          className="max-w-[200px]"
        >
          {mode === "create" ? "Save Trade" : "Update Trade"}
        </Button>
      </form>

      {livePreview && (
        <PnlPreviewBar
          pnl={livePreview.pnl}
          pnlPercent={livePreview.pnlPercent}
          riskRewardRatio={livePreview.riskRewardRatio}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </>
  )
}
