"use client";

import type { PortfolioMeta } from "@/lib/types";

function fmtTime(iso: string | null): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export function StatusBar({ meta }: { meta: PortfolioMeta }) {
  const mcpLabel = meta.mcp_connected
    ? meta.mcp_degraded
      ? "MCP degraded"
      : "MCP connected"
    : "MCP offline";

  const dc = meta.data_completeness;
  const completeness = dc?.score != null ? `${Math.round(dc.score)} / 100 data` : null;

  const cov = meta.coverage;
  const hasCov = cov && (cov.provided?.length || cov.absent?.length);
  const covProvided = cov?.provided?.length ? cov.provided.join(", ") : null;
  const covAbsent = cov?.absent?.length ? cov.absent.join(", ") : null;

  return (
    <div className="flex flex-col gap-2 border-b border-line pb-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
      <span
        className={`rounded-full border px-2 py-1 font-mono ${
          meta.mode === "live"
            ? "border-gain/50 text-gain"
            : "border-warn/50 text-warn"
        }`}
        title="live = MCP holdings path succeeded last refresh; mock = sample JSON fallback."
      >
        {meta.mode === "live" ? "Live book" : "Mock book"}
      </span>
      <span
        className={`rounded-full border px-2 py-1 font-mono ${
          meta.mcp_connected && !meta.mcp_degraded
            ? "border-accent/50 text-accent"
            : "border-line text-muted"
        }`}
      >
        {mcpLabel}
      </span>
      <span className="rounded-full border border-line px-2 py-1 font-mono">
        Holdings sync: {fmtTime(meta.last_holdings_sync)}
      </span>
      <span className="rounded-full border border-line px-2 py-1 font-mono">
        Price sync: {fmtTime(meta.last_price_sync)}
      </span>
      {meta.base_currency ? (
        <span className="rounded-full border border-line px-2 py-1 font-mono">Base: {meta.base_currency}</span>
      ) : null}
      {meta.fx_usd_inr != null ? (
        <span className="rounded-full border border-line px-2 py-1 font-mono" title="Static MVP rate">
          USDINR {meta.fx_usd_inr.toFixed(2)}
        </span>
      ) : null}
      {completeness ? (
        <span className="rounded-full border border-ion/30 px-2 py-1 font-mono text-ion/90">{completeness}</span>
      ) : null}
      {dc?.excluded_suspicious_price_count ? (
        <span className="rounded-full border border-ember/40 px-2 py-1 font-mono text-ember/90" title={dc.excluded_suspicious_price_hint}>
          Bad price map: {dc.excluded_suspicious_price_count}
        </span>
      ) : null}
      {dc?.missing_cost_basis_count ? (
        <span className="rounded-full border border-ember/40 px-2 py-1 font-mono text-ember/90">
          Missing cost: {dc.missing_cost_basis_count}
        </span>
      ) : null}
      {dc && !dc.transactions_available ? (
        <span className="rounded-full border border-line px-2 py-1 font-mono text-muted">Tx: unavailable</span>
      ) : null}
      <span className="ml-auto hidden font-mono text-[11px] text-muted/80 lg:block">
        Tools discovered: {meta.tool_inventory.length ? meta.tool_inventory.join(", ") : "-"}
      </span>
      </div>
      {hasCov && meta.mode === "live" ? (
        <p className="text-[11px] leading-relaxed text-muted">
          <span className="font-medium text-ink/80">Coverage:</span> {covProvided ?? "—"}.
          {covAbsent ? (
            <>
              {" "}
              <span className="font-medium text-ink/80">Not provided by current feed:</span> {covAbsent}.
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
