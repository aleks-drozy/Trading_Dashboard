import mongoose, { Schema, Document, Types } from "mongoose"
import { calculateTradeMetrics } from "@/lib/calculations"

export interface ITrade extends Document {
  userId: Types.ObjectId
  symbol: string
  assetClass: "stock" | "crypto" | "forex" | "futures" | "options"
  direction: "long" | "short"
  entryPrice: number
  exitPrice?: number
  quantity: number
  stopLoss?: number
  takeProfit?: number
  entryDate: Date
  exitDate?: Date
  status: "open" | "closed"
  pnl?: number
  pnlPercent?: number
  riskRewardRatio?: number
  // Options-specific (optional at Mongoose level per D-13)
  strikePrice?: number
  expirationDate?: Date
  contractType?: "call" | "put"
  premium?: number
  // Futures-specific
  pointValue?: number
  // Context
  strategy: string
  tags: string[]
  notes: string
  chartImageUrl?: string | null
  createdAt: Date
  updatedAt: Date
}

const TradeSchema = new Schema<ITrade>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    assetClass: {
      type: String,
      enum: ["stock", "crypto", "forex", "futures", "options"],
      required: true,
    },
    direction: { type: String, enum: ["long", "short"], required: true },
    entryPrice: { type: Number, required: true },
    exitPrice: { type: Number },
    quantity: { type: Number, required: true },
    stopLoss: { type: Number },
    takeProfit: { type: Number },
    entryDate: { type: Date, required: true },
    exitDate: { type: Date },
    status: { type: String, enum: ["open", "closed"], required: true, default: "open" },
    pnl: { type: Number },
    pnlPercent: { type: Number },
    riskRewardRatio: { type: Number },
    strikePrice: { type: Number },
    expirationDate: { type: Date },
    contractType: { type: String, enum: ["call", "put"] },
    premium: { type: Number },
    pointValue: { type: Number },
    strategy: { type: String, default: "" },
    tags: { type: [String], default: [] },
    notes: { type: String, default: "" },
    chartImageUrl: { type: String },
  },
  { timestamps: true }
)

TradeSchema.pre("save", function () {
  // Derive status: closed requires both exitPrice and exitDate
  if (this.exitPrice !== undefined && this.exitDate !== undefined) {
    this.status = "closed"
  } else {
    this.status = "open"
  }

  if (this.status === "closed") {
    const metrics = calculateTradeMetrics({
      assetClass: this.assetClass,
      direction: this.direction,
      entryPrice: this.entryPrice,
      exitPrice: this.exitPrice!,
      quantity: this.quantity,
      premium: this.premium,
      pointValue: this.pointValue,
      stopLoss: this.stopLoss,
    })
    this.pnl = metrics.pnl
    this.pnlPercent = metrics.pnlPercent
    this.riskRewardRatio = metrics.riskRewardRatio
  } else {
    this.pnl = undefined
    this.pnlPercent = undefined
    this.riskRewardRatio = undefined
  }
})

// Delete cached model so schema changes take effect on Next.js hot-reload
// Without this, mongoose.models.Trade holds the old compiled schema and
// any field-level changes (defaults, validators) are silently ignored.
delete mongoose.models["Trade"]
export default mongoose.model<ITrade>("Trade", TradeSchema)
