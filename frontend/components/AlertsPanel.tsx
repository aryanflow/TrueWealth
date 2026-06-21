"use client";

import type { PortfolioAlerts } from "@/lib/types";

export function AlertsPanel({ alerts }: { alerts: PortfolioAlerts }) {
  return (
    <section className="rounded-xl border border-line bg-surface/60 p-4 shadow-card">
      <h2 className="font-display text-xl text-ink">Alerts & next steps</h2>
      <ul className="mt-3 space-y-3 text-sm">
        {alerts.stale_data && (
          <li className="rounded-xl border border-ember/35 bg-canvas/50 px-4 py-3 text-ember">
            <p className="font-medium text-ink">Feeds look stale</p>
            <p className="mt-1 text-xs text-muted">
              Last sync: {alerts.last_sync ?? "unknown"}. Check MCP connectivity or widen refresh windows in rules.
            </p>
            <p className="mt-2 text-xs text-muted">
              <strong className="text-ink">Action:</strong> reconnect MCP or wait for the next holdings cycle.
            </p>
          </li>
        )}
        {alerts.concentration.map((c) => {
          const over = c.weight - c.threshold;
          return (
            <li key={c.holding_id} className="rounded-xl border border-rose/30 bg-canvas/50 px-4 py-3">
              <p className="font-medium text-ink">Concentration: {c.name}</p>
              <p className="mt-1 text-xs text-muted">
                Position is <span className="font-mono text-ink">{c.weight.toFixed(1)}%</span> of the book vs your{" "}
                <span className="font-mono">{c.threshold.toFixed(1)}%</span> guardrail (
                <span className="font-mono text-rose">+{over.toFixed(1)}%</span> over).
              </p>
              <p className="mt-2 text-xs text-muted">
                <strong className="text-ink">Decision support:</strong> trim ~{over.toFixed(0)}% of book weight from
                this line <em>or</em> add uncorrelated exposure elsewhere to dilute. Execution not available here.
              </p>
            </li>
          );
        })}
        {alerts.missing_cost_basis.length > 0 && (
          <li className="rounded-xl border border-line bg-canvas/50 px-4 py-3 text-muted">
            <p className="font-medium text-ink">Missing cost basis</p>
            <p className="mt-1 text-xs">Unrealized P&amp;L incomplete for: {alerts.missing_cost_basis.join(", ")}.</p>
            <p className="mt-2 text-xs">
              <strong className="text-ink">Action:</strong> enrich from broker export or wait for MCP fields if
              supported.
            </p>
          </li>
        )}
        {!alerts.stale_data && alerts.concentration.length === 0 && alerts.missing_cost_basis.length === 0 && (
          <li className="rounded-xl border border-line/60 bg-canvas/30 px-4 py-3 text-muted">
            No structural alerts. Rules still run on a fixed cadence.
          </li>
        )}
      </ul>
      <p className="mt-4 border-t border-line/60 pt-3 text-center text-xs font-semibold uppercase tracking-wide text-ink">
        We never place orders
      </p>
    </section>
  );
}
