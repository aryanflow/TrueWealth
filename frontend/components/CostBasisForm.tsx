"use client";

import { useState } from "react";

import { usePortfolio } from "@/components/PortfolioContext";
import type { NormalizedHolding } from "@/lib/types";

export function CostBasisForm({
  holding,
  onSaved,
  compact = false,
}: {
  holding: NormalizedHolding;
  onSaved?: () => void;
  compact?: boolean;
}) {
  const { saveHoldingCost } = usePortfolio();
  const [avgCost, setAvgCost] = useState(holding.avg_cost != null ? String(holding.avg_cost) : "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = parseFloat(avgCost);
    if (!Number.isFinite(v) || v <= 0) {
      setErr("Enter a positive average cost per unit.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await saveHoldingCost(holding.id, v, note.trim() || undefined);
      onSaved?.();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className={`space-y-2 ${compact ? "text-xs" : "text-sm"}`}>
      <p className="text-muted">
        Per-unit cost in <span className="font-mono text-ink">{holding.currency}</span>
        {holding.cost_basis_source === "manual" ? (
          <span className="ml-2 rounded bg-peri/15 px-1.5 py-0.5 font-mono text-[10px] text-peri">manual</span>
        ) : null}
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          type="number"
          step="any"
          min="0"
          value={avgCost}
          onChange={(e) => setAvgCost(e.target.value)}
          placeholder="Avg cost / unit"
          className="min-h-9 flex-1 rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-ink outline-none focus:ring-2 focus:ring-peri/40"
        />
        {!compact ? (
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="min-h-9 flex-[2] rounded-lg border border-line bg-canvas px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-peri/40"
          />
        ) : null}
        <button type="submit" disabled={busy} className="btn-primary !min-h-9 !px-4 !py-2 !text-xs">
          {busy ? "Saving…" : "Save basis"}
        </button>
      </div>
      {err ? <p className="text-xs text-coral">{err}</p> : null}
      <p className="text-[11px] text-muted-dim">Stored on this device only. Overrides broker feed until cleared.</p>
    </form>
  );
}
