"use client";

import { useMemo } from "react";

import { formatInr } from "@/lib/format";
import type { ActionPlanItem, NormalizedHolding } from "@/lib/types";

function bookInr(h: NormalizedHolding): number {
  const v = h.inr_market_value;
  if (v != null && v > 0) return v;
  return h.market_value;
}

export function SimulateModal({
  open,
  onClose,
  item,
  holdings,
}: {
  open: boolean;
  onClose: () => void;
  item: ActionPlanItem | null;
  holdings: NormalizedHolding[];
}) {
  const preview = useMemo(() => {
    if (!item?.holding_id || !item.suggested_trim_inr || item.suggested_trim_inr <= 0) return null;
    const total = holdings.reduce((s, h) => s + bookInr(h), 0);
    if (total <= 0) return null;
    const trim = item.suggested_trim_inr;
    const hid = item.holding_id;
    const next = holdings.slice(0, 5).map((h) => {
      const mv = bookInr(h);
      const adj = h.id === hid ? Math.max(0, mv - trim) : mv;
      const w = total - trim > 0 ? (adj / (total - trim)) * 100 : 0;
      return { name: h.name.length > 18 ? `${h.name.slice(0, 16)}…` : h.name, weight: w };
    });
    return next;
  }, [item, holdings]);

  if (!open || !item) return null;

  return (
    <>
      <button type="button" className="fixed inset-0 z-50 bg-black/50" aria-label="Close" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-[60] w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-canvas p-5 shadow-2xl">
        <h4 className="font-display text-lg text-ink">Simulate trim (top 5)</h4>
        <p className="mt-2 text-xs text-muted">
          Indicative post-trim weights if you sold about{" "}
          <span className="font-mono text-ink">{item.suggested_trim_inr ? formatInr(item.suggested_trim_inr) : "—"}</span>{" "}
          from the flagged name only. Not tax or lot aware.
        </p>
        {preview ? (
          <ul className="mt-4 space-y-2 border-t border-line/70 pt-3 text-xs">
            {preview.map((r) => (
              <li key={r.name} className="flex justify-between font-mono text-muted">
                <span className="truncate text-ink/90">{r.name}</span>
                <span>{r.weight.toFixed(2)}%</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">Simulation needs a concentration row with a trim amount.</p>
        )}
        <button
          type="button"
          className="mt-5 w-full rounded-md border border-line py-2 text-sm text-ink hover:bg-surface/60"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </>
  );
}
