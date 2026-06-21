"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
} from "recharts";

import { insightAssetTypes, insightCountry, insightCurrency } from "@/lib/allocationInsights";
import type { AllocationSlice } from "@/lib/types";

const COLORS = ["#6EA8FF", "#68D7C6", "#FF7D9A", "#FFCC66", "#8b7ab8", "#5a6b82"];

function MiniPie({ title, data, insight }: { title: string; data: AllocationSlice[]; insight: string }) {
  const chartData = data.map((d) => ({ name: d.key, value: d.pct }));
  return (
    <div className="rounded-xl border border-line bg-surface/60 p-4 shadow-card">
      <h3 className="font-display text-lg text-ink">{title}</h3>
      <div className="mt-2 h-48">
        {chartData.length === 0 ? (
          <p className="text-sm text-muted">No positions yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie dataKey="value" data={chartData} innerRadius={52} outerRadius={72} paddingAngle={2}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />
                ))}
              </Pie>
              <RTooltip
                contentStyle={{
                  background: "#0B1220",
                  border: "1px solid #151b28",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="mt-3 border-t border-line/60 pt-3 text-xs leading-relaxed text-muted">{insight}</p>
      <ul className="mt-2 space-y-1 text-xs text-muted/90">
        {data.slice(0, 6).map((s) => (
          <li key={s.key} className="flex justify-between gap-2">
            <span className="truncate">{s.key}</span>
            <span className="font-mono numeric text-ink/90">{s.pct.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AllocationCharts({
  by_asset_type,
  by_currency,
  by_country,
}: {
  by_asset_type: AllocationSlice[];
  by_currency: AllocationSlice[];
  by_country: AllocationSlice[];
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <MiniPie title="By asset type" data={by_asset_type} insight={insightAssetTypes(by_asset_type)} />
      <MiniPie title="By currency" data={by_currency} insight={insightCurrency(by_currency)} />
      <MiniPie title="By country" data={by_country} insight={insightCountry(by_country)} />
    </section>
  );
}
