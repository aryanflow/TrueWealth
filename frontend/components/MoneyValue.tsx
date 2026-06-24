"use client";

import { useDisplayPreferencesOptional } from "@/components/DisplayPreferences";
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
  const displayCurrency = prefs?.displayCurrency ?? "INR";
  const useUsd = displayCurrency === "USD" && currency === "USD" && native != null;
  const raw = useUsd ? formatUsd(native) : formatInr(inr);
  const text =
    signed && inr !== 0 ? `${inr > 0 ? "+" : ""}${useUsd ? formatUsd(native ?? 0) : formatInr(inr)}` : raw;
  return <span className={`blur-balance font-mono numeric ${className}`.trim()}>{text}</span>;
}
