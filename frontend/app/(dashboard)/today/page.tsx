"use client";

import Link from "next/link";
import { useMemo } from "react";

import { ExposureSpine } from "@/components/ExposureSpine";
import { HeroMoney } from "@/components/HeroMoney";
import { MoneyValue } from "@/components/MoneyValue";
import { ShieldHealthCard } from "@/components/ShieldHealthCard";
import { StaleSyncBadge } from "@/components/StaleSyncBadge";
import { TodaySleevePerformance } from "@/components/TodaySleevePerformance";
import { usePortfolio } from "@/components/PortfolioContext";
import { summarizeAlerts } from "@/lib/alertSummary";
import { deriveIntradayStatus, intradayUnavailableCopy } from "@/lib/intraday";
import { formatPct, formatPct1, formatSyncShort } from "@/lib/format";

export default function TodayPage() {
  const { data, err, loading, refreshing } = usePortfolio();

  const primaryInsight = useMemo(() => {
    if (!data) return null;
    const fc = data.alerts.concentration[0];
    if (fc) {
      return `${fc.name} is ${fc.weight.toFixed(1)}% of the book — above your ${fc.threshold}% guardrail.`;
    }
    return data.action_plan[0]?.issue ?? null;
  }, [data]);

  const alertSummary = useMemo(() => {
    if (!data) return null;
    return summarizeAlerts(data.alerts, data.meta, data.holdings);
  }, [data]);

  const intraday = useMemo(() => {
    if (!data) return "unavailable" as const;
    return deriveIntradayStatus(data.totals, data.holdings);
  }, [data]);

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 md:px-7">
        <div className="h-12 w-56 animate-pulse rounded-lg bg-panel2" />
        <div className="mt-10 grid gap-6 lg:grid-cols-[1.55fr_1fr]">
          <div className="h-80 rounded-[20px] bg-panel2" />
          <div className="h-80 rounded-[20px] bg-panel2" />
        </div>
      </main>
    );
  }

  if (err || !data) {
    return (
      <main className="mx-auto max-w-lg px-4 py-24 text-center md:px-7">
        <h1 className="font-display text-2xl text-ink">Could not load portfolio</h1>
        <p className="mt-2 text-muted">{err ?? "Unknown error"}</p>
        <p className="mt-4 text-sm text-muted">Open Settings to check connection, or confirm the API is reachable.</p>
      </main>
    );
  }

  const dd = data.performance.current_drawdown_pct;
  const ddReady = data.history.length >= 2 && dd != null;
  const viewName = data.meta.active_view?.name ?? "All assets";

  return (
    <main className="mx-auto max-w-7xl space-y-16 px-4 pb-20 pt-10 md:px-7 md:pt-[42px]">
      {refreshing ? (
        <p className="text-center font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Refreshing book…</p>
      ) : null}

      <div className="eyebrow">Today · the book at a glance</div>

      <section className="grid gap-6 lg:grid-cols-[1.55fr_1fr] lg:items-stretch">
        <div className="panel-card relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(420px_220px_at_88%_0%,rgba(201,162,75,0.1),transparent_70%)]"
            aria-hidden
          />
          <div className="relative">
            <HeroMoney
              inr={data.totals.market_value}
              className={refreshing ? "motion-safe:animate-pulse motion-reduce:animate-none" : ""}
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <StaleSyncBadge meta={data.meta} stale={data.alerts.stale_data} />
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel2 px-2.5 py-1.5 font-mono text-[11px] text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-brass" aria-hidden />
                As of {formatSyncShort(data.meta.last_price_sync ?? data.meta.last_holdings_sync)} IST
              </span>
              <span className="inline-flex rounded-lg border border-line bg-panel2 px-2.5 py-1.5 font-mono text-[11px] text-muted">
                View: {viewName}
              </span>
              <span className="inline-flex rounded-lg border border-line bg-panel2 px-2.5 py-1.5 font-mono text-[11px] text-muted">
                {alertSummary && alertSummary.total > 0
                  ? `${alertSummary.total} alert${alertSummary.total === 1 ? "" : "s"}`
                  : "No major alerts"}
              </span>
            </div>

            {primaryInsight ? (
              <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted">{primaryInsight}</p>
            ) : (
              <p className="mt-5 text-sm text-muted">Book looks balanced in this view — no ranked issues right now.</p>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              {data.alerts.concentration[0] ? (
                <Link href="/decide#concentration" className="btn-primary">
                  Review concentration →
                </Link>
              ) : null}
              <Link href="/map" className="btn-ghost">
                Open exposure map
              </Link>
            </div>

            <div className="mt-8">
              <ExposureSpine slices={data.allocation.by_asset_type} kind="asset" />
            </div>
          </div>
        </div>

        <ShieldHealthCard data={data} />
      </section>

      <section>
        <div className="eyebrow">Sleeves · how each is doing</div>
        <h2 className="section-title">Where the money lives</h2>
        <p className="section-sub">
          Equity, funds, FDs, EPF and crypto — book size, today&apos;s move, and unrealized PnL where the feed gives cost
          basis. Same book as the header total.
        </p>
        <div className="mt-6">
          <TodaySleevePerformance holdings={data.holdings} total_book_inr={data.totals.market_value} totals={data.totals} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="panel-card !p-5">
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-dim">Day move</p>
          {intraday === "available" ? (
            <>
              <p className={`mt-2 text-xl ${data.totals.day_change_value >= 0 ? "text-mint" : "text-coral"}`}>
                <MoneyValue inr={data.totals.day_change_value} signed className="text-xl" />
              </p>
              {data.totals.day_change_pct != null ? (
                <p className="mt-0.5 font-mono text-[10px] text-muted">{formatPct(data.totals.day_change_pct)}</p>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-muted">{intradayUnavailableCopy(intraday)}</p>
          )}
        </div>
        <div className="panel-card !p-5">
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-dim">Drawdown</p>
          {ddReady ? (
            <p className="mt-2 font-mono text-xl text-coral">{dd.toFixed(1)}%</p>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Need more daily values — refresh holdings and check Map after the next snapshot.
            </p>
          )}
        </div>
        <div className="panel-card !p-5">
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-dim">Concentration risk</p>
          {data.alerts.concentration[0] ? (
            <>
              <p className="mt-2 font-display text-lg text-ink">{data.alerts.concentration[0].name}</p>
              <p className="mt-0.5 font-mono text-[11px] text-coral">
                {formatPct1(data.alerts.concentration[0].weight)} · guard {data.alerts.concentration[0].threshold}%
              </p>
              <Link href="/decide#concentration" className="link-action mt-2 inline-block text-xs">
                Review in Decide →
              </Link>
            </>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-muted">No positions above your concentration guardrail.</p>
          )}
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-8 font-mono text-[11.5px] text-muted-dim">
        <span>True Wealth · private ledger</span>
        <span>Shield is triage only — not a performance forecast</span>
      </footer>
    </main>
  );
}
