import { HoldingWithMarketValue } from '@/types/investment';

export interface AggregatedHolding extends HoldingWithMarketValue {
  /** Per-account breakdown for this security across the filtered account set. */
  accountBreakdowns: HoldingWithMarketValue[];
}

/**
 * Group holdings by security, summing quantities, cost basis and market values
 * across accounts. Average cost is recomputed from the aggregated totals so
 * cross-account rollups remain self-consistent. All input holdings for a given
 * security are assumed to share the same security currency (backend invariant).
 *
 * The aggregated row exposes `accountBreakdowns` so callers can render a
 * per-account drill-down without re-fetching.
 */
export function aggregateHoldingsBySecurity(
  holdings: HoldingWithMarketValue[],
): AggregatedHolding[] {
  const map = new Map<string, AggregatedHolding>();

  for (const h of holdings) {
    const existing = map.get(h.securityId);
    if (!existing) {
      map.set(h.securityId, { ...h, accountBreakdowns: [h] });
      continue;
    }

    const totalQuantity = Number(existing.quantity) + Number(h.quantity);
    const totalCostBasis = Number(existing.costBasis) + Number(h.costBasis);
    const totalCostBasisAccountCurrency =
      Number(existing.costBasisAccountCurrency) +
      Number(h.costBasisAccountCurrency);
    const existingMv = existing.marketValue;
    const addMv = h.marketValue;
    const totalMarketValue =
      existingMv === null && addMv === null
        ? null
        : (existingMv ?? 0) + (addMv ?? 0);
    const gainLoss =
      totalMarketValue !== null ? totalMarketValue - totalCostBasis : null;
    const gainLossPercent =
      gainLoss !== null && totalCostBasis > 0
        ? (gainLoss / totalCostBasis) * 100
        : null;
    const averageCost = totalQuantity > 0 ? totalCostBasis / totalQuantity : 0;

    map.set(h.securityId, {
      ...existing,
      quantity: totalQuantity,
      averageCost,
      costBasis: totalCostBasis,
      costBasisAccountCurrency: totalCostBasisAccountCurrency,
      marketValue: totalMarketValue,
      gainLoss,
      gainLossPercent,
      accountBreakdowns: [...existing.accountBreakdowns, h],
    });
  }

  return Array.from(map.values());
}
