"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { holdingDisambiguator } from "@/lib/assetLabels";
import { colorForSliceKey, CHART_LADDER } from "@/lib/chartColors";
import { drawdownChartReady, drawdownSeries, wealthChartReady } from "@/lib/chartGuards";
import { formatChartDate, formatInr, formatPct1 } from "@/lib/format";
import { filterHistoryByRange, type HistoryRange } from "@/lib/historyRange";
import type { HistoryPoint, NormalizedHolding, PortfolioAlerts, PortfolioMeta } from "@/lib/types";

const RANGES: HistoryRange[] = ["1W", "1M", "3M", "1Y", "ALL"];

function bookInr(h: NormalizedHolding): number {
  const v = h.inr_market_value;
  if (v != null && v > 0) return v;
  return h.market_value;
}

const AXIS = { fill: "#A6ABB8", fontSize: 10, fontFamily: "var(--font-mono)" };
const GRID = "#23262F";

export function DecisionCharts({
  history,
  holdings,
  thresholdPct,
  meta,
  totalInrActive,
  highlightHoldingId,
  onSelectHolding,
  alerts,
}: {
  history: HistoryPoint[];
  holdings: NormalizedHolding[];
  thresholdPct: number;
  meta: PortfolioMeta;
  totalInrActive: number;
  highlightHoldingId: string | null;
  onSelectHolding: (id: string) => void;
  alerts?: PortfolioAlerts | null;
}) {
  const [range, setRange] = useState<HistoryRange>("ALL");
  const scopedHistory = useMemo(() => filterHistoryByRange(history, range), [history, range]);

  const wealth = scopedHistory.map((h) => ({
    date: formatChartDate(h.snapshot_date),
    rawDate: h.snapshot_date,
    value: h.inr_market_value,
  }));
  const ddData = drawdownSeries(scopedHistory).map((d) => ({
    ...d,
    date: formatChartDate(d.date),
  }));

  const ladder = [...holdings]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10)
    .map((h, i) => ({
      id: h.id,
      fullName: holdingDisambiguator(h),
      shortName:
        holdingDisambiguator(h).length > 40
          ? `${holdingDisambiguator(h).slice(0, 38)}…`
          : holdingDisambiguator(h),
      w: h.weight,
      over: h.weight >= thresholdPct,
      inr: bookInr(h),
      fill: colorForSliceKey(h.asset_type, i),
    }));

  const ladderYAxisWidth = ladder.length
    ? Math.min(240, Math.max(140, Math.round(Math.max(...ladder.map((r) => r.fullName.length)) * 6.2)))
    : 140;

  const maxLadderW = ladder.length ? Math.max(...ladder.map((r) => r.w), thresholdPct) : thresholdPct;
  const ladderXMax = Math.max(thresholdPct + 6, maxLadderW + 4, 20);

  const snapHint = meta.last_snapshot_at
    ? `Last daily value: ${formatChartDate(meta.last_snapshot_at)}.`
    : "Daily values build once per sync — check back tomorrow.";
  const viewHint =
    meta.history_matches_view === false
      ? "History for this view builds once it stays active across daily snapshots."
      : "";

  const sparseWealth = wealth.length < 3;
  const wealthReady = wealthChartReady(scopedHistory);
  const ddReady = drawdownChartReady(scopedHistory);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs text-muted-dim">Chart window</p>
        <div className="inline-flex rounded-lg border border-line bg-ink-bg p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`min-h-9 rounded-md px-3 py-1 font-mono text-[11px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peri/60 ${
                range === r ? "bg-panel2 text-brass-soft" : "text-muted-dim hover:text-ink"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
      <div className="panel-card">
        <h3 className="font-display text-lg font-semibold text-ink">Wealth (INR)</h3>
        <p className="mt-1 font-mono text-xs text-muted-dim">active view · daily value</p>
        <div className={`mt-4 ${!wealthReady.ok && wealth.length === 0 ? "min-h-0" : "h-56"}`}>
          {!wealthReady.ok && wealth.length === 0 ? (
            <p className="text-sm text-muted">{wealthReady.message}</p>
          ) : !wealthReady.ok ? (
            <p className="text-sm text-muted">{wealthReady.message}</p>
          ) : (
            <>
              {sparseWealth ? (
                <p className="mb-3 text-xs text-muted">
                  Showing {wealth.length} snapshot{wealth.length === 1 ? "" : "s"} honestly — more days will sharpen the
                  trend.
                </p>
              ) : null}
              <ResponsiveContainer width="100%" height={sparseWealth ? "85%" : "100%"}>
                <LineChart data={wealth} margin={{ top: 12, right: 12, left: 8, bottom: 28 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} opacity={0.45} />
                  <XAxis
                    dataKey="date"
                    tick={AXIS}
                    tickMargin={8}
                    interval="preserveStartEnd"
                    axisLine={{ stroke: GRID }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={AXIS}
                    tickMargin={4}
                    width={48}
                    tickFormatter={(v) => `${(v / 1e5).toFixed(1)}L`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(v: number) => [formatInr(v), "INR"]}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as (typeof wealth)[0] | undefined;
                      return row ? formatChartDate(row.rawDate) : "";
                    }}
                    contentStyle={{
                      background: "#13151D",
                      border: "1px solid #23262F",
                      borderRadius: 8,
                      fontSize: 12,
                      fontFamily: "var(--font-mono)",
                    }}
                  />
                  <Line
                    type="linear"
                    dataKey="value"
                    stroke="#6FE0B0"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#0A0B0F", stroke: "#6FE0B0", strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
              {viewHint ? <p className="mt-2 text-xs text-ember">{viewHint}</p> : null}
              {!sparseWealth && snapHint ? <p className="mt-1 text-[11px] text-muted-dim">{snapHint}</p> : null}
            </>
          )}
        </div>
      </div>

      <div className="panel-card">
        <h3 className="font-display text-lg font-semibold text-ink">Drawdown</h3>
        <p className="mt-1 font-mono text-xs text-muted-dim">peak-to-trough on daily value</p>
        <div className={`mt-4 ${!ddReady.ok ? "min-h-0" : "h-56"}`}>
          {!ddReady.ok ? (
            <p className="text-sm leading-relaxed text-muted">{ddReady.message}</p>
          ) : (
            <>
              {ddData.length < 5 ? (
                <p className="mb-3 text-xs text-muted">
                  {ddData.length} daily value{ddData.length === 1 ? "" : "s"} — chart appears once peak-to-trough is
                  reliable.
                </p>
              ) : null}
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ddData} margin={{ top: 16, right: 16, left: 8, bottom: 28 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} opacity={0.45} />
                  <XAxis dataKey="date" tick={AXIS} tickMargin={8} axisLine={{ stroke: GRID }} tickLine={false} />
                  <YAxis
                    tick={AXIS}
                    tickMargin={4}
                    width={44}
                    tickFormatter={(v) => `${v.toFixed(1)}%`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(v: number) => [`${v.toFixed(2)}%`, "Drawdown"]}
                    contentStyle={{
                      background: "#13151D",
                      border: "1px solid #23262F",
                      borderRadius: 8,
                      fontSize: 12,
                      fontFamily: "var(--font-mono)",
                    }}
                  />
                  <ReferenceLine y={0} stroke="#2C3039" strokeDasharray="4 4" />
                  <Line
                    type="linear"
                    dataKey="dd"
                    stroke="#F0817E"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#0A0B0F", stroke: "#F0817E", strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      </div>

      <div className="panel-card lg:col-span-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="font-display text-lg font-semibold text-ink">Concentration ladder</h3>
            <p className="mt-1 font-mono text-xs text-muted-dim">
              top positions · weight % vs {formatPct1(thresholdPct)} guardrail
            </p>
          </div>
          <span className="font-mono text-[10px] text-brass">
            <span className="mr-1.5 inline-block h-3 w-0 border-l-2 border-dashed border-brass align-middle" />
            {thresholdPct}% guard
          </span>
        </div>
        <div className="mt-4 min-h-[14rem]">
          {ladder.length === 0 ? (
            <p className="text-sm text-muted">No holdings in this view to rank.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, ladder.length * 36)}>
              <BarChart layout="vertical" data={ladder} margin={{ top: 8, right: 28, left: 4, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} opacity={0.35} horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, ladderXMax]}
                  tick={AXIS}
                  tickFormatter={(v) => `${v}%`}
                  axisLine={{ stroke: GRID }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="shortName"
                  width={ladderYAxisWidth}
                  interval={0}
                  tick={(props: { x?: number; y?: number; payload?: { value?: string }; index?: number }) => {
                    const x = props.x ?? 0;
                    const y = props.y ?? 0;
                    const idx = props.index ?? 0;
                    const raw = ladder[idx]?.fullName ?? props.payload?.value ?? "";
                    const t = props.payload?.value ?? raw;
                    return (
                      <text x={x - 6} y={y} dy="0.33em" textAnchor="end" fill="#A6ABB8" fontSize={10}>
                        <title>{raw}</title>
                        {t}
                      </text>
                    );
                  }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as (typeof ladder)[0];
                    const tgt = thresholdPct;
                    const trim = Math.max(0, d.inr - (tgt / 100) * totalInrActive);
                    const concRow = alerts?.concentration?.find((c) => c.holding_id === d.id);
                    const dilute = concRow?.suggested_dilute_inr;
                    return (
                      <div className="max-w-xs rounded-md border border-line bg-panel px-3 py-2 text-xs text-ink shadow-lg">
                        <p className="font-medium leading-snug">{d.fullName}</p>
                        <p className="mt-1 font-mono text-muted">
                          Weight <span className="text-ink">{formatPct1(d.w)}</span>
                        </p>
                        <p className="font-mono text-muted">
                          Value <span className="text-mint">{formatInr(d.inr)}</span>
                        </p>
                        <p className="font-mono text-muted">
                          Target <span className="text-ink">{formatPct1(tgt)}</span>
                        </p>
                        <p className="font-mono text-muted">
                          Trim (indicative) <span className="text-ember">{formatInr(trim)}</span>
                        </p>
                        {dilute != null && dilute > 0 ? (
                          <p className="font-mono text-muted">
                            Dilute (indicative) <span className="text-peri">{formatInr(dilute)}</span>
                          </p>
                        ) : null}
                        {d.over ? (
                          <p className="mt-2 border-t border-line pt-2">
                            <a
                              href={`/map?holding=${encodeURIComponent(d.id)}&holdings=1#map-holdings`}
                              className="link-action text-[11px]"
                            >
                              Open on Map →
                            </a>
                          </p>
                        ) : null}
                      </div>
                    );
                  }}
                />
                <ReferenceLine
                  x={thresholdPct}
                  stroke={CHART_LADDER.guard}
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  ifOverflow="extendDomain"
                />
                <Bar
                  dataKey="w"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={14}
                  onClick={(_data, index) => {
                    const row = ladder[index as number];
                    if (row) onSelectHolding(row.id);
                  }}
                >
                  {ladder.map((e) => (
                    <Cell
                      key={e.id}
                      fill={
                        e.id === highlightHoldingId
                          ? CHART_LADDER.highlight
                          : e.over
                            ? CHART_LADDER.over
                            : e.fill
                      }
                      className="cursor-pointer"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      </div>
    </section>
  );
}
