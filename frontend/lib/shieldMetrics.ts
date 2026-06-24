import type { PortfolioResponse } from "@/lib/types";

export interface ShieldMetrics {
  dataPct: number;
  riskPct: number;
  alignPct: number;
  score: number;
  missingCost: number;
  invalidPrice: number;
  breachText: string;
  alignSubline: string;
}

export function computeShieldMetrics(data: PortfolioResponse): ShieldMetrics {
  const dc = data.meta.data_completeness;
  const scoreBase = dc?.score ?? 72;
  const missing = dc?.missing_cost_basis_count ?? data.alerts.missing_cost_basis.length;
  const invalid = dc?.invalid_price_count ?? dc?.excluded_suspicious_price_count ?? 0;
  const stale = data.alerts.stale_data ? 1 : 0;
  const conc = data.alerts.concentration.length;

  const dataPct = Math.round(Math.min(100, Math.max(0, scoreBase - invalid * 8 - stale * 6)));
  const riskPct = Math.round(Math.max(0, Math.min(100, 100 - conc * 14 - stale * 12 - invalid * 10)));
  const top = [...data.allocation.by_asset_type].sort((a, b) => b.pct - a.pct)[0];
  const topPct = top?.pct ?? 0;
  const alignPct = Math.round(Math.max(0, Math.min(100, 100 - Math.max(0, topPct - 25) * 1.05)));

  const score = Math.round(dataPct * 0.45 + riskPct * 0.35 + alignPct * 0.2);
  const breachText =
    conc === 0
      ? "No concentration breaches in this view."
      : `${conc} concentration line${conc === 1 ? "" : "s"} above your guardrail.`;

  const sleeves = data.allocation.by_asset_type.filter((s) => s.pct > 0.05);
  const n = Math.max(1, sleeves.length);
  const ideal = 100 / n;
  const drift = sleeves.reduce((acc, s) => acc + Math.abs(s.pct - ideal), 0);
  const alignSubline =
    n >= 2 && drift > 4
      ? `Sleeve mix vs equal split: drift ${drift.toFixed(0)} pts · largest sleeve ${topPct.toFixed(1)}%.`
      : `Largest sleeve ${topPct.toFixed(1)}% of the INR book in this view.`;

  return {
    dataPct,
    riskPct,
    alignPct,
    score,
    missingCost: missing,
    invalidPrice: invalid,
    breachText,
    alignSubline,
  };
}

export function shieldScoreFormula(m: ShieldMetrics): string {
  return `${m.score} = 45%×${m.dataPct} + 35%×${m.riskPct} + 20%×${m.alignPct}`;
}
