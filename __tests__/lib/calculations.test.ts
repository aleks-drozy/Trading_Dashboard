import { describe, it, expect } from "vitest"
import {
  calculatePnl,
  calculatePnlPercent,
  calculateRiskReward,
  calculateTradeMetrics,
} from "@/lib/calculations"

describe("calculatePnl", () => {
  describe("stocks/crypto/forex", () => {
    it("calculates long P&L: (exitPrice - entryPrice) * quantity", () => {
      expect(calculatePnl("stock", "long", 100, 110, 10)).toBe(100)
    })
    it("calculates short P&L: (entryPrice - exitPrice) * quantity", () => {
      expect(calculatePnl("stock", "short", 100, 90, 10)).toBe(100)
    })
    it("handles negative P&L for losing long trade", () => {
      expect(calculatePnl("stock", "long", 100, 90, 10)).toBe(-100)
    })
    it("handles negative P&L for losing short trade", () => {
      expect(calculatePnl("stock", "short", 100, 110, 10)).toBe(-100)
    })
  })
  describe("futures", () => {
    it("calculates long futures P&L using point value", () => {
      // 3 MNQ contracts, entry 24580.25, exit 24610.50, point value $2
      // (24610.50 - 24580.25) * 3 * 2 = 30.25 * 3 * 2 = 181.50
      expect(calculatePnl("futures", "long", 24580.25, 24610.5, 3, undefined, 2)).toBeCloseTo(
        181.5,
        2
      )
    })
    it("calculates short futures P&L using point value", () => {
      // (24580.25 - 24610.50) * 3 * 2 = -181.50
      expect(calculatePnl("futures", "short", 24610.5, 24580.25, 3, undefined, 2)).toBeCloseTo(
        181.5,
        2
      )
    })
    it("defaults point value to 1 when omitted", () => {
      expect(calculatePnl("futures", "long", 100, 110, 5)).toBe(50)
    })
  })
  describe("options", () => {
    it("calculates long options P&L with 100-share multiplier", () => {
      // buy 2 contracts at $3 premium, sell at $5.50 => (5.50-3)*2*100 = 500
      expect(calculatePnl("options", "long", 150, 5.5, 2, 3)).toBe(500)
    })
    it("calculates short options P&L with 100-share multiplier", () => {
      // sell 2 contracts at $3 premium, buy back at $1 => (3-1)*2*100 = 400
      expect(calculatePnl("options", "short", 150, 1, 2, 3)).toBe(400)
    })
  })
})

describe("calculatePnlPercent", () => {
  it("calculates percent for stocks: (pnl / (entryPrice * quantity)) * 100", () => {
    expect(calculatePnlPercent("stock", 100, 100, 10)).toBe(10)
  })
  it("calculates percent for options: (pnl / (premium * quantity * 100)) * 100", () => {
    expect(calculatePnlPercent("options", 500, 150, 2, 3)).toBeCloseTo(83.33, 1)
  })
})

describe("calculateRiskReward", () => {
  it("calculates long R:R: (exitPrice - entryPrice) / (entryPrice - stopLoss)", () => {
    expect(calculateRiskReward("long", 100, 120, 90)).toBe(2)
  })
  it("calculates short R:R: (entryPrice - exitPrice) / (stopLoss - entryPrice)", () => {
    expect(calculateRiskReward("short", 100, 80, 110)).toBe(2)
  })
  it("returns undefined when stopLoss equals entryPrice (zero denominator)", () => {
    expect(calculateRiskReward("long", 100, 110, 100)).toBeUndefined()
  })
  it("returns undefined when denominator is negative", () => {
    expect(calculateRiskReward("long", 100, 110, 105)).toBeUndefined()
  })
})

describe("calculateTradeMetrics", () => {
  it("returns pnl, pnlPercent, and riskRewardRatio for a closed stock trade", () => {
    const result = calculateTradeMetrics({
      assetClass: "stock",
      direction: "long",
      entryPrice: 100,
      exitPrice: 110,
      quantity: 10,
      stopLoss: 90,
    })
    expect(result.pnl).toBe(100)
    expect(result.pnlPercent).toBe(10)
    expect(result.riskRewardRatio).toBe(1)
  })
  it("returns undefined riskRewardRatio when stopLoss is not provided", () => {
    const result = calculateTradeMetrics({
      assetClass: "stock",
      direction: "long",
      entryPrice: 100,
      exitPrice: 110,
      quantity: 10,
    })
    expect(result.riskRewardRatio).toBeUndefined()
  })
})
