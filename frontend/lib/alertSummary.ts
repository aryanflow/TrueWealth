import type { NormalizedHolding, PortfolioAlerts, PortfolioMeta } from "@/lib/types";

export interface AlertSummary {
  total: number;
  concentration: number;
  missingCostHoldings: number;
  stale: boolean;
  missingCostItems: { holding_id: string; name: string }[];
}

export function summarizeAlerts(
  alerts: PortfolioAlerts,
  meta: PortfolioMeta,
  _holdings: NormalizedHolding[],
): AlertSummary {
  const missingFromMeta = meta.data_completeness?.missing_cost_basis_count;
  const items = alerts.missing_cost_basis ?? [];
  const missingCostHoldings =
    missingFromMeta != null && missingFromMeta > 0 ? missingFromMeta : items.length;

  const concentration = alerts.concentration?.length ?? 0;
  const stale = Boolean(alerts.stale_data);
  const total = concentration + missingCostHoldings + (stale ? 1 : 0);

  return {
    total,
    concentration,
    missingCostHoldings,
    stale,
    missingCostItems: items,
  };
}
