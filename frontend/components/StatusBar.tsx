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

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line pb-4 text-xs text-muted">
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
      <span className="ml-auto hidden font-mono text-[11px] text-muted/80 lg:block">
        Tools discovered: {meta.tool_inventory.length ? meta.tool_inventory.join(", ") : "-"}
      </span>
    </div>
  );
}
