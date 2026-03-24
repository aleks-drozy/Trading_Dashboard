"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { X, ImagePlus } from "lucide-react"
import { calculateTradeMetrics } from "@/lib/calculations"
import { tradeCreateSchema, tradeUpdateSchema } from "@/schemas/trade"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Textarea } from "@/components/ui/Textarea"
import { Button } from "@/components/ui/Button"
import { Toast } from "@/components/ui/Toast"
import { DatePicker } from "@/components/ui/DatePicker"
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
    chartImageUrl?: string | null
    pointValue?: number
  }
}

function SectionCard({
  number,
  title,
  children,
}: {
  number: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-[#0e1223] border border-[#1e293b] rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <span className="text-xs font-mono text-[#64748b]">{number}</span>
        <h2 className="text-sm font-semibold text-[#f8fafc]">{title}</h2>
      </div>
      {children}
    </div>
  )
}

export function TradeForm({ mode, initialData }: TradeFormProps) {
  const router = useRouter()

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

  const [pointValue, setPointValue] = useState(initialData?.pointValue?.toString() ?? "")

  const [strikePrice, setStrikePrice] = useState(initialData?.strikePrice?.toString() ?? "")
  const [expirationDate, setExpirationDate] = useState(
    initialData?.expirationDate ? initialData.expirationDate.split("T")[0] : ""
  )
  const [contractType, setContractType] = useState(initialData?.contractType ?? "")
  const [premium, setPremium] = useState(initialData?.premium?.toString() ?? "")

  const [strategy, setStrategy] = useState(initialData?.strategy ?? "")
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? [])
  const [tagInput, setTagInput] = useState("")
  const [notes, setNotes] = useState(initialData?.notes ?? "")

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(
    initialData?.chartImageUrl ?? null
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState("")
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  function handleAssetClassChange(value: string) {
    setAssetClass(value)
    if (value !== "options") {
      setStrikePrice("")
      setExpirationDate("")
      setContractType("")
      setPremium("")
    }
    if (value !== "futures") {
      setPointValue("")
    }
  }

  const livePreview = useMemo(() => {
    if (!exitPrice || !entryPrice || !quantity) return null
    const ep = parseFloat(entryPrice)
    const xp = parseFloat(exitPrice)
    const q = parseFloat(quantity)
    if (isNaN(ep) || isNaN(xp) || isNaN(q)) return null
    return calculateTradeMetrics({
      assetClass: assetClass as "stock" | "crypto" | "forex" | "futures" | "options",
      direction: direction as "long" | "short",
      entryPrice: ep,
      exitPrice: xp,
      quantity: q,
      premium: premium ? parseFloat(premium) : undefined,
      pointValue: pointValue ? parseFloat(pointValue) : undefined,
      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
    })
  }, [exitPrice, entryPrice, quantity, assetClass, direction, premium, pointValue, stopLoss])

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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview)
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError("")
    setFieldErrors({})

    const toISO = (d: string) => (d ? new Date(d).toISOString() : undefined)

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
      pointValue: pointValue ? parseFloat(pointValue) : undefined,
      strategy,
      tags: tagInput.trim() && !tags.includes(tagInput.trim()) ? [...tags, tagInput.trim()] : tags,
      notes,
      chartImageUrl: imagePreview && !imagePreview.startsWith("blob:") ? imagePreview : null,
    }

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

    let chartImageUrl = payload.chartImageUrl
    if (imageFile) {
      const formData = new FormData()
      formData.append("file", imageFile)
      try {
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData })
        const uploadData = await uploadRes.json()
        if (!uploadRes.ok || !uploadData.data?.url) {
          setToast({ message: uploadData.error ?? "Image upload failed.", type: "error" })
          setLoading(false)
          return
        }
        chartImageUrl = uploadData.data.url
      } catch {
        setToast({ message: "Image upload failed.", type: "error" })
        setLoading(false)
        return
      }
    }

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
      return
    } catch {
      setServerError("Something went wrong. Please try again.")
    }
    setLoading(false)
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 pb-24">
        {serverError && (
          <div className="border border-[#ef4444] bg-[#ef4444]/10 rounded-xl p-4 text-sm text-[#ef4444]">
            {serverError}
          </div>
        )}

        {/* 01 — Trade Info */}
        <SectionCard number="01" title="Trade info">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              id="symbol"
              label="Symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              onBlur={() => {
                if (symbol) setSymbol(symbol.toUpperCase().trim())
              }}
              error={fieldErrors.symbol}
              placeholder="AAPL"
            />
            <Select
              id="assetClass"
              label="Asset class"
              value={assetClass}
              onChange={(e) => handleAssetClassChange(e.target.value)}
              error={fieldErrors.assetClass}
            >
              <option value="stock">Stock</option>
              <option value="crypto">Crypto</option>
              <option value="forex">Forex</option>
              <option value="futures">Futures</option>
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
        </SectionCard>

        {/* 02 — Entry / Exit */}
        <SectionCard number="02" title="Entry and exit">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              id="entryPrice"
              label="Entry price"
              type="number"
              step="any"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              error={fieldErrors.entryPrice}
              placeholder="0.00"
            />
            <Input
              id="exitPrice"
              label="Exit price"
              type="number"
              step="any"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              error={fieldErrors.exitPrice}
              placeholder="0.00 (optional)"
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
              label="Stop loss"
              type="number"
              step="any"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              error={fieldErrors.stopLoss}
              placeholder="0.00 (optional)"
            />
            <Input
              id="takeProfit"
              label="Take profit"
              type="number"
              step="any"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              error={fieldErrors.takeProfit}
              placeholder="0.00 (optional)"
            />
            <div />
            <DatePicker
              id="entryDate"
              label="Entry date"
              value={entryDate}
              onChange={setEntryDate}
              error={fieldErrors.entryDate}
            />
            <DatePicker
              id="exitDate"
              label="Exit date"
              value={exitDate}
              onChange={setExitDate}
              error={fieldErrors.exitDate}
              optional
            />
          </div>
        </SectionCard>

        {/* 03 — Futures (conditional) */}
        {assetClass === "futures" && (
          <SectionCard number="03" title="Futures details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                id="pointValue"
                label="Point value"
                type="number"
                step="any"
                value={pointValue}
                onChange={(e) => setPointValue(e.target.value)}
                error={fieldErrors.pointValue}
                placeholder="e.g. 2 for MNQ, 20 for NQ, 50 for ES"
              />
            </div>
          </SectionCard>
        )}

        {/* 03/04 — Options (conditional) */}
        {assetClass === "options" && (
          <SectionCard number="04" title="Options details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                id="strikePrice"
                label="Strike price"
                type="number"
                step="any"
                value={strikePrice}
                onChange={(e) => setStrikePrice(e.target.value)}
                error={fieldErrors.strikePrice}
                placeholder="0.00"
              />
              <DatePicker
                id="expirationDate"
                label="Expiration date"
                value={expirationDate}
                onChange={setExpirationDate}
                error={fieldErrors.expirationDate}
              />
              <Select
                id="contractType"
                label="Contract type"
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
          </SectionCard>
        )}

        {/* 04 — Context */}
        <SectionCard
          number={assetClass === "options" || assetClass === "futures" ? "04" : "03"}
          title="Context"
        >
          <div className="flex flex-col gap-4">
            <Input
              id="strategy"
              label="Strategy"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              error={fieldErrors.strategy}
              placeholder="e.g. Breakout, VWAP bounce (optional)"
            />

            {/* Tags */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="tagInput" className="text-sm text-[#94a3b8]">
                Tags <span className="text-[#64748b]">(optional)</span>
              </label>
              <input
                id="tagInput"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Type a tag and press Enter"
                className="bg-[#020617] border border-[#1e293b] focus:border-[#00ff88]/50 focus:ring-2 focus:ring-[#00ff88]/10 rounded-lg px-4 py-3 h-[44px] text-sm text-[#f8fafc] placeholder-[#64748b] outline-none transition-colors duration-150"
              />
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 bg-[#141c2e] border border-[#1e293b] rounded-full px-3 py-1 text-xs text-[#f8fafc]"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-[#64748b] hover:text-[#ef4444] transition-colors"
                        aria-label={`Remove tag ${tag}`}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <Textarea
              id="notes"
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              error={fieldErrors.notes}
              placeholder="What went well? What would you do differently? (optional)"
            />

            {/* Chart upload */}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-[#94a3b8]">
                Chart screenshot <span className="text-[#64748b]">(optional)</span>
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                aria-label="Upload chart image"
              />
              {imagePreview ? (
                <div className="relative w-fit">
                  <img
                    src={imagePreview}
                    alt="Chart preview"
                    className="w-32 h-20 object-cover rounded-xl border border-[#1e293b]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview)
                      setImagePreview(null)
                      setImageFile(null)
                    }}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-[#141c2e] border border-[#1e293b] rounded-full flex items-center justify-center text-[#94a3b8] hover:text-[#ef4444] transition-colors"
                    aria-label="Remove image"
                  >
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-3 w-full border border-dashed border-[#1e293b] hover:border-[#334155] rounded-xl px-4 py-4 text-sm text-[#64748b] hover:text-[#94a3b8] transition-colors"
                >
                  <ImagePlus size={16} />
                  Click to upload a chart image
                </button>
              )}
            </div>
          </div>
        </SectionCard>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" variant="primary" loading={loading}>
            {mode === "create" ? "Save trade" : "Update trade"}
          </Button>
          <button
            type="button"
            onClick={() => router.push("/trades")}
            className="text-sm text-[#64748b] hover:text-[#94a3b8] transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>

      {livePreview && (
        <PnlPreviewBar
          pnl={livePreview.pnl}
          pnlPercent={livePreview.pnlPercent}
          riskRewardRatio={livePreview.riskRewardRatio}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </>
  )
}
