"use client";

import Link from "next/link";
import { useMemo } from "react";

import { formatInr } from "@/lib/format";
import type { ActionPlanItem, NormalizedHolding } from "@/lib/types";

function bookInr(h: NormalizedHolding): number {
  const v = h.inr_market_value;
  if (v != null && v > 0) return v;
  return h.market_value;
}

type Slice = { key: string; pct: number };

function assetSlices(holdings: NormalizedHolding[], holdingId: string | null | undefined, trim: number): Slice[] {
  const m = new Map<string, number>();
  let tot = 0;
  for (const h of holdings) {
    let mv = bookInr(h);
    if (holdingId && h.id === holdingId) mv = Math.max(0, mv - trim);
    m.set(h.asset_type, (m.get(h.asset_type) ?? 0) + mv);
    tot += mv;
  }
  if (tot <= 0) return [];
  return [...m.entries()]
    .map(([key, v]) => ({ key, pct: (100 * v) / tot }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);
}

function ExposureStrip({ label, slices }: { label: string; slices: Slice[] }) {
  return (
    <div className="mt-3">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1 flex h-3 w-full overflow-hidden rounded-full border border-hairline bg-surface-elevated/50">
        {slices.length === 0 ? (
          <div className="w-full bg-line/40" />
        ) : (
          slices.map((s, i) => (
            <div
              key={`${label}-${s.key}-${i}`}
              style={{ width: `${Math.max(s.pct, 0)}%` }}
              className={i % 2 === 0 ? "bg-ion/70" : "bg-mintglass/60"}
              title={`${s.key}: ${s.pct.toFixed(1)}%`}
            />
          ))
        )}
      </div>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted">
        {slices.map((s) => (
          <li key={`${label}-leg-${s.key}`}>
            <span className="text-ink/80">{s.key}</span>{" "}
            <span className="font-mono">{s.pct.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
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
    return { rows: next, trim, hid, total };
  }, [item, holdings]);

  const beforeSlices = useMemo(() => {
    if (!preview) return [];
    return assetSlices(holdings, null, 0);
  }, [holdings, preview]);

  const afterSlices = useMemo(() => {
    if (!preview) return [];
    return assetSlices(holdings, preview.hid, preview.trim);
  }, [holdings, preview]);

  if (!open || !item) return null;

  return (
    <>
      <button type="button" className="fixed inset-0 z-[200] bg-black/50" aria-label="Close" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-[210] max-h-[90vh] w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-canvas p-5 shadow-2xl">
        <h4 className="font-display text-lg text-ink">Simulate trim</h4>
        <p className="mt-2 text-xs text-muted">
          Indicative post-trim weights if you sold about{" "}
          <span className="font-mono text-ink">{item.suggested_trim_inr ? formatInr(item.suggested_trim_inr) : "n/a"}</span>{" "}
          from the flagged line only. Not tax or lot aware.
        </p>
        {preview ? (
          <>
            <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-muted">Before vs after</p>
            <p className="mt-1 text-xs text-muted">
              Same book, same prices; only the flagged line’s notional is reduced for the “after” stack.
            </p>
            <ExposureStrip label="Exposure by asset (before)" slices={beforeSlices} />
            <ExposureStrip label="Exposure by asset (after)" slices={afterSlices} />
            <p className="mt-4 text-[10px] uppercase tracking-wide text-muted">Top names after trim (first five)</p>
            <ul className="mt-2 space-y-2 border-t border-line/70 pt-3 text-xs">
              {preview.rows.map((r, idx) => (
                <li key={`${r.name}-${idx}`} className="flex justify-between font-mono text-muted">
                  <span className="truncate text-ink/90">{r.name}</span>
                  <span>{r.weight.toFixed(2)}%</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {preview ? (
          <p className="mt-4 text-xs leading-relaxed text-muted">
            Tax, STT/LTCG rules, and lot selection are not modeled—use this only to sense how weights would shift at a
            single price snapshot.
          </p>
        ) : null}
        {!preview ? (
          <div className="mt-4 rounded-lg border border-line/80 bg-surface/40 p-4 text-sm text-muted">
            <p>Simulation is available for concentration trims with a computed notional on a specific holding.</p>
            <p className="mt-3">
              Open{" "}
              <Link href="/decide#concentration" className="font-medium text-ion underline-offset-2 hover:text-ion/85">
                Decide → Concentration
              </Link>{" "}
              and use <span className="text-ink">Simulate</span> on a ranked trim row.
            </p>
          </div>
        ) : null}
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
