"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { formatInr } from "@/lib/format";
import { CHART_STACK_COLORS } from "@/lib/chartColors";
import type { AllocationSlice } from "@/lib/types";

export function DonutAllocation({ slices }: { slices: AllocationSlice[] }) {
  const data = [...slices]
    .filter((s) => s.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 10)
    .map((s, i) => ({ ...s, fill: CHART_STACK_COLORS[i % CHART_STACK_COLORS.length] }));

  if (data.length === 0) {
    return <p className="text-sm text-muted">No allocation slices in this view.</p>;
  }

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="pct"
            nameKey="key"
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={76}
            paddingAngle={2}
          >
            {data.map((e, i) => (
              <Cell key={`${e.key}-${i}`} fill={e.fill} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as AllocationSlice;
              return (
                <div className="rounded-md border border-line bg-[#0B1220] px-3 py-2 text-xs text-ink shadow-lg">
                  <p className="font-medium text-ink">{row.key}</p>
                  <p className="mt-1 text-muted">
                    <span className="font-mono text-ink">{row.pct.toFixed(1)}%</span> ·{" "}
                    <span className="font-mono text-mintglass/90">{formatInr(row.value)}</span>
                  </p>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
