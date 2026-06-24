/** Human labels and sleeve hues — single source for spine, donut, and cards. */
export const SLEEVE_COLORS: Record<string, string> = {
  MF: "#86A6FF",
  FD: "#6FE0B0",
  RD: "#6FE0B0",
  EPF: "#E9C46A",
  NPS: "#E9C46A",
  PPF: "#E9C46A",
  IN_STOCK: "#F0817E",
  ETF: "#F0817E",
  CRYPTO: "#B79CF0",
  US_STOCK: "#5AB6C7",
  INR: "#6FE0B0",
  USD: "#5AB6C7",
  IN: "#F0817E",
  US: "#5AB6C7",
  Other: "#6B7080",
};

const ASSET_LABELS: Record<string, string> = {
  MF: "Mutual funds",
  FD: "Fixed deposits",
  RD: "Recurring deposits",
  EPF: "EPF & retirement",
  NPS: "NPS",
  PPF: "PPF",
  IN_STOCK: "Indian stocks",
  US_STOCK: "US stocks",
  ETF: "ETFs",
  CRYPTO: "Crypto",
};

const COUNTRY_LABELS: Record<string, string> = {
  IN: "India",
  US: "United States",
};

const CURRENCY_LABELS: Record<string, string> = {
  INR: "Indian rupee",
  USD: "US dollar",
};

export function sleeveColor(key: string, index = 0): string {
  if (SLEEVE_COLORS[key]) return SLEEVE_COLORS[key];
  const fallback = ["#86A6FF", "#6FE0B0", "#E9C46A", "#F0817E", "#B79CF0", "#5AB6C7"];
  return fallback[index % fallback.length];
}

export function labelSlice(key: string, kind: "asset" | "country" | "currency" = "asset"): string {
  if (kind === "country") return COUNTRY_LABELS[key] ?? key;
  if (kind === "currency") return CURRENCY_LABELS[key] ?? key;
  return ASSET_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function holdingDisambiguator(h: {
  name: string;
  asset_type: string;
  account_label?: string | null;
  broker?: string | null;
  isin?: string | null;
}): string {
  const parts: string[] = [];
  if (h.asset_type) parts.push(labelSlice(h.asset_type));
  if (h.account_label?.trim()) parts.push(h.account_label.trim());
  else if (h.broker?.trim()) parts.push(h.broker.trim());
  return parts.length ? `${h.name} (${parts.join(" · ")})` : h.name;
}
