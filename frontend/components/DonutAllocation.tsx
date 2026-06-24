"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { colorForSliceKey } from "@/lib/chartColors";
import { labelSlice } from "@/lib/assetLabels";
import { formatInr, formatPct1 } from "@/lib/format";
import type { AllocationSlice } from "@/lib/types";

export function DonutAllocation({
  slices,
  kind = "asset",
  focusKey,
  onFocus,
}: {
  slices: AllocationSlice[];
  kind?: "asset" | "country" | "currency";
  focusKey?: string | null;
  onFocus?: (key: string | null) => void;
}) {
  const data = [...slices]
    .filter((s) => s.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .map((s, i) => ({
      ...s,
      label: labelSlice(s.key, kind),
      fill: colorForSliceKey(s.key, i),
    }));

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted">
        No allocation in this view. Refresh holdings or widen the active view in Settings.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <div className="h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="pct"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={76}
              paddingAngle={2}
              stroke="transparent"
            >
              {data.map((e, i) => (
                <Cell
                  key={`${e.key}-${i}`}
                  fill={e.fill}
                  opacity={focusKey && focusKey !== e.key ? 0.35 : 1}
                  className={onFocus ? "cursor-pointer" : undefined}
                  onClick={() => onFocus?.(focusKey === e.key ? null : e.key)}
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as (typeof data)[0];
                return (
                  <div className="rounded-md border border-line bg-panel px-3 py-2 text-xs text-ink shadow-lg">
                    <p className="font-medium">{row.label}</p>
                    <p className="mt-1 font-mono text-muted">
                      <span className="text-ink">{formatPct1(row.pct)}</span>
                      <span className="mx-1.5">·</span>
                      <span className="text-mint">{formatInr(row.value)}</span>
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex w-full flex-1 flex-col gap-2" aria-label="Allocation legend">
        {data.map((s) => {
          const active = focusKey === s.key;
          const dim = focusKey != null && !active;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => onFocus?.(active ? null : s.key)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[12.5px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peri/60 ${
                  active ? "bg-brass/10 ring-1 ring-brass/40" : "hover:bg-white/[0.02]"
                } ${dim ? "opacity-40" : ""}`}
                aria-pressed={active}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.fill }} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-ink">{s.label}</span>
                <span className="shrink-0 font-mono text-muted">{formatPct1(s.pct)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
