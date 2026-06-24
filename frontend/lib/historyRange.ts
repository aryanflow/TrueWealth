import type { HistoryPoint } from "@/lib/types";

export type HistoryRange = "1W" | "1M" | "3M" | "1Y" | "ALL";

const MS_DAY = 86_400_000;

export function filterHistoryByRange(history: HistoryPoint[], range: HistoryRange): HistoryPoint[] {
  if (range === "ALL" || history.length === 0) return history;
  const days = range === "1W" ? 7 : range === "1M" ? 31 : range === "3M" ? 93 : 366;
  const last = history[history.length - 1]?.snapshot_date;
  if (!last) return history;
  const end = new Date(last.includes("T") ? last : `${last}T23:59:59`).getTime();
  const start = end - days * MS_DAY;
  return history.filter((h) => {
    const t = new Date(h.snapshot_date.includes("T") ? h.snapshot_date : `${h.snapshot_date}T12:00:00`).getTime();
    return t >= start;
  });
}
