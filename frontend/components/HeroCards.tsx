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
        definition="Sum of position market values after the latest price sync (LTP from broker when present, otherwise deterministic mock prices)."
        source="Computed server-side from normalized holdings (INDmoney MCP or mock JSON)."
      />
      <MetricTip
        label="Day change"
        value={
          <span className={`numeric ${dayCls}`}>
            {formatInr(totals.day_change_value)}{" "}
            <span className="text-lg md:text-xl">({formatPct(totals.day_change_pct)})</span>
          </span>
        }
        definition="Aggregate of per-line day P&amp;L fields when the broker payload provides them; percent approximates day move vs prior close proxy."
        source="Broker/MCP holding fields (day_change) or zero when absent."
      />
      <MetricTip
        label="Unrealized P&amp;L"
        value={
          <span className="numeric text-muted">
            {totals.unrealized_pnl == null ? "-" : formatInr(totals.unrealized_pnl)}
          </span>
        }
        definition="Sum of (last price minus average cost) times quantity across lines with cost basis. Mixed currencies are summed numerically in V1. Figures shown in INR for readability, not FX-converted."
        source="Derived from avg_cost and last_price on each holding."
      >
        <p className="mt-2 text-xs text-warn">
          Mixed INR/USD book: treat unrealized as indicative until FX is modeled.
        </p>
      </MetricTip>
    </section>
  );
}
