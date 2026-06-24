"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatInr } from "@/lib/format";
import { colorForSliceKey } from "@/lib/chartColors";
import { labelSlice } from "@/lib/assetLabels";
import type { AllocationSlice } from "@/lib/types";

type Tab = "asset" | "country" | "currency";

function slicesForTab(
  tab: Tab,
  by_asset_type: AllocationSlice[],
  by_currency: AllocationSlice[],
  by_country: AllocationSlice[],
): AllocationSlice[] {
  if (tab === "asset") return by_asset_type;
  if (tab === "country") return by_country;
  return by_currency;
}

function normalizeTab(t: string | null | undefined): Tab {
  if (t === "country" || t === "currency") return t;
  return "asset";
}

export function ExposureCard({
  by_asset_type,
  by_currency,
  by_country,
  initialTab,
  highlightKey,
}: {
  by_asset_type: AllocationSlice[];
  by_currency: AllocationSlice[];
  by_country: AllocationSlice[];
  /** From Map URL `?focus=asset|country|currency` */
  initialTab?: string | null;
  /** From Map URL `?key=…` (encoded slice key) */
  highlightKey?: string | null;
}) {
  const [tab, setTab] = useState<Tab>(() => normalizeTab(initialTab ?? undefined));

  useEffect(() => {
    if (initialTab != null && initialTab !== "") setTab(normalizeTab(initialTab));
  }, [initialTab]);

  const meaningfulSlices = (slices: AllocationSlice[]) => slices.filter((s) => s.pct > 0.02 || s.value > 1);
  const countrySingle = meaningfulSlices(by_country).length <= 1;
  const currencySingle = meaningfulSlices(by_currency).length <= 1;

  useEffect(() => {
    if (tab === "country" && countrySingle) setTab("asset");
    if (tab === "currency" && currencySingle) setTab("asset");
  }, [tab, countrySingle, currencySingle]);

  const sorted = useMemo(() => {
    const src = slicesForTab(tab, by_asset_type, by_currency, by_country);
    return [...src].sort((a, b) => b.pct - a.pct);
  }, [tab, by_asset_type, by_currency, by_country]);

  const decodedHighlight = useMemo(() => {
    if (highlightKey == null || highlightKey === "") return null;
    try {
      return decodeURIComponent(highlightKey);
    } catch {
      return highlightKey;
    }
  }, [highlightKey]);

  const barRow = useMemo(() => {
    const row: Record<string, string | number> = { name: "Book" };
    const slice = sorted.slice(0, 8);
    const rest = sorted.length > 8 ? sorted.slice(8).reduce((a, s) => a + s.pct, 0) : 0;
    const parts = [...slice.map((s) => s.pct), ...(sorted.length > 8 ? [rest] : [])];
    const sum = parts.reduce((a, b) => a + b, 0) || 1;
    const scale = sum > 100.5 ? 100 / sum : 1;
    slice.forEach((s, i) => {
      row[`s${i}`] = Math.round(s.pct * scale * 1000) / 1000;
    });
    if (sorted.length > 8) {
      row.s_other = Math.round(rest * scale * 1000) / 1000;
    }
    return [row];
  }, [sorted]);

  const keys = useMemo(() => {
    const k: string[] = [];
    sorted.slice(0, 8).forEach((_, i) => k.push(`s${i}`));
    if (sorted.length > 8) k.push("s_other");
    return k;
  }, [sorted]);

  const keyLabels = useMemo(() => {
    const m: Record<string, string> = {};
    sorted.slice(0, 8).forEach((s, i) => {
      m[`s${i}`] = labelSlice(s.key, tab);
    });
    if (sorted.length > 8) m.s_other = "Other";
    return m;
  }, [sorted, tab]);

  const top = sorted[0];
  const insight =
    top && top.pct > 70
      ? `Largest sleeve is ${labelSlice(top.key, tab)} at ${top.pct.toFixed(1)}%, which dominates the book.`
      : null;

  const tabBtn = (id: Tab, label: string, disabled: boolean, disabledReason: string) => (
    <button
      key={id}
      type="button"
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      onClick={() => !disabled && setTab(id)}
      className={`min-h-9 rounded-md px-4 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peri/60 ${
        disabled
          ? "cursor-not-allowed opacity-45 text-muted-dim"
          : tab === id
            ? "bg-panel2 text-brass-soft"
            : "text-muted-dim hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <section id="map-exposure" className="panel-card scroll-mt-28">
      {decodedHighlight ? (
        <p className="mb-3 rounded-lg border border-peri/25 bg-peri/10 px-3 py-2 text-xs text-ink">
          Showing: <span className="font-medium text-peri">{labelSlice(decodedHighlight, tab)}</span>
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg font-semibold text-ink">Exposure</h3>
        <div
          className="inline-flex gap-0.5 rounded-lg border border-line bg-ink-bg p-1"
          role="tablist"
          aria-label="Exposure breakdown"
        >
          {tabBtn("asset", "Asset", false, "")}
          {tabBtn(
            "country",
            "Country",
            countrySingle,
            countrySingle ? "Only one country bucket in this view." : "",
          )}
          {tabBtn(
            "currency",
            "Currency",
            currencySingle,
            currencySingle ? "Only one currency bucket in this view." : "",
          )}
        </div>
      </div>
      <p className="mt-1 font-mono text-xs text-muted-dim">Active view · stacked allocation</p>
      <div className="mt-4 h-24 min-h-[5.5rem]">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted">No positions in this view.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={barRow} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2233" opacity={0.35} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: "#7a869a", fontSize: 10 }} unit="%" />
              <YAxis type="category" dataKey="name" width={44} tick={{ fill: "#9aa7b8", fontSize: 10 }} />
              <Tooltip
                formatter={(v: number, name: string) => [`${Number(v).toFixed(1)}%`, keyLabels[name] ?? name]}
                contentStyle={{ background: "#0B1220", border: "1px solid #151b28", borderRadius: 8, fontSize: 12 }}
              />
              {keys.map((k, i) => {
                const origPct = sorted[i]?.pct ?? 0;
                const showLabel = origPct >= 8;
                const sliceKey = sorted[i]?.key ?? "";
                return (
                  <Bar key={k} dataKey={k} stackId="one" fill={colorForSliceKey(sliceKey, i)} radius={[0, 4, 4, 0]}>
                    {showLabel ? (
                      <LabelList
                        dataKey={k}
                        position="center"
                        content={(props) => {
                          const p = props as {
                            x?: string | number;
                            y?: string | number;
                            width?: string | number;
                            height?: string | number;
                          };
                          const x = Number(p.x ?? 0);
                          const y = Number(p.y ?? 0);
                          const width = Number(p.width ?? 0);
                          const height = Number(p.height ?? 0);
                          if (width < 20) return null;
                          return (
                            <text
                              x={x + width / 2}
                              y={y + height / 2}
                              dy="0.35em"
                              textAnchor="middle"
                              fill="#0B1220"
                              fontSize={9}
                              fontWeight={600}
                            >
                              {`${origPct.toFixed(0)}%`}
                            </text>
                          );
                        }}
                      />
                    ) : null}
                  </Bar>
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      {insight ? <p className="mt-3 text-xs text-ember">{insight}</p> : null}
      <ul className="mt-4 max-h-52 space-y-1 overflow-y-auto border-t border-line pt-3 text-xs">
        {sorted.map((s, i) => {
          const hi = decodedHighlight != null && decodedHighlight === s.key;
          return (
            <li
              key={s.key}
              className={`flex justify-between gap-2 rounded-lg px-2 py-1.5 font-mono transition-colors ${
                hi ? "border border-peri/40 bg-peri/10 text-ink ring-1 ring-peri/30" : "text-muted"
              }`}
            >
              <span className={`min-w-0 truncate ${hi ? "text-ink" : ""}`}>{labelSlice(s.key, tab)}</span>
              <span className="shrink-0">
                <span className="text-ink">{s.pct.toFixed(1)}%</span>
                <span className="ml-2 text-mint">{formatInr(s.value)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
