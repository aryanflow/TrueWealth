import type { DisplayCurrency } from "@/components/DisplayPreferences";
import { formatInr, formatUsd } from "@/lib/format";

/** Convert INR book amount to display string (whole-book USD uses portfolio FX). */
export function formatBookAmount(
  inr: number,
  opts: {
    displayCurrency: DisplayCurrency;
    fxUsdInr?: number | null;
    signed?: boolean;
  },
): string {
  const { displayCurrency, fxUsdInr, signed = false } = opts;
  const useUsd = displayCurrency === "USD" && fxUsdInr != null && fxUsdInr > 0;
  const raw = useUsd ? formatUsd(inr / fxUsdInr) : formatInr(inr);
  if (!signed || inr === 0) return raw;
  const prefix = inr > 0 ? "+" : "";
  return `${prefix}${raw}`;
}

export function bookCurrencyLabel(displayCurrency: DisplayCurrency, fxUsdInr?: number | null): string {
  if (displayCurrency === "USD" && fxUsdInr) {
    return `USD · @ ${fxUsdInr.toFixed(2)}`;
  }
  return "INR";
}
