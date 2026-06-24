import type { AllocationSlice } from "@/lib/types";

function topTwo(slices: AllocationSlice[]): { a?: AllocationSlice; b?: AllocationSlice } {
  const [a, b] = slices;
  return { a, b };
}

export function insightAssetTypes(slices: AllocationSlice[]): string {
  const { a, b } = topTwo(slices);
  if (!a || a.pct < 1) return "Add positions to see how your book is shaped by asset class.";
  if (a.pct >= 55) return `${a.key} is ${a.pct.toFixed(0)}% of the book — concentration in one asset bucket; consider balance vs your plan.`;
  if (b && b.pct > 15)
    return `${a.key} leads at ${a.pct.toFixed(0)}%, with meaningful ${b.key} (${b.pct.toFixed(0)}%) — two engines driving the portfolio.`;
  return `${a.key} is the largest sleeve at ${a.pct.toFixed(0)}% — the rest is spread across smaller slices.`;
}

export function insightCurrency(slices: AllocationSlice[]): string {
  const usd = slices.find((s) => s.key === "USD");
  const inr = slices.find((s) => s.key === "INR");
  if (!inr && !usd) return "Currency mix will appear once positions carry INR/USD labels.";
  const usdPct = usd?.pct ?? 0;
  if (usdPct < 2 && inr) return `INR-native legs are ${inr.pct.toFixed(0)}% of the INR book; USD economic exposure is ${usdPct.toFixed(1)}%.`;
  if (usdPct > 25) return `USD-native legs are ${usdPct.toFixed(0)}% of the INR book (converted at USDINR) — FX still moves the INR outcome.`;
  return `INR ${inr?.pct.toFixed(0) ?? "—"}% vs USD ${usdPct.toFixed(0)}% of the INR book — labels are native CCY, values are INR-equivalent.`;
}

export function insightCountry(slices: AllocationSlice[]): string {
  const us = slices.find((s) => s.key === "US");
  const inn = slices.find((s) => s.key === "IN");
  const usPct = us?.pct ?? 0;
  if (usPct < 3 && inn) return `India-listed risk is ${inn.pct.toFixed(0)}%; US is ${usPct.toFixed(1)}% — a mostly domestic book.`;
  if (usPct > 20) return `US exposure is ${usPct.toFixed(0)}% — diversification abroad is material; track both markets.`;
  return "Country mix reflects where your securities are listed — not necessarily where you pay tax.";
}
