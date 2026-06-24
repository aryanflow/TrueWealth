import type { NormalizedHolding } from "@/lib/types";
import { holdingDisambiguator } from "@/lib/assetLabels";

function bookInr(h: NormalizedHolding): number {
  const v = h.inr_market_value;
  if (v != null && v > 0) return v;
  return h.market_value;
}

function esc(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function holdingsToCsv(holdings: NormalizedHolding[]): string {
  const header = ["name", "type", "currency", "quantity", "inr_value", "weight_pct", "cost_basis", "unrealized_inr"];
  const rows = holdings.map((h) => [
    esc(holdingDisambiguator(h)),
    h.asset_type,
    h.currency,
    String(h.quantity),
    String(bookInr(h)),
    h.weight.toFixed(2),
    h.avg_cost != null ? String(h.avg_cost) : "",
    h.inr_unrealized_pnl != null ? String(h.inr_unrealized_pnl) : "",
  ]);
  return [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
