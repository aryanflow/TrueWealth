import type { NormalizedHolding, PortfolioTotals } from "@/lib/types";

export type IntradayStatus = "available" | "unavailable" | "markets_closed";

function dayVal(h: NormalizedHolding): number | null {
  const v = h.inr_day_change_value ?? h.day_change_value;
  return v != null ? v : null;
}

/** Detect placeholder zeros vs real intraday moves. */
export function deriveIntradayStatus(totals: PortfolioTotals, holdings: NormalizedHolding[]): IntradayStatus {
  const withField = holdings.filter((h) => dayVal(h) != null);
  if (withField.length === 0) return "unavailable";

  const anyNonZero =
    Math.abs(totals.day_change_value) >= 0.01 ||
    withField.some((h) => Math.abs(dayVal(h) ?? 0) >= 0.01);

  if (!anyNonZero) {
    const hasEquity = holdings.some((h) =>
      ["IN_STOCK", "US_STOCK", "ETF", "MF", "CRYPTO"].includes(h.asset_type),
    );
    return hasEquity ? "markets_closed" : "unavailable";
  }

  return "available";
}

export function intradayUnavailableCopy(status: IntradayStatus): string {
  if (status === "markets_closed") {
    return "Intraday move unavailable — markets closed or the feed did not publish day P&L for this sync.";
  }
  return "Intraday move unavailable — FD, EPF, and some sleeves do not report day P&L from the feed.";
}
