"use client";

import { useDisplayPreferencesOptional } from "@/components/DisplayPreferences";
import { usePortfolio } from "@/components/PortfolioContext";
import { formatBookAmount } from "@/lib/bookCurrency";
import { formatInr, formatUsd } from "@/lib/format";

export function MoneyValue({
  inr,
  native,
  currency = "INR",
  className = "",
  signed = false,
}: {
  inr: number;
  native?: number;
  currency?: string;
  className?: string;
  signed?: boolean;
}) {
  const prefs = useDisplayPreferencesOptional();
  const { data } = usePortfolio();
  const displayCurrency = prefs?.displayCurrency ?? "INR";
  const hidden = prefs?.hideBalances ?? false;
  const fxUsdInr = data?.meta.fx_usd_inr ?? null;

  if (hidden) {
    return (
      <span className={`font-mono numeric text-muted-dim ${className}`.trim()} aria-label="Balance hidden">
        ••••••
      </span>
    );
  }

  const useBookUsd = displayCurrency === "USD" && fxUsdInr != null && fxUsdInr > 0;
  const useNativeUsd = !useBookUsd && displayCurrency === "USD" && currency === "USD" && native != null;
  const text = useBookUsd
    ? formatBookAmount(inr, { displayCurrency: "USD", fxUsdInr, signed })
    : useNativeUsd
      ? signed && inr !== 0
        ? `${inr > 0 ? "+" : ""}${formatUsd(native ?? 0)}`
        : formatUsd(native ?? 0)
      : formatBookAmount(inr, { displayCurrency: "INR", signed });

  return <span className={`font-mono numeric ${className}`.trim()}>{text}</span>;
}

/** For chart tooltips and other non-hook render props. */
export function formatMoneyDisplay(
  inr: number,
  opts: {
    hideBalances?: boolean;
    displayCurrency?: "INR" | "USD";
    fxUsdInr?: number | null;
    signed?: boolean;
  },
): string {
  if (opts.hideBalances) return "••••••";
  return formatBookAmount(inr, {
    displayCurrency: opts.displayCurrency ?? "INR",
    fxUsdInr: opts.fxUsdInr,
    signed: opts.signed,
  });
}
