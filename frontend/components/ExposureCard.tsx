"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatInr } from "@/lib/format";
import type { AllocationSlice } from "@/lib/types";

const COLORS = ["#6EA8FF", "#68D7C6", "#FF7D9A", "#FFCC66", "#8b7ab8", "#5a6b82", "#4a6fa5", "#7a869a"];

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

export function ExposureCard({
  by_asset_type,
  by_currency,
  by_country,
}: {
  by_asset_type: AllocationSlice[];
  by_currency: AllocationSlice[];
  by_country: AllocationSlice[];
}) {
  const [tab, setTab] = useState<Tab>("asset");

  const sorted = useMemo(() => {
    const src = slicesForTab(tab, by_asset_type, by_currency, by_country);
    return [...src].sort((a, b) => b.pct - a.pct);
  }, [tab, by_asset_type, by_currency, by_country]);

  const barRow = useMemo(() => {
    const row: Record<string, string | number> = { name: "Book" };
    sorted.slice(0, 8).forEach((s, i) => {
      row[`s${i}`] = s.pct;
    });
    if (sorted.length > 8) {
      const rest = sorted.slice(8).reduce((a, s) => a + s.pct, 0);
      row.s_other = rest;
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
      m[`s${i}`] = s.key;
    });
    if (sorted.length > 8) m.s_other = "Other";
    return m;
  }, [sorted]);

  const top = sorted[0];
  const insight =
    top && top.pct > 70 ? `Top sleeve is ${top.key} at ${top.pct.toFixed(1)}%, which dominates the book.` : null;

  const tabBtn = (id: Tab, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        tab === id ? "bg-ion/25 text-ion" : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <section className="rounded-xl border border-line bg-surface/60 p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg text-ink">Exposure</h3>
        <div className="flex gap-1 rounded-full border border-line bg-canvas/40 p-0.5">
          {tabBtn("asset", "Asset")}
          {tabBtn("country", "Country")}
          {tabBtn("currency", "Currency")}
        </div>
      </div>
      <p className="mt-1 text-xs text-muted">Active view · stacked allocation</p>
      <div className="mt-4 h-14">
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
              {keys.map((k, i) => (
                <Bar key={k} dataKey={k} stackId="one" fill={COLORS[i % COLORS.length]} radius={[0, 4, 4, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      {insight ? <p className="mt-3 text-xs text-ember/90">{insight}</p> : null}
      <ul className="mt-4 max-h-48 space-y-1.5 overflow-y-auto border-t border-line/60 pt-3 text-xs">
        {sorted.map((s) => (
          <li key={s.key} className="flex justify-between gap-2 font-mono text-muted">
            <span className="truncate text-ink/90">{s.key}</span>
            <span>
              <span className="text-ink">{s.pct.toFixed(1)}%</span>
              <span className="ml-2 text-mintglass/90">{formatInr(s.value)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
