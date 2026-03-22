export interface TradeMetrics {
  pnl: number
  pnlPercent: number
  riskRewardRatio?: number
}

export interface TradeForCalculation {
  assetClass: "stock" | "crypto" | "forex" | "options"
  direction: "long" | "short"
  entryPrice: number
  exitPrice: number
  quantity: number
  premium?: number
  stopLoss?: number
}

export function calculatePnl(
  assetClass: "stock" | "crypto" | "forex" | "options",
  direction: "long" | "short",
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  premium?: number
): number {
  if (assetClass === "options") {
    // For options, exitPrice represents the exit premium per share
    const entryPremium = premium ?? entryPrice
    if (direction === "long") {
      return (exitPrice - entryPremium) * quantity * 100
    } else {
      return (entryPremium - exitPrice) * quantity * 100
    }
  }

  // stocks, crypto, forex
  if (direction === "long") {
    return (exitPrice - entryPrice) * quantity
  } else {
    return (entryPrice - exitPrice) * quantity
  }
}

export function calculatePnlPercent(
  assetClass: "stock" | "crypto" | "forex" | "options",
  pnl: number,
  entryPrice: number,
  quantity: number,
  premium?: number
): number {
  if (assetClass === "options") {
    const entryPremium = premium ?? entryPrice
    return (pnl / (entryPremium * quantity * 100)) * 100
  }

  // stocks, crypto, forex
  return (pnl / (entryPrice * quantity)) * 100
}

export function calculateRiskReward(
  direction: "long" | "short",
  entryPrice: number,
  exitPrice: number,
  stopLoss: number
): number | undefined {
  if (direction === "long") {
    const denominator = entryPrice - stopLoss
    if (denominator <= 0) return undefined
    return (exitPrice - entryPrice) / denominator
  } else {
    const denominator = stopLoss - entryPrice
    if (denominator <= 0) return undefined
    return (entryPrice - exitPrice) / denominator
  }
}

export function calculateTradeMetrics(trade: TradeForCalculation): TradeMetrics {
  const pnl = calculatePnl(
    trade.assetClass,
    trade.direction,
    trade.entryPrice,
    trade.exitPrice,
    trade.quantity,
    trade.premium
  )

  const pnlPercent = calculatePnlPercent(
    trade.assetClass,
    pnl,
    trade.entryPrice,
    trade.quantity,
    trade.premium
  )

  const riskRewardRatio =
    trade.stopLoss !== undefined
      ? calculateRiskReward(trade.direction, trade.entryPrice, trade.exitPrice, trade.stopLoss)
      : undefined

  return { pnl, pnlPercent, riskRewardRatio }
}
