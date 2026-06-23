"use client";

import Link from "next/link";

import { formatInr } from "@/lib/format";
import type { PortfolioAlerts, PortfolioMeta, PortfolioPerformance, PortfolioTotals } from "@/lib/types";

function fmtIst(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function WealthHero({
  totals,
  meta,
  performance,
  primaryInsight,
  alerts,
}: {
  totals: PortfolioTotals;
  meta: PortfolioMeta;
  performance?: PortfolioPerformance;
  primaryInsight?: string | null;
  alerts?: PortfolioAlerts | null;
}) {
  const modeLabel = meta.mode === "live" ? "Live book" : meta.mode === "empty" ? "Empty book" : "Degraded / mock";
  const asOf = fmtIst(meta.last_price_sync ?? meta.last_holdings_sync);
  const base = totals.base_currency ?? meta.base_currency ?? "INR";

  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-surface/50 p-6 shadow-card md:p-8">
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-ion/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-mintglass/10 blur-3xl" />
      <div className="relative">
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted">Total wealth ({base})</p>
        <p className="mt-2 font-mono text-4xl font-medium tracking-tight text-ink md:text-6xl md:leading-none">
          <span className="numeric">{formatInr(totals.market_value)}</span>
        </p>
        {meta.data_completeness?.excluded_suspicious_price_count ? (
          <p className="mt-2 text-sm text-ember/90">
            {meta.data_completeness.excluded_suspicious_price_hint ||
              `${meta.data_completeness.excluded_suspicious_price_count} holding(s) excluded due to suspicious price mapping.`}
          </p>
        ) : null}
        {meta.excluded_value != null && meta.excluded_value > 0 ? (
          <p className="mt-2 text-sm text-muted">
            Excluded by view: <span className="font-mono text-ink/90">{formatInr(meta.excluded_value)}</span>
          </p>
        ) : null}
        {alerts?.stale_data ? (
          <p className="mt-2 text-xs text-ember/90">Holdings data may be stale versus your refresh rule.</p>
        ) : null}
        {alerts && alerts.missing_cost_basis.length > 0 ? (
          <p className="mt-1 text-xs text-muted">
            Missing cost basis on {alerts.missing_cost_basis.length} position
            {alerts.missing_cost_basis.length > 1 ? "s" : ""} (see Data drawer).
          </p>
        ) : null}
        {primaryInsight ? (
          <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-ember/95">{primaryInsight}</p>
        ) : null}
        {performance?.twrr_since_first_snapshot != null || performance?.max_drawdown_pct != null ? (
          <p className="mt-2 text-sm text-muted">
            {performance.twrr_since_first_snapshot != null ? (
              <span className="font-mono text-ink/85">
                Naive TWRR (snapshots): {performance.twrr_since_first_snapshot.toFixed(2)}%
              </span>
            ) : null}
            {performance.max_drawdown_pct != null ? (
              <span className="ml-3 font-mono text-ink/85">Max DD: {performance.max_drawdown_pct.toFixed(2)}%</span>
            ) : null}
            <span className="ml-3 text-xs text-muted/90">XIRR: {performance?.xirr_status ?? "n/a"}</span>
          </p>
        ) : null}
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span>As of {asOf} IST</span>
          <span className="hidden sm:inline">·</span>
          <span className={meta.mode === "live" ? "text-mintglass" : "text-ember"}>{modeLabel}</span>
          {meta.mcp_degraded && (
            <>
              <span>·</span>
              <span className="text-ember">MCP degraded</span>
            </>
          )}
        </p>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
          Day move (INR book){" "}
          <span className="font-mono text-ink/90">{formatInr(totals.day_change_value)}</span>
          {totals.day_change_pct != null && (
            <span className="font-mono text-ink/70">
              {" "}
              ({totals.day_change_pct >= 0 ? "+" : ""}
              {totals.day_change_pct.toFixed(2)}%)
            </span>
          )}
          {totals.unrealized_pnl != null && (
            <>
              {" "}
              · Unrealized (INR){" "}
              <span className="font-mono text-ink/90">{formatInr(totals.unrealized_pnl)}</span>
            </>
          )}
        </p>
        <Link
          href="/mcp"
          className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-ion transition hover:text-ion/80"
        >
          Your portfolio, programmable →
        </Link>
      </div>
    </section>
  );
}
