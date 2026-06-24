"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CostBasisForm } from "@/components/CostBasisForm";
import { MoneyValue } from "@/components/MoneyValue";
import { usePortfolio } from "@/components/PortfolioContext";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { labelSlice } from "@/lib/assetLabels";
import { formatValue } from "@/lib/format";
import type { NormalizedHolding } from "@/lib/types";

const NOTE_PREFIX = "tw_holding_note:";

function bookInr(h: NormalizedHolding): number {
  const v = h.inr_market_value;
  if (v != null && v > 0) return v;
  return h.market_value;
}

export function HoldingInspectorSheet() {
  const { inspectorHolding, setInspectorHolding, data, thr } = usePortfolio();
  const h = inspectorHolding;
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!h || typeof window === "undefined") {
      setNote("");
      return;
    }
    setNote(window.localStorage.getItem(NOTE_PREFIX + h.id) ?? "");
  }, [h]);

  function persistNote(next: string) {
    if (!h || typeof window === "undefined") return;
    const k = NOTE_PREFIX + h.id;
    if (next.trim()) window.localStorage.setItem(k, next);
    else window.localStorage.removeItem(k);
  }

  if (!h) return null;

  const total = data?.totals.market_value ?? 0;
  const weight = total > 0 ? (100 * bookInr(h)) / total : h.weight;
  const trimPct = Math.min(99, Math.max(1, parseFloat(thr) || 15));

  return (
    <Sheet open={!!h} onOpenChange={(o) => !o && setInspectorHolding(null)}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <SheetTitle className="pr-8 leading-snug">{h.name}</SheetTitle>
            <SheetDescription>
              {labelSlice(h.asset_type)} · {h.currency}
              {h.symbol ? ` · ${h.symbol}` : ""}
            </SheetDescription>
          </div>
          <SheetClose className="rounded-md border border-hairline px-2 py-1 text-xs text-muted hover:text-ink">
            Close
          </SheetClose>
        </SheetHeader>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-hairline bg-surface-elevated/50 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted">Value (INR book)</p>
              <p className="mt-1">
                <MoneyValue inr={bookInr(h)} native={h.market_value} currency={h.currency} className="text-ink" />
              </p>
            </div>
            <div className="rounded-lg border border-hairline bg-surface-elevated/50 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted">Weight</p>
              <p className="mt-1 font-mono text-ink">{weight.toFixed(2)}%</p>
            </div>
          </div>
          {h.currency === "USD" ? (
            <p className="text-xs text-muted">
              Native {formatValue(h.market_value, h.currency)}
              {h.fx_usd_inr_used != null ? (
                <>
                  {" "}
                  · FX USD/INR used <span className="font-mono text-ink/90">{h.fx_usd_inr_used.toFixed(4)}</span>
                </>
              ) : null}
            </p>
          ) : null}
          <div className="rounded-lg border border-line bg-panel2/40 p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted">Cost basis</p>
            <div className="mt-2">
              <CostBasisForm holding={h} compact />
            </div>
          </div>
          {h.inr_unrealized_pnl != null ? (
            <p className={`text-sm font-mono ${h.inr_unrealized_pnl >= 0 ? "text-gain-muted" : "text-loss-muted"}`}>
              Unrealized P&amp;L (INR){" "}
              <MoneyValue inr={h.inr_unrealized_pnl} signed className={h.inr_unrealized_pnl >= 0 ? "text-gain-muted" : "text-loss-muted"} />
            </p>
          ) : h.avg_cost == null ? (
            <p className="text-xs text-muted">Cost basis not set — P&amp;L unavailable until you add it or sync averages.</p>
          ) : (
            <p className="text-xs text-muted">Unrealized P&amp;L not available for this line.</p>
          )}
          <div className="space-y-2">
            <label className="text-xs text-muted" htmlFor="tw-note">
              Note (saved on this device)
            </label>
            <textarea
              id="tw-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => persistNote(note)}
              rows={3}
              className="w-full rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-ion/30"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Link
              href={`/decide?holding=${encodeURIComponent(h.id)}&trimPct=${encodeURIComponent(String(trimPct))}`}
              onClick={() => setInspectorHolding(null)}
              className="rounded-lg border border-ion/40 bg-ion/10 px-3 py-2 text-center text-xs font-medium text-ion hover:bg-ion/20"
            >
              Simulate trim toward {trimPct}% weight
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
