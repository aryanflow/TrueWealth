"use client";

import { useState } from "react";

import type { MfFundSummary } from "@/lib/types";

export function FundLabSection({
  funds,
  onAfterMfRefresh,
}: {
  funds: MfFundSummary[];
  onAfterMfRefresh?: () => void;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  if (!funds.length) {
    return (
      <section className="rounded-xl border border-line bg-surface/60 p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-ink">Fund lab</h2>
          <button
            type="button"
            disabled={busy}
            onClick={() => void refreshMeta()}
            className="rounded-md border border-line px-3 py-1.5 text-xs text-ink hover:bg-canvas/50 disabled:opacity-50"
          >
            Refresh MF metadata
          </button>
        </div>
        {msg ? <p className="mt-2 text-xs text-ion/90">{msg}</p> : null}
        <p className="mt-3 text-sm text-muted">No mutual fund rows in this view, or metadata is not available yet.</p>
      </section>
    );
  }
  return (
    <section className="rounded-xl border border-line bg-surface/60 p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-ink">Fund lab</h2>
          <p className="mt-1 text-xs text-muted">Category, benchmark, TER from INDmoney MCP (cached 24h)</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void refreshMeta()}
          className="rounded-md border border-line px-3 py-1.5 text-xs text-ink hover:bg-canvas/50 disabled:opacity-50"
        >
          Refresh MF metadata
        </button>
      </div>
      {msg ? <p className="mt-2 text-xs text-ion/90">{msg}</p> : null}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-4">Fund</th>
              <th className="py-2 pr-4">Category</th>
              <th className="py-2 pr-4">Benchmark</th>
              <th className="py-2 text-right">TER</th>
              <th className="py-2 pl-4">Data</th>
            </tr>
          </thead>
          <tbody>
            {funds.map((f) => (
              <tr key={f.holding_id} className="border-b border-line/70">
                <td className="py-2 pr-4">
                  <div className="font-medium text-ink">{f.name}</div>
                  <div className="font-mono text-xs text-muted">{f.symbol ?? "—"}</div>
                </td>
                <td className="py-2 pr-4 text-muted">{f.category ?? "—"}</td>
                <td className="py-2 pr-4 text-muted">{f.benchmark_name ?? "—"}</td>
                <td className="py-2 text-right font-mono text-ink">
                  {f.expense_ratio != null ? `${f.expense_ratio.toFixed(2)}%` : "—"}
                </td>
                <td className="py-2 pl-4 text-xs uppercase text-muted">{f.data_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
