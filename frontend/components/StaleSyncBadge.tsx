"use client";

import { formatSyncShort } from "@/lib/format";
import type { PortfolioMeta } from "@/lib/types";

export function StaleSyncBadge({ meta, stale }: { meta: PortfolioMeta; stale?: boolean }) {
  const isStale = stale ?? false;
  const label = isStale ? "Stale sync" : "Live";
  const ts = meta.last_holdings_sync ?? meta.last_price_sync;
  const fx = meta.fx_usd_inr;
  const fxMode = meta.data_completeness?.fx_mode ?? "static";

  return (
    <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wide">
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 ${
          isStale ? "border-coral/40 bg-coral/10 text-coral" : "border-mint/35 bg-mint/10 text-mint"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${isStale ? "bg-coral" : "bg-mint"}`} aria-hidden />
        {label}
      </span>
      {ts ? (
        <span className="rounded-md border border-line px-2 py-1 text-muted-dim">
          Sync {formatSyncShort(ts)}
        </span>
      ) : null}
      {fx != null ? (
        <span className="rounded-md border border-line px-2 py-1 text-muted-dim" title={meta.fx_as_of ?? undefined}>
          FX {fx.toFixed(2)} · {fxMode}
        </span>
      ) : null}
    </div>
  );
}
