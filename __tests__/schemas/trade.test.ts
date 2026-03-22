import { describe, it, expect } from "vitest"
import { tradeCreateSchema, tradeUpdateSchema } from "@/schemas/trade"

describe("tradeCreateSchema", () => {
  const validTrade = {
    symbol: "AAPL",
    assetClass: "stock" as const,
    direction: "long" as const,
    entryPrice: 150,
    quantity: 10,
    entryDate: "2026-01-15T10:00:00.000Z",
  }

  it("accepts a valid open trade (no exit fields)", () => {
    const result = tradeCreateSchema.safeParse(validTrade)
    expect(result.success).toBe(true)
  })

  it("accepts a valid closed trade (both exit fields)", () => {
    const result = tradeCreateSchema.safeParse({
      ...validTrade,
      exitPrice: 160,
      exitDate: "2026-01-16T10:00:00.000Z",
    })
    expect(result.success).toBe(true)
  })

  it("rejects exitPrice without exitDate (D-12)", () => {
    const result = tradeCreateSchema.safeParse({ ...validTrade, exitPrice: 160 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("exitDate")
    }
  })

  it("rejects exitDate without exitPrice (D-12)", () => {
    const result = tradeCreateSchema.safeParse({
      ...validTrade,
      exitDate: "2026-01-16T10:00:00.000Z",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("exitPrice")
    }
  })

  it("requires options fields when assetClass is options (D-13)", () => {
    const result = tradeCreateSchema.safeParse({
      ...validTrade,
      assetClass: "options",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain("strikePrice")
      expect(paths).toContain("expirationDate")
      expect(paths).toContain("contractType")
      expect(paths).toContain("premium")
    }
  })

  it("accepts options trade with all required options fields (D-13)", () => {
    const result = tradeCreateSchema.safeParse({
      ...validTrade,
      assetClass: "options",
      strikePrice: 155,
      expirationDate: "2026-02-20T00:00:00.000Z",
      contractType: "call",
      premium: 3.5,
    })
    expect(result.success).toBe(true)
  })

  it("defaults strategy to empty string", () => {
    const result = tradeCreateSchema.safeParse(validTrade)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.strategy).toBe("")
    }
  })

  it("defaults tags to empty array", () => {
    const result = tradeCreateSchema.safeParse(validTrade)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tags).toEqual([])
    }
  })
})

describe("tradeUpdateSchema", () => {
  it("accepts partial updates (only some fields)", () => {
    const result = tradeUpdateSchema.safeParse({ symbol: "MSFT" })
    expect(result.success).toBe(true)
  })

  it("rejects exitPrice without exitDate when both relevant in update", () => {
    const result = tradeUpdateSchema.safeParse({ exitPrice: 160 })
    expect(result.success).toBe(false)
  })
})
