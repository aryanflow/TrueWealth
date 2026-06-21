"use client";

import { useMemo, useState } from "react";

import { formatInr, formatValue } from "@/lib/format";
import type { NormalizedHolding } from "@/lib/types";

type SortKey = "weight" | "market_value" | "name";

const FILTERS: { id: string; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "IN_STOCK", label: "IN" },
  { id: "US_STOCK", label: "US" },
  { id: "ETF", label: "ETF" },
  { id: "MF", label: "MF" },
  { id: "CASH", label: "Cash" },
  { id: "OTHER", label: "Other" },
];

export function HoldingsTable({ holdings }: { holdings: NormalizedHolding[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("weight");
  const [chip, setChip] = useState("ALL");

  const filtered = useMemo(() => {
    let list = [...holdings];
    if (chip !== "ALL") {
      list = list.filter((h) => h.asset_type === chip);
    }
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (h) =>
          (h.symbol ?? "").toLowerCase().includes(needle) || h.name.toLowerCase().includes(needle),
      );
    }
    list.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      return (b[sort] as number) - (a[sort] as number);
    });
    return list;
  }, [holdings, q, sort, chip]);

  const summary = useMemo(() => {
    const mv = filtered.reduce((s, h) => s + h.market_value, 0);
    const dc = filtered.reduce((s, h) => s + (h.day_change_value ?? 0), 0);
    return { mv, dc };
  }, [filtered]);

  return (
    <section className="rounded-xl border border-line bg-surface/60 shadow-card">
      <div className="flex flex-col gap-3 border-b border-line p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-ink">Holdings</h2>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setChip(f.id)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide transition ${
                  chip === f.id
                    ? "border-ion/50 bg-ion/15 text-ion"
                    : "border-line text-muted hover:border-line hover:text-ink"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line/80 bg-canvas/40 px-3 py-2.5">
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted">Filtered value</span>
              <p className="font-mono text-base text-ink">{formatInr(summary.mv)}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted">Day change (sum)</span>
              <p className={`font-mono text-base ${summary.dc >= 0 ? "text-mintglass" : "text-rose"}`}>
                {formatInr(summary.dc)}
              </p>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted">Rows</span>
              <p className="font-mono text-base text-ink">{filtered.length}</p>
            </div>
          </div>
          <label className="flex w-full max-w-xs items-center gap-2 text-sm text-muted sm:w-72">
            <span className="sr-only">Search</span>
            <span className="rounded border border-line bg-surface px-2 py-1 font-mono text-[10px] text-ion">⌕</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Symbol or name…"
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-ion/35"
            />
          </label>
        </div>
      </div>
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur">
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="border-b border-line px-4 py-3">
                <button
                  type="button"
                  onClick={() => setSort("name")}
                  className={`hover:text-ink ${sort === "name" ? "text-ion" : ""}`}
                >
                  Name {sort === "name" ? "●" : ""}
                </button>
              </th>
              <th className="border-b border-line px-4 py-3">Type</th>
              <th className="border-b border-line px-4 py-3">Ccy</th>
              <th className="border-b border-line px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => setSort("weight")}
                  className={`w-full text-right hover:text-ink ${sort === "weight" ? "text-ion" : ""}`}
                >
                  Weight % {sort === "weight" ? "●" : ""}
                </button>
              </th>
              <th className="border-b border-line px-4 py-3 text-right font-mono numeric">Qty</th>
              <th className="border-b border-line px-4 py-3 text-right font-mono numeric">Last</th>
              <th className="border-b border-line px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => setSort("market_value")}
                  className={`w-full text-right hover:text-ink ${sort === "market_value" ? "text-ion" : ""}`}
                >
                  Value {sort === "market_value" ? "●" : ""}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted">
                  No rows match. Clear filters or widen your search.
                </td>
              </tr>
            ) : (
              filtered.map((h) => (
                <tr key={h.id} className="border-b border-line/80 transition hover:bg-canvas/40">
                  <td className="px-4 py-2">
                    <div className="font-medium text-ink">{h.name}</div>
                    <div className="font-mono text-xs text-muted">{h.symbol ?? "-"}</div>
                  </td>
                  <td className="px-4 py-2 text-muted">{h.asset_type}</td>
                  <td className="px-4 py-2 text-muted">{h.currency}</td>
                  <td className="px-4 py-2 text-right font-mono numeric text-ink">{h.weight.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-mono numeric text-ink">{h.quantity.toFixed(3)}</td>
                  <td className="px-4 py-2 text-right font-mono numeric text-muted">
                    {h.last_price == null ? "-" : formatValue(h.last_price, h.currency)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono numeric text-ink">
                    {formatValue(h.market_value, h.currency)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
