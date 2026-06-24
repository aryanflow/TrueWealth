"use client";

import { useMemo, useState } from "react";

import type { MfFundSummary } from "@/lib/types";

function fundHasMeta(f: MfFundSummary): boolean {
  return (
    f.data_status === "ok" ||
    Boolean(f.category?.trim()) ||
    Boolean(f.benchmark_name?.trim()) ||
    f.expense_ratio != null
  );
}

export function FundLabSection({
  funds,
  onAfterMfRefresh,
}: {
  funds: MfFundSummary[];
  onAfterMfRefresh?: () => void;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const withMeta = useMemo(() => funds.filter(fundHasMeta), [funds]);
  const allEmpty = funds.length > 0 && withMeta.length === 0;

  async function refreshMeta() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/mf/refresh", { method: "POST" });
      if (!r.ok) throw new Error(`Refresh failed (${r.status})`);
      const j = (await r.json()) as { refreshed?: number };
      setMsg(`Refreshed ${j.refreshed ?? 0} fund rows.`);
      onAfterMfRefresh?.();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  }

  if (!funds.length) return null;

  if (allEmpty) {
    return (
      <section className="panel-card">
        <h2 className="font-display text-xl font-semibold text-ink">Fund lab</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {funds.length} mutual fund position{funds.length === 1 ? "" : "s"} in this view, but scheme metadata
          (category, benchmark, TER) has not loaded yet.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void refreshMeta()}
          className="btn-primary mt-5"
        >
          {busy ? "Refreshing…" : "Refresh fund metadata"}
        </button>
        {msg ? <p className="mt-3 font-mono text-xs text-peri">{msg}</p> : null}
        <p className="mt-3 text-xs text-muted-dim">
          Pulls category, benchmark, and expense ratio from the data feed (cached ~24h).
        </p>
      </section>
    );
  }

  return (
    <section className="panel-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">Fund lab</h2>
          <p className="mt-1 text-xs text-muted-dim">Category, benchmark, TER from data feed (cached ~24h)</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void refreshMeta()}
          className="btn-ghost !min-h-9 !px-3 !text-xs"
        >
          {busy ? "Refreshing…" : "Refresh metadata"}
        </button>
      </div>
      {msg ? <p className="mt-2 font-mono text-xs text-peri">{msg}</p> : null}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted-dim">
              <th className="py-2 pr-4">Fund</th>
              <th className="py-2 pr-4">Category</th>
              <th className="py-2 pr-4">Benchmark</th>
              <th className="py-2 text-right">TER</th>
            </tr>
          </thead>
          <tbody>
            {withMeta.map((f) => (
              <tr key={f.holding_id} className="border-b border-line/70">
                <td className="py-2 pr-4">
                  <div className="font-medium text-ink">{f.name}</div>
                  <div className="font-mono text-xs text-muted-dim">{f.symbol ?? "—"}</div>
                </td>
                <td className="py-2 pr-4 text-muted">{f.category ?? "—"}</td>
                <td className="py-2 pr-4 text-muted">{f.benchmark_name ?? "—"}</td>
                <td className="py-2 text-right font-mono text-ink">
                  {f.expense_ratio != null ? `${f.expense_ratio.toFixed(2)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {withMeta.length < funds.length ? (
        <p className="mt-3 text-xs text-muted">
          {funds.length - withMeta.length} fund{funds.length - withMeta.length === 1 ? "" : "s"} still loading — run
          refresh metadata.
        </p>
      ) : null}
    </section>
  );
}
