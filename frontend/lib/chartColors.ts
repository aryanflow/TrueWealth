import { sleeveColor } from "@/lib/assetLabels";

/** Shared Recharts / UI palette: Map exposure stack + Decide ladder. */
export const CHART_STACK_COLORS = [
  "#86A6FF",
  "#6FE0B0",
  "#F0817E",
  "#E9C46A",
  "#B79CF0",
  "#5AB6C7",
  "#6B7080",
  "#A6ABB8",
] as const;

export const CHART_LADDER = {
  default: "#6FE0B0",
  over: "#F0817E",
  highlight: "#86A6FF",
  guard: "#C9A24B",
} as const;

export function colorForSliceKey(key: string, index: number): string {
  return sleeveColor(key, index);
}
