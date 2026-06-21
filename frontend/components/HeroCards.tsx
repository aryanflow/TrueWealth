"use client";

import { MetricTip } from "./MetricTip";
import { formatInr, formatPct } from "@/lib/format";
import type { PortfolioTotals } from "@/lib/types";

export function HeroCards({ totals }: { totals: PortfolioTotals }) {
  const dayUp = totals.day_change_value >= 0;
  const dayCls = dayUp ? "text-gain" : "text-loss";

  return (
    <section className="grid gap-4 md:grid-cols-3">
      <MetricTip
        label="Total market value"
        value={<span className="numeric">{formatInr(totals.market_value)}</span>}
        definition="INR book total: native USD legs converted at USDINR (env USDINR_RATE); all other rows treated as INR nominal."
        source="Server `compute_portfolio` on INR-normalized holdings."
      />
      <MetricTip
        label="Day change"
        value={
          <span className={`numeric ${dayCls}`}>
            {formatInr(totals.day_change_value)}{" "}
            <span className="text-lg md:text-xl">({formatPct(totals.day_change_pct)})</span>
          </span>
        }
        definition="Sum of INR day P&amp;L when lines have day_change; optional OHLC proxy fills gaps for a few IN stocks per refresh."
        source="Broker fields and optional MCP OHLC enrichment."
      />
      <MetricTip
        label="Unrealized P&amp;L"
        value={
          <span className="numeric text-muted">
            {totals.unrealized_pnl == null ? "-" : formatInr(totals.unrealized_pnl)}
          </span>
        }
        definition="Sum of per-line unrealized P&amp;L converted to INR for USD positions using the same static USDINR as market value."
        source="avg_cost × qty vs MV, then INR book layer."
      >
        <p className="mt-2 text-xs text-mintglass/90">INR book — totals reconcile in one base currency.</p>
      </MetricTip>
    </section>
  );
}
