import { z } from "zod"

const tradeBaseObject = z.object({
  symbol: z
    .string()
    .min(1, "Symbol is required")
    .transform((s) => s.toUpperCase().trim()),
  assetClass: z.enum(["stock", "crypto", "forex", "futures", "options"]),
  direction: z.enum(["long", "short"]),
  entryPrice: z.number().positive("Entry price must be positive"),
  exitPrice: z.number().positive("Exit price must be positive").optional(),
  quantity: z.number().positive("Quantity must be positive"),
  stopLoss: z.number().positive("Stop loss must be positive").optional(),
  takeProfit: z.number().positive("Take profit must be positive").optional(),
  entryDate: z.string().datetime("Invalid entry date"),
  exitDate: z.string().datetime("Invalid exit date").optional(),
  strikePrice: z.number().positive("Strike price must be positive").optional(),
  expirationDate: z.string().datetime("Invalid expiration date").optional(),
  contractType: z.enum(["call", "put"]).optional(),
  premium: z.number().positive("Premium must be positive").optional(),
  pointValue: z.number().positive("Point value must be positive").optional(),
  strategy: z.string().default(""),
  tags: z.array(z.string()).default([]),
  notes: z.string().default(""),
  chartImageUrl: z.string().url("Invalid chart image URL").nullable().optional(),
})

type TradeBaseOutput = z.output<typeof tradeBaseObject>
type TradeBasePartialOutput = Partial<TradeBaseOutput>

function applyCreateRefinements(data: TradeBaseOutput, ctx: z.RefinementCtx): void {
  // D-12 — exitPrice and exitDate must both be provided to close a trade
  const hasExitPrice = data.exitPrice !== undefined
  const hasExitDate = data.exitDate !== undefined
  if (hasExitPrice !== hasExitDate) {
    ctx.addIssue({
      code: "custom",
      message: "exitPrice and exitDate must both be provided to close a trade",
      path: hasExitPrice ? ["exitDate"] : ["exitPrice"],
    })
  }

  // D-13 — options fields required when assetClass === "options"
  if (data.assetClass === "options") {
    if (data.strikePrice === undefined)
      ctx.addIssue({
        code: "custom",
        message: "strikePrice is required for options trades",
        path: ["strikePrice"],
      })
    if (data.expirationDate === undefined)
      ctx.addIssue({
        code: "custom",
        message: "expirationDate is required for options trades",
        path: ["expirationDate"],
      })
    if (data.contractType === undefined)
      ctx.addIssue({
        code: "custom",
        message: "contractType is required for options trades",
        path: ["contractType"],
      })
    if (data.premium === undefined)
      ctx.addIssue({
        code: "custom",
        message: "premium is required for options trades",
        path: ["premium"],
      })
  }

  // D-14 — pointValue required when assetClass === "futures"
  if (data.assetClass === "futures" && data.pointValue === undefined) {
    ctx.addIssue({
      code: "custom",
      message: "pointValue is required for futures trades",
      path: ["pointValue"],
    })
  }
}

function applyUpdateRefinements(data: TradeBasePartialOutput, ctx: z.RefinementCtx): void {
  // D-12 — only check when at least one of exitPrice/exitDate is present in the update payload
  const hasExitPrice = data.exitPrice !== undefined
  const hasExitDate = data.exitDate !== undefined
  if (hasExitPrice !== hasExitDate) {
    ctx.addIssue({
      code: "custom",
      message: "exitPrice and exitDate must both be provided to close a trade",
      path: hasExitPrice ? ["exitDate"] : ["exitPrice"],
    })
  }

  // D-13 — only check when assetClass is present in the update payload and equals "options"
  if (data.assetClass === "options") {
    if (data.strikePrice === undefined)
      ctx.addIssue({
        code: "custom",
        message: "strikePrice is required for options trades",
        path: ["strikePrice"],
      })
    if (data.expirationDate === undefined)
      ctx.addIssue({
        code: "custom",
        message: "expirationDate is required for options trades",
        path: ["expirationDate"],
      })
    if (data.contractType === undefined)
      ctx.addIssue({
        code: "custom",
        message: "contractType is required for options trades",
        path: ["contractType"],
      })
    if (data.premium === undefined)
      ctx.addIssue({
        code: "custom",
        message: "premium is required for options trades",
        path: ["premium"],
      })
  }

  // D-14 — only check when assetClass is present in the update payload and equals "futures"
  if (data.assetClass === "futures" && data.pointValue === undefined) {
    ctx.addIssue({
      code: "custom",
      message: "pointValue is required for futures trades",
      path: ["pointValue"],
    })
  }
}

export const tradeCreateSchema = tradeBaseObject.superRefine(applyCreateRefinements)

export const tradeUpdateSchema = tradeBaseObject.partial().superRefine(applyUpdateRefinements)

export type TradeCreateInput = z.infer<typeof tradeCreateSchema>
export type TradeUpdateInput = z.infer<typeof tradeUpdateSchema>
