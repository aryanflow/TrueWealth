"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

type SortKey = "weight" | "market_value" | "name" | "book_inr" | "cost_native" | "pnl_inr" | "pnl_pct";

const VALID_SORT: SortKey[] = [
  "weight",
  "market_value",
  "name",
  "book_inr",
  "cost_native",
  "pnl_inr",
  "pnl_pct",
];

export function useHoldingsUrlSync(opts: {
  enabled: boolean;
  chip: string;
  sort: SortKey;
  q: string;
  onChip: (c: string) => void;
  onSort: (s: SortKey) => void;
  onQ: (q: string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hydrated = useRef(false);
  const { enabled, chip, sort, q, onChip, onSort, onQ } = opts;

  useEffect(() => {
    if (!enabled || hydrated.current) return;
    const chipParam = searchParams.get("chip");
    const sortParam = searchParams.get("sort") as SortKey | null;
    const qParam = searchParams.get("q");
    if (chipParam) onChip(chipParam);
    if (sortParam && VALID_SORT.includes(sortParam)) onSort(sortParam);
    if (qParam != null) onQ(qParam);
    hydrated.current = true;
  }, [enabled, searchParams, onChip, onSort, onQ]);

  const push = useCallback(
    (patch: { chip?: string; sort?: SortKey; q?: string }) => {
      if (!enabled) return;
      const p = new URLSearchParams(searchParams.toString());
      const nextChip = patch.chip ?? chip;
      const nextSort = patch.sort ?? sort;
      const nextQ = patch.q ?? q;
      if (nextChip && nextChip !== "ALL") p.set("chip", nextChip);
      else p.delete("chip");
      if (nextSort && nextSort !== "weight") p.set("sort", nextSort);
      else p.delete("sort");
      if (nextQ.trim()) p.set("q", nextQ.trim());
      else p.delete("q");
      const qs = p.toString();
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      router.replace(`${pathname}${qs ? `?${qs}` : ""}${hash}`, { scroll: false });
    },
    [enabled, chip, sort, q, pathname, router, searchParams],
  );

  return { push };
}
