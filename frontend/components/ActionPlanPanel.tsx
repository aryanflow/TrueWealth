"use client";

import { useState } from "react";

import { formatInr } from "@/lib/format";
import type { ActionPlanItem, NormalizedHolding } from "@/lib/types";

import { SimulateModal } from "./SimulateModal";

export function ActionPlanPanel({
  items,
  holdings,
}: {
  items: ActionPlanItem[];
  holdings: NormalizedHolding[];
}) {
  const [sim, setSim] = useState<ActionPlanItem | null>(null);

  if (!items.length) {
    return (
      <section className="rounded-xl border border-line bg-surface/60 p-4 shadow-card">
        <h2 className="font-display text-xl text-ink">Action plan</h2>
        <p className="mt-2 text-sm text-muted">No ranked actions yet. Tighten rules or refresh holdings.</p>
      </section>
    );
  }
  return (
    <section className="rounded-xl border border-line bg-surface/60 p-4 shadow-card">
      <h2 className="font-display text-xl text-ink">Action plan</h2>
      <p className="mt-1 text-xs text-muted">Ranked, quantified, constraint-aware</p>
      <ul className="mt-4 space-y-4">
        {items.map((a) => (
          <li key={a.rank} className="rounded-lg border border-line/80 bg-canvas/30 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-ink">
                <span className="mr-2 font-mono text-xs text-ion">#{a.rank}</span>
                {a.issue}
              </p>
              <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                {a.confidence}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">{a.why_it_matters}</p>
            <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
              <div className="rounded-md border border-mintglass/25 bg-mintglass/[0.06] p-2">
                <p className="text-[10px] uppercase tracking-wide text-muted">Option A · Trim</p>
                <p className="mt-1 text-ink/90">{a.fix_a}</p>
                {a.suggested_trim_inr != null && a.suggested_trim_inr > 0 ? (
                  <p className="mt-1 font-mono text-mintglass/90">{formatInr(a.suggested_trim_inr)}</p>
                ) : null}
              </div>
              <div className="rounded-md border border-ion/25 bg-ion/[0.06] p-2">
                <p className="text-[10px] uppercase tracking-wide text-muted">Option B · Dilute</p>
                <p className="mt-1 text-ink/90">{a.fix_b}</p>
                {a.suggested_dilute_inr != null && a.suggested_dilute_inr > 0 ? (
                  <p className="mt-1 font-mono text-ion/90">{formatInr(a.suggested_dilute_inr)}</p>
                ) : null}
              </div>
            </div>
            {a.constraints ? (
              <p className="mt-2 text-[11px] text-ember/90">
                <span className="font-medium">Constraints:</span> {a.constraints}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => setSim(a)}
              className="mt-3 rounded-md border border-line px-3 py-1.5 text-[11px] font-medium text-ink hover:bg-surface/50"
            >
              Simulate
            </button>
          </li>
        ))}
      </ul>
      <SimulateModal open={sim != null} onClose={() => setSim(null)} item={sim} holdings={holdings} />
    </section>
  );
}
