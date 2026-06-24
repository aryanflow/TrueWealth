import type { SleeveId } from "@/lib/sleeves";

export function mapExposureHref(tab: "asset" | "country" | "currency", sliceKey: string): string {
  return `/map?focus=${encodeURIComponent(tab)}&key=${encodeURIComponent(sliceKey)}#map-exposure`;
}

export function mapSleeveHoldingsHref(sleeve: SleeveId, assetKey: string): string {
  const params = new URLSearchParams({
    focus: "asset",
    key: assetKey,
    sleeve,
    holdings: "1",
  });
  return `/map?${params.toString()}#map-holdings`;
}
