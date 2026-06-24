"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { MoneyValue } from "@/components/MoneyValue";
import { holdingDisambiguator, labelSlice } from "@/lib/assetLabels";
import { downloadCsv, holdingsToCsv } from "@/lib/exportHoldings";
import { formatInr, formatValue } from "@/lib/format";
import type { NormalizedHolding } from "@/lib/types";

type SortKey = "weight" | "market_value" | "name" | "book_inr" | "cost_native" | "pnl_inr" | "pnl_pct";

const LS_SORT = "tw_holdings_sort";
const LS_CHIP = "tw_holdings_chip";

const FILTERS: { id: string; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "IN_STOCK", label: "IN" },
  { id: "US_STOCK", label: "US" },
  { id: "ETF", label: "ETF" },
  { id: "MF", label: "MF" },
  { id: "EPF", label: "EPF" },
  { id: "FD", label: "FD" },
  { id: "CRYPTO", label: "Crypto" },
  { id: "CASH", label: "Cash" },
  { id: "OTHER", label: "Other" },
];

function bookInr(h: NormalizedHolding): number {
  const v = h.inr_market_value;
  if (v != null && v > 0) return v;
  return h.market_value;
}

function costNative(h: NormalizedHolding): number | null {
  if (h.avg_cost == null) return null;
  return h.avg_cost * h.quantity;
}

function pnlInr(h: NormalizedHolding): number | null {
  return h.inr_unrealized_pnl ?? h.unrealized_pnl ?? null;
}

function pnlPct(h: NormalizedHolding): number | null {
  return h.return_total_inr_pct ?? null;
}

function sortValue(h: NormalizedHolding, key: SortKey): number | string {
  switch (key) {
    case "name":
      return h.name.toLowerCase();
    case "book_inr":
      return bookInr(h);
    case "cost_native": {
      const c = costNative(h);
      return c == null ? Number.NEGATIVE_INFINITY : c;
    }
    case "pnl_inr": {
      const p = pnlInr(h);
      return p == null ? Number.NEGATIVE_INFINITY : p;
    }
    case "pnl_pct": {
      const p = pnlPct(h);
      return p == null ? Number.NEGATIVE_INFINITY : p;
    }
    default:
      return h[key] as number;
  }
}

export function HoldingsTable({
  holdings,
  highlightHoldingId,
  onRowClick,
  columnPreset = "pro",
  columnPresetControl,
  exportFilename = "true-wealth-holdings",
  title = "Holdings",
  initialChip,
}: {
  holdings: NormalizedHolding[];
  highlightHoldingId?: string | null;
  onRowClick?: (h: NormalizedHolding) => void;
  columnPreset?: "simple" | "pro";
  columnPresetControl?: {
    value: "simple" | "pro";
    onChange: (v: "simple" | "pro") => void;
  };
  exportFilename?: string;
  title?: string;
  initialChip?: string;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("weight");
  const [chip, setChip] = useState(initialChip ?? "ALL");
  const [localPreset, setLocalPreset] = useState<"simple" | "pro">("pro");
  const preset = columnPresetControl?.value ?? columnPreset ?? localPreset;
  const setPreset = columnPresetControl?.onChange ?? setLocalPreset;

  useEffect(() => {
    try {
      const s = window.localStorage.getItem(LS_SORT) as SortKey | null;
      const c = window.localStorage.getItem(LS_CHIP);
      if (s) setSort(s);
      if (c && !initialChip) setChip(c);
    } catch {
      /* ignore */
    }
  }, [initialChip]);

  useEffect(() => {
    if (initialChip) setChip(initialChip);
  }, [initialChip]);

  const pickSort = (k: SortKey) => {
    setSort(k);
    try {
      window.localStorage.setItem(LS_SORT, k);
    } catch {
      /* ignore */
    }
  };

  const pickChip = (id: string) => {
    setChip(id);
    try {
      window.localStorage.setItem(LS_CHIP, id);
    } catch {
      /* ignore */
    }
  };

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
      const va = sortValue(a, sort) as number;
      const vb = sortValue(b, sort) as number;
      return vb - va;
    });
    return list;
  }, [holdings, q, sort, chip]);

  const summary = useMemo(() => {
    const mv = filtered.reduce((s, h) => s + bookInr(h), 0);
    const dc = filtered.reduce((s, h) => s + (h.inr_day_change_value ?? h.day_change_value ?? 0), 0);
    return { mv, dc };
  }, [filtered]);

  const pro = preset === "pro";
  const colCount = pro ? 12 : 5;

  const thSort = (k: SortKey, label: string) => (
    <th className="border-b border-line px-4 py-3 text-right">
      <button
        type="button"
        onClick={() => pickSort(k)}
        className={`w-full text-right transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peri/60 ${sort === k ? "text-peri" : ""}`}
      >
        {label} {sort === k ? "▼" : ""}
      </button>
    </th>
  );

  return (
    <section className="panel-card !p-0 overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => downloadCsv(`${exportFilename}.csv`, holdingsToCsv(filtered))}
              className="btn-ghost !min-h-9 !px-3 !py-1.5 !text-xs"
            >
              Export CSV
            </button>
            <div className="flex rounded-lg border border-line p-0.5 text-[11px]">
              <button
                type="button"
                className={`rounded-full px-2 py-1 ${preset === "simple" ? "bg-ion/15 text-ion" : "text-muted"}`}
                onClick={() => setPreset("simple")}
              >
                Simple
              </button>
              <button
                type="button"
                className={`rounded-full px-2 py-1 ${preset === "pro" ? "bg-ion/15 text-ion" : "text-muted"}`}
                onClick={() => setPreset("pro")}
              >
                Pro
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => pickChip(f.id)}
                className={`min-h-9 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peri/60 ${
                  chip === f.id
                    ? "border-peri/50 bg-peri/15 text-peri"
                    : "border-line text-muted hover:text-ink"
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
              <p className="text-base text-ink">
                <MoneyValue inr={summary.mv} className="text-base text-ink" />
              </p>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted">Day change (sum)</span>
              <p className={`text-base ${summary.dc >= 0 ? "text-mintglass" : "text-rose"}`}>
                <MoneyValue inr={summary.dc} signed className={summary.dc >= 0 ? "text-mintglass" : "text-rose"} />
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
      <div className="hidden max-h-[480px] overflow-auto md:block">
        <table className="w-full min-w-[960px] border-collapse text-sm md:min-w-[1040px]">
          <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur">
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="border-b border-line px-4 py-3">
                <button
                  type="button"
                  onClick={() => pickSort("name")}
                  className={`transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peri/60 ${sort === "name" ? "text-peri" : ""}`}
                >
                  Name {sort === "name" ? "▼" : ""}
                </button>
              </th>
              <th className="border-b border-line px-4 py-3">Type</th>
              <th className="border-b border-line px-4 py-3">Ccy</th>
              {thSort("book_inr", "Value (INR)")}
              {thSort("weight", "Weight %")}
              {pro ? thSort("cost_native", "Cost") : null}
              {pro ? thSort("pnl_inr", "P&L") : null}
              {pro ? thSort("pnl_pct", "P&L %") : null}
              {pro ? (
                <>
                  <th className="border-b border-line px-4 py-3 text-right font-mono numeric">Qty</th>
                  <th className="border-b border-line px-4 py-3 text-right font-mono numeric">Last</th>
                  {thSort("market_value", "Native MV")}
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-10 text-center text-muted">
                  No rows match. Clear filters or widen your search.
                </td>
              </tr>
            ) : (
              filtered.map((h) => {
                const cst = costNative(h);
                const pn = pnlInr(h);
                const pp = pnlPct(h);
                return (
                  <tr
                    key={h.id}
                    id={`holding-row-${h.id}`}
                    role={onRowClick ? "button" : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    onClick={() => onRowClick?.(h)}
                    onKeyDown={(e) => {
                      if (onRowClick && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        onRowClick(h);
                      }
                    }}
                    className={`border-b border-line/80 transition hover:bg-panel2/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-peri/50 ${
                      onRowClick ? "cursor-pointer" : ""
                    } ${highlightHoldingId === h.id ? "bg-peri/15 ring-1 ring-peri/40" : ""}`}
                  >
                    <td className="px-4 py-2">
                      <div className="font-medium text-ink" title={holdingDisambiguator(h)}>
                        {h.name}
                      </div>
                      <div className="font-mono text-xs text-muted-dim">{h.symbol ?? "—"} · {labelSlice(h.asset_type)}</div>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-dim">{labelSlice(h.asset_type)}</td>
                    <td className="px-4 py-2 font-mono text-muted-dim">{h.currency}</td>
                    <td className="px-4 py-2 text-right">
                      <MoneyValue inr={bookInr(h)} native={h.market_value} currency={h.currency} className="text-mint" />
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-ink">{h.weight.toFixed(2)}%</td>
                    {pro ? (
                      <>
                        <td className="px-4 py-2 text-right font-mono text-muted-dim">
                          {cst == null ? (
                            <Link
                              href={`/decide?holding=${encodeURIComponent(h.id)}#cost`}
                              onClick={(e) => e.stopPropagation()}
                              className="link-action text-[11px]"
                            >
                              Add basis
                            </Link>
                          ) : (
                            formatValue(cst, h.currency)
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-mono numeric text-ink">
                          {pn == null ? "—" : formatInr(pn)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono numeric text-muted">
                          {pp == null ? "—" : `${pp >= 0 ? "+" : ""}${pp.toFixed(2)}%`}
                        </td>
                        <td className="px-4 py-2 text-right font-mono numeric text-ink">{h.quantity.toFixed(3)}</td>
                        <td className="px-4 py-2 text-right font-mono numeric text-muted">
                          {h.last_price == null ? "-" : formatValue(h.last_price, h.currency)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono numeric text-ink">
                          {formatValue(h.market_value, h.currency)}
                        </td>
                      </>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-line md:hidden">
        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">No rows match. Clear filters or widen your search.</p>
        ) : (
          filtered.map((h) => {
            const cst = costNative(h);
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => onRowClick?.(h)}
                className={`flex w-full flex-col gap-2 px-4 py-4 text-left transition hover:bg-panel2/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-peri/50 ${
                  highlightHoldingId === h.id ? "bg-peri/15" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink" title={holdingDisambiguator(h)}>
                      {h.name}
                    </p>
                    <p className="font-mono text-xs text-muted-dim">
                      {h.symbol ?? "—"} · {labelSlice(h.asset_type)}
                    </p>
                  </div>
                  <MoneyValue inr={bookInr(h)} native={h.market_value} currency={h.currency} className="shrink-0 text-mint" />
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-dim">
                  <span>{h.weight.toFixed(2)}% weight</span>
                  {pro && cst == null ? (
                    <Link
                      href={`/decide?holding=${encodeURIComponent(h.id)}#cost`}
                      onClick={(e) => e.stopPropagation()}
                      className="link-action"
                    >
                      Add basis
                    </Link>
                  ) : null}
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
