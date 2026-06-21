"use client";

import type { PortfolioResponse } from "@/lib/types";

export function RiskStrip({ data }: { data: PortfolioResponse }) {
  const usd = data.allocation.by_currency.find((s) => s.key === "USD")?.pct ?? 0;
  const conc = data.alerts.concentration[0];
  const mfN = data.mf_lab.length;
  const topSector = data.holdings
    .map((h) => h.asset_class_l2)
    .filter(Boolean)
    .slice(0, 1)[0];

  return (
    <section className="rounded-xl border border-line/80 bg-canvas/25 px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">Risk strip</p>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
        <span>
          USD leg (INR book %): <strong className="font-mono text-ink">{usd.toFixed(1)}%</strong>
        </span>
        {conc ? (
          <span>
            Top concentration:{" "}
            <strong className="text-ink">
              {conc.name} {conc.weight.toFixed(1)}%
            </strong>
          </span>
        ) : (
          <span>No single-name concentration vs rule.</span>
        )}
        <span>
          MF positions (lab): <strong className="font-mono text-ink">{mfN}</strong>
        </span>
        {topSector ? (
          <span>
            Sample sleeve tag: <strong className="text-ink">{topSector}</strong>
          </span>
        ) : null}
      </div>
    </section>
  );
}
