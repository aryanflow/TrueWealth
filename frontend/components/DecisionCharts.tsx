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
import type { HistoryPoint, NormalizedHolding, PortfolioMeta } from "@/lib/types";

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
}: {
  history: HistoryPoint[];
  holdings: NormalizedHolding[];
  thresholdPct: number;
  meta: PortfolioMeta;
  totalInrActive: number;
  highlightHoldingId: string | null;
  onSelectHolding: (id: string) => void;
}) {
  const wealth = history.map((h) => ({ date: h.snapshot_date, value: h.inr_market_value }));
  const ddData = drawdownSeries(history);

  const ladder = [...holdings]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 14)
    .map((h) => ({
      id: h.id,
      name: h.name.length > 22 ? `${h.name.slice(0, 20)}…` : h.name,
      fullName: h.name,
      w: h.weight,
      over: h.weight >= thresholdPct,
      inr: bookInr(h),
    }));

  const emptyHistory = wealth.length < 2;
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
        <div className="mt-3 h-52">
          {emptyHistory ? (
            <div className="text-sm text-muted">
              <p>Keep True Wealth running for about 48 hours to build snapshot history.</p>
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
        <div className="mt-3 h-52">
          {ddData.length < 2 ? (
            <div className="text-sm text-muted">
              <p>Not enough history for a drawdown curve yet.</p>
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
                <XAxis type="number" domain={[0, "auto"]} tick={{ fill: "#7a869a", fontSize: 10 }} unit="%" />
                <YAxis type="category" dataKey="name" width={100} tick={{ fill: "#9aa7b8", fontSize: 9 }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as (typeof ladder)[0];
                    const tgt = thresholdPct;
                    const trim = Math.max(0, d.inr - (tgt / 100) * totalInrActive);
                    return (
                      <div className="rounded-md border border-line bg-[#0B1220] px-3 py-2 text-xs text-ink shadow-lg">
                        <p className="font-medium text-ink">{d.fullName}</p>
                        <p className="mt-1 text-muted">
                          Weight <span className="font-mono text-ink">{d.w.toFixed(2)}%</span>
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
                      </div>
                    );
                  }}
                />
                <ReferenceLine x={thresholdPct} stroke="#FFCC66" strokeDasharray="4 4" />
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
                      fill={e.id === highlightHoldingId ? "#6EA8FF" : e.over ? "#c45a6b" : "#68D7C6"}
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
