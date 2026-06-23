"use client";

import {
  Area,
  AreaChart,
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

import { formatInr } from "@/lib/format";
import { CHART_LADDER, CHART_STACK_COLORS } from "@/lib/chartColors";
import type { HistoryPoint, NormalizedHolding, PortfolioAlerts, PortfolioMeta } from "@/lib/types";

function bookInr(h: NormalizedHolding): number {
  const v = h.inr_market_value;
  if (v != null && v > 0) return v;
  return h.market_value;
}

function drawdownSeries(history: HistoryPoint[]): { date: string; dd: number; value: number }[] {
  if (history.length === 0) return [];
  let peak = history[0].inr_market_value;
  return history.map((h) => {
    const v = h.inr_market_value;
    if (v > peak) peak = v;
    const dd = peak > 0 ? ((v - peak) / peak) * 100 : 0;
    return { date: h.snapshot_date, dd, value: v };
  });
}

function navVarianceTooLow(values: number[]): boolean {
  if (values.length < 3) return true;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean <= 0) return true;
  const rel = (max - min) / mean;
  return rel < 0.0018;
}

function drawdownSwingTooLow(dds: number[]): boolean {
  if (dds.length < 3) return true;
  const min = Math.min(...dds);
  const max = Math.max(...dds);
  return max - min < 0.05;
}

function fmtSnap(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

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
  const wealth = history.map((h) => ({ date: h.snapshot_date, value: h.inr_market_value }));
  const ddData = drawdownSeries(history);

  const ladder = [...holdings]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 14)
    .map((h) => ({
      id: h.id,
      fullName: h.name,
      w: h.weight,
      over: h.weight >= thresholdPct,
      inr: bookInr(h),
    }));

  const ladderYAxisWidth = ladder.length
    ? Math.min(200, Math.max(104, Math.round(Math.max(...ladder.map((r) => r.fullName.length))) * 5.4))
    : 100;

  const maxLadderW = ladder.length ? Math.max(...ladder.map((r) => r.w), thresholdPct) : thresholdPct;
  const ladderXMax = Math.max(thresholdPct + 5, maxLadderW + 5, 100);

  const wealthVals = wealth.map((w) => w.value);
  const wealthFlat = navVarianceTooLow(wealthVals);
  const ddFlat = drawdownSwingTooLow(ddData.map((d) => d.dd));
  const emptyHistory = wealth.length < 3 || wealthFlat;
  const snapHint = meta.last_snapshot_at ? `Last snapshot: ${fmtSnap(meta.last_snapshot_at)}.` : "";
  const viewHint =
    meta.history_matches_view === false
      ? "History for this view builds once this view stays active across daily snapshots."
      : "";

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-xl border border-line bg-surface/60 p-4 shadow-card">
        <h3 className="font-display text-lg text-ink">Wealth (INR)</h3>
        <p className="mt-1 text-xs text-muted">Active view · snapshot NAV</p>
        <div className={`mt-3 ${emptyHistory ? "min-h-0 py-2" : "h-52"}`}>
          {emptyHistory ? (
            <div className="text-sm text-muted">
              <p>
                {wealth.length < 3
                  ? "We need at least three daily snapshots in this view before the wealth line is meaningful."
                  : "NAV moves between snapshots are tiny versus book size—the line would read as flat noise. Check back after more divergence."}
              </p>
              {snapHint ? <p className="mt-2 text-xs text-muted/90">{snapHint}</p> : null}
              {viewHint ? <p className="mt-2 text-xs text-ember/80">{viewHint}</p> : null}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={wealth} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2233" opacity={0.5} />
                <XAxis dataKey="date" tick={{ fill: "#7a869a", fontSize: 10 }} label={{ value: "Date", fill: "#7a869a", fontSize: 10 }} />
                <YAxis
                  tick={{ fill: "#7a869a", fontSize: 10 }}
                  tickFormatter={(v) => `${(v / 1e5).toFixed(1)}L`}
                  label={{ value: "INR", angle: -90, position: "insideLeft", fill: "#7a869a", fontSize: 10 }}
                />
                <Tooltip
                  formatter={(v: number) => [formatInr(v), "INR"]}
                  contentStyle={{ background: "#0B1220", border: "1px solid #151b28", borderRadius: 8, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="value" stroke="#6EA8FF" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface/60 p-4 shadow-card">
        <h3 className="font-display text-lg text-ink">Drawdown</h3>
        <p className="mt-1 text-xs text-muted">Peak-to-trough on snapshot NAV</p>
        <div className={`mt-3 ${ddData.length < 3 || ddFlat ? "min-h-0 py-2" : "h-52"}`}>
          {ddData.length < 3 || ddFlat ? (
            <div className="text-sm text-muted">
              <p>
                {ddData.length < 3
                  ? "Drawdown needs at least three snapshots so peak-to-trough is not a flat line."
                  : "Drawdown range is smaller than snapshot noise—chart hidden until swings are larger."}
              </p>
              {snapHint ? <p className="mt-2 text-xs text-muted/90">{snapHint}</p> : null}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ddData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2233" opacity={0.5} />
                <XAxis dataKey="date" tick={{ fill: "#7a869a", fontSize: 10 }} />
                <YAxis tick={{ fill: "#7a869a", fontSize: 10 }} unit="%" label={{ value: "%", fill: "#7a869a", fontSize: 10 }} />
                <Tooltip
                  formatter={(v: number) => [`${v.toFixed(2)}%`, "Drawdown"]}
                  contentStyle={{ background: "#0B1220", border: "1px solid #151b28", borderRadius: 8, fontSize: 12 }}
                />
                <ReferenceLine y={0} stroke="#3d4f6a" />
                <Area type="monotone" dataKey="dd" stroke="#FF7D9A" fill="#FF7D9A" fillOpacity={0.25} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface/60 p-4 shadow-card">
        <h3 className="font-display text-lg text-ink">Concentration ladder</h3>
        <p className="mt-1 text-xs text-muted">Weight % vs {thresholdPct}% guardrail</p>
        <div className="mt-3 h-52">
          {ladder.length === 0 ? (
            <p className="text-sm text-muted">No holdings.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={ladder} margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2233" opacity={0.4} />
                <XAxis type="number" domain={[0, ladderXMax]} tick={{ fill: "#7a869a", fontSize: 10 }} unit="%" />
                <YAxis
                  type="category"
                  dataKey="fullName"
                  width={ladderYAxisWidth}
                  interval={0}
                  tick={(props: { x?: number; y?: number; payload?: { value?: string } }) => {
                    const x = props.x ?? 0;
                    const y = props.y ?? 0;
                    const raw = props.payload?.value ?? "";
                    const t = raw.length > 28 ? `${raw.slice(0, 26)}…` : raw;
                    return (
                      <text x={x - 4} y={y} dy="0.33em" textAnchor="end" fill="#9aa7b8" fontSize={8.5}>
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
                      <div className="rounded-md border border-line bg-[#0B1220] px-3 py-2 text-xs text-ink shadow-lg">
                        <p className="font-medium text-ink">{d.fullName}</p>
                        <p className="mt-1 text-muted">
                          Weight <span className="font-mono text-ink">{d.w.toFixed(1)}%</span>
                        </p>
                        <p className="text-muted">
                          Value <span className="font-mono text-mintglass/90">{formatInr(d.inr)}</span>
                        </p>
                        <p className="text-muted">
                          Target <span className="font-mono text-ink">{tgt.toFixed(1)}%</span>
                        </p>
                        <p className="text-muted">
                          Trim (indicative) <span className="font-mono text-ember/90">{formatInr(trim)}</span>
                        </p>
                        {dilute != null && dilute > 0 ? (
                          <p className="text-muted">
                            Dilute (indicative) <span className="font-mono text-ion/90">{formatInr(dilute)}</span>
                          </p>
                        ) : null}
                      </div>
                    );
                  }}
                />
                <ReferenceLine
                  x={thresholdPct}
                  stroke="#FFCC66"
                  strokeDasharray="4 4"
                  label={{ value: `${thresholdPct}% guard`, fill: "#c9a85a", fontSize: 10, position: "insideTopRight" }}
                />
                <Bar
                  dataKey="w"
                  radius={[0, 4, 4, 0]}
                  onClick={(_data, index) => {
                    const row = ladder[index as number];
                    if (row) onSelectHolding(row.id);
                  }}
                >
                  {ladder.map((e, i) => (
                    <Cell
                      key={e.id}
                      fill={
                        e.id === highlightHoldingId
                          ? CHART_LADDER.highlight
                          : e.over
                            ? CHART_LADDER.over
                            : CHART_STACK_COLORS[i % CHART_STACK_COLORS.length]
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
    </section>
  );
}
