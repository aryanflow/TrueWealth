import type { NormalizedHolding } from "@/lib/types";

export type SleeveId =
  | "indian_equity"
  | "us_equity"
  | "crypto"
  | "mutual_funds"
  | "fixed_deposits"
  | "retirement";

/** Map exposure slice key → sleeve id (best effort). */
export function sleeveIdFromAssetKey(key: string): SleeveId | null {
  const k = key.toUpperCase();
  if (k === "MF") return "mutual_funds";
  if (k === "CRYPTO") return "crypto";
  if (k === "US_STOCK") return "us_equity";
  if (k === "FD" || k === "RD") return "fixed_deposits";
  if (k === "EPF" || k === "NPS" || k === "PPF") return "retirement";
  if (k === "IN_STOCK" || k === "ETF") return "indian_equity";
  return null;
}

export function classifySleeve(h: NormalizedHolding): SleeveId | null {
  const t = h.asset_type;
  if (t === "CRYPTO") return "crypto";
  if (t === "MF") return "mutual_funds";
  if (t === "IN_STOCK") return "indian_equity";
  if (t === "US_STOCK") return "us_equity";
  if (t === "ETF") return h.country === "US" ? "us_equity" : "indian_equity";
  if (t === "FD" || t === "RD") return "fixed_deposits";
  if (t === "EPF" || t === "NPS" || t === "PPF") return "retirement";
  return null;
}

export function filterHoldingsBySleeve(holdings: NormalizedHolding[], sleeve: SleeveId): NormalizedHolding[] {
  return holdings.filter((h) => h.book_include !== false && classifySleeve(h) === sleeve);
}

/** Deep link: scroll exposure, highlight slice, optionally open filtered holdings. */
export function mapSleeveHref(sleeve: SleeveId, assetKey: string, openHoldings = true): string {
  const params = new URLSearchParams({
    focus: "asset",
    key: assetKey,
    sleeve,
  });
  if (openHoldings) params.set("holdings", "1");
  return `/map?${params.toString()}#map-holdings`;
}
