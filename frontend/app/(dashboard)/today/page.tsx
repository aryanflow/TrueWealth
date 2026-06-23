"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";

import { ShieldHealthCard } from "@/components/ShieldHealthCard";
import { TodaySleevePerformance } from "@/components/TodaySleevePerformance";
import { usePortfolio } from "@/components/PortfolioContext";
import { formatInr } from "@/lib/format";
import type { NormalizedHolding } from "@/lib/types";

function bookInr(h: NormalizedHolding): number {
  const v = h.inr_market_value;
  if (v != null && v > 0) return v;
  return h.market_value;
}

function fmtAsOf(iso: string | null | undefined): string {
  if (!iso) return "As of unknown time";
  try {
    const d = new Date(iso);
    return `As of ${d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`;
  } catch {
    return "As of recent sync";
  }
}

function confidenceLabel(raw: string | undefined): "Good" | "Partial" | "Degraded" {
  const v = (raw ?? "partial").toLowerCase();
  if (v === "good") return "Good";
  if (v === "degraded") return "Degraded";
  return "Partial";
}

function confidencePillText(raw: string | undefined): string {
  const g = confidenceLabel(raw);
  if (g === "Good") return "Good data";
  if (g === "Partial") return "Partial data";
  return "Degraded feed";
}

export default function TodayPage() {
  const { data, err, loading, refreshing, setInspectorHolding } = usePortfolio();
  const [revealOpen, setRevealOpen] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const firstConc = data?.alerts.concentration[0];
  const firstConcHolding = useMemo(() => {
    if (!data || !firstConc) return undefined;
    return data.holdings.find((h) => h.id === firstConc.holding_id);
  }, [data, firstConc]);

  const firstMissingHolding = useMemo(() => {
    if (!data?.alerts.missing_cost_basis.length) return undefined;
    const n = data.alerts.missing_cost_basis[0];
    return data.holdings.find((h) => h.name === n);
  }, [data]);

  const primaryInsight = useMemo(() => {
    if (!data) return null;
    const fc = data.alerts.concentration[0];
    if (fc) {
      return `Top issue: ${fc.name} is ${fc.weight.toFixed(1)}% of book vs ${fc.threshold}% guardrail.`;
    }
    return data.action_plan[0]?.issue ?? null;
  }, [data]);

  const previewRows = useMemo(() => {
    if (!data) return [];
    return [...data.holdings].sort((a, b) => b.weight - a.weight).slice(0, 5);
  }, [data]);

  const breaches = useMemo(() => {
    if (!data) return 0;
    return (
      data.alerts.concentration.length +
      data.alerts.missing_cost_basis.length +
      (data.alerts.stale_data ? 1 : 0)
    );
  }, [data]);

  const usdPct = useMemo(() => {
    if (!data) return 0;
    return data.usd_exposure_pct ?? data.allocation.by_currency.find((s) => s.key === "USD")?.pct ?? 0;
  }, [data]);

  const offshorePct = useMemo(() => {
    if (!data) return 0;
    return data.global_equity_offshore_pct ?? 0;
  }, [data]);

  const topSleevesLine = useMemo(() => {
    if (!data) return "";
    const sorted = [...data.allocation.by_asset_type].filter((s) => s.pct > 0.0001).sort((a, b) => b.pct - a.pct);
    const head = sorted.slice(0, 6);
    const rest = sorted.length - head.length;
    const line = head.map((s) => `${s.key} ${s.pct.toFixed(1)}%`).join(" · ");
    return rest > 0 ? `${line} · +${rest} more` : line;
  }, [data]);

  const excludedSleevesHint = useMemo(() => {
    if (!data) return "";
    const ex = data.meta.excluded_value ?? 0;
    if (ex <= 0) return "";
    const full = data.allocation_full_book;
    if (!full) return `About ${formatInr(ex)} sits outside this view’s filter.`;
    const a = [...data.allocation.by_asset_type].map((s) => s.key).join(", ");
    const b = [...full.by_asset_type].map((s) => s.key).join(", ");
    if (a !== b) return `View shows [${a}] vs full book [${b}]; ${formatInr(ex)} excluded by filter.`;
    return `${formatInr(ex)} excluded by the active view filter.`;
  }, [data]);

  const confidenceTitle = useMemo(() => {
    const notes = data?.meta.confidence_notes;
    if (notes && notes.length) return notes.join(" ");
    return undefined;
  }, [data]);

  const missingN = data?.meta.data_completeness?.missing_cost_basis_count ?? data?.alerts.missing_cost_basis.length ?? 0;

  const startHold = useCallback(() => {
    if (holdTimer.current) return;
    holdTimer.current = setTimeout(() => {
      setRevealOpen(true);
      holdTimer.current = null;
    }, 600);
  }, []);

  const endHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <div className="h-12 w-56 animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="mt-10 grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8 h-64 rounded-3xl bg-white/[0.04]" />
          <div className="lg:col-span-4 h-64 rounded-3xl bg-white/[0.04]" />
        </div>
      </main>
    );
  }

  if (err || !data) {
    return (
      <main className="mx-auto max-w-lg px-4 py-24 text-center md:px-6">
        <h1 className="font-display text-2xl text-ink">Could not load portfolio</h1>
        <p className="mt-2 text-muted">{err ?? "Unknown error"}</p>
        <p className="mt-4 text-sm text-muted">Open Settings to check connection, or confirm the API is reachable.</p>
      </main>
    );
  }

  const badge = confidenceLabel(data.meta.confidence);
  const dd = data.performance.current_drawdown_pct;
  const ddReady = data.history.length >= 3 && dd != null;
  const excluded = data.meta.excluded_value ?? 0;
  const viewName = data.meta.active_view?.name ?? "All assets";

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 pb-16 pt-8 md:space-y-8 md:px-6 md:pt-12">
      {refreshing ? (
        <p className="text-center text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Refreshing book…</p>
      ) : null}
      <section className="grid gap-6 lg:grid-cols-12 lg:items-stretch">
        <div className="glass relative overflow-hidden rounded-3xl border border-white/[0.09] p-7 shadow-[0_18px_70px_rgba(0,0,0,0.55)] backdrop-blur-md md:col-span-8 md:p-8">
          <div className="pointer-events-none absolute -right-24 top-0 h-72 w-72 rounded-full bg-ion/10 blur-3xl" />
          <div className="relative">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted">Total wealth (INR)</p>
            <p
              className={`mt-3 font-mono text-4xl font-medium tracking-tight text-ink md:text-5xl md:leading-none ${
                refreshing ? "motion-safe:animate-pulse motion-reduce:animate-none" : ""
              }`}
            >
              <span className="numeric">{formatInr(data.totals.market_value)}</span>
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                  badge === "Good"
                    ? "border-gain-muted/40 bg-gain-muted/10 text-gain-muted"
                    : badge === "Partial"
                      ? "border-warn-muted/40 bg-warn-muted/10 text-warn-muted"
                      : "border-loss-muted/40 bg-loss-muted/10 text-loss-muted"
                }`}
                title={confidenceTitle}
              >
                <span className="h-2 w-2 rounded-full bg-current opacity-80" aria-hidden />
                {confidencePillText(data.meta.confidence)}
              </span>
              <span className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs text-muted">
                {fmtAsOf(data.meta.last_price_sync ?? data.meta.last_holdings_sync)}
              </span>
              <span className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs text-muted">
                View: {viewName}
              </span>
            </div>
            {primaryInsight ? (
              <p className="mt-6 max-w-2xl text-sm leading-relaxed text-ink/75 md:text-base">{primaryInsight}</p>
            ) : (
              <p className="mt-6 text-sm text-muted">No major alerts in this view right now.</p>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              {data.alerts.concentration[0] ? (
                <Link
                  href="/decide#concentration"
                  className="inline-flex items-center justify-center rounded-xl border border-ion/35 bg-ion/15 px-4 py-2.5 text-sm font-medium text-ink transition hover:border-ion/50 hover:bg-ion/20"
                >
                  Fix concentration
                </Link>
              ) : data.alerts.missing_cost_basis.length > 0 ? (
                <Link
                  href="/decide#cost"
                  className="inline-flex items-center justify-center rounded-xl border border-ion/35 bg-ion/15 px-4 py-2.5 text-sm font-medium text-ink transition hover:border-ion/50 hover:bg-ion/20"
                >
                  Fix missing cost basis
                </Link>
              ) : null}
              <Link
                href="/map"
                className="inline-flex items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-ink transition hover:border-ion/30 hover:bg-white/[0.06]"
              >
                See exposure map
              </Link>
              {(data.usd_exposure_pct ?? data.allocation.by_currency.find((s) => s.key === "USD")?.pct ?? 0) > 15 ||
              (data.global_equity_offshore_pct ?? 0) > 20 ? (
                <Link
                  href="/decide#fx"
                  className="inline-flex items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-ink transition hover:border-ion/30 hover:bg-white/[0.06]"
                >
                  Review FX & offshore
                </Link>
              ) : null}
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-ink transition hover:border-ion/30"
                onMouseDown={startHold}
                onMouseUp={endHold}
                onMouseLeave={endHold}
                onTouchStart={startHold}
                onTouchEnd={endHold}
              >
                Hold to reveal
                <span className="text-muted" aria-hidden>
                  ▾
                </span>
              </button>
            </div>

            <div className="mt-8 rounded-2xl border border-white/[0.06] bg-black/25 p-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">Exposure snapshot</p>
              <p className="mt-2 text-sm leading-relaxed text-ink/90">{topSleevesLine || "No sleeves in this view."}</p>
              <p className="mt-2 text-xs text-muted">
                US / global equity (US_STOCK, INR book) ~{offshorePct.toFixed(1)}% · USD-denominated currency leg ~
                {usdPct.toFixed(1)}% (Indian listings are INR in this model).{" "}
                <Link href="/map" className="font-medium text-ion underline-offset-2 hover:text-ion/80">
                  Full breakdown on Map
                </Link>
              </p>
              {excludedSleevesHint ? (
                <p className="mt-2 text-[11px] leading-relaxed text-warn-muted/90">{excludedSleevesHint}</p>
              ) : null}
            </div>

            <div className="mt-6 rounded-2xl border border-white/[0.06] bg-black/20 p-3 md:p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">Top holdings</p>
                <Link href="/decide" className="text-[10px] font-medium text-ion underline-offset-2 hover:text-ion/85">
                  Decide →
                </Link>
              </div>
              <p className="mt-1 text-[11px] text-muted">Top five by weight in this view. Tap a row for the inspector.</p>
              <ul className="mt-2 divide-y divide-white/[0.05]">
                {previewRows.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => setInspectorHolding(h)}
                      aria-label={`Open holding ${h.name}`}
                      className="group flex w-full items-center justify-between gap-3 py-2.5 text-left transition hover:bg-white/[0.04] md:py-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">{h.name}</span>
                        <span className="text-[11px] text-muted">{h.asset_type}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-right">
                        <span>
                          <span className="block font-mono text-xs text-ink">{formatInr(bookInr(h))}</span>
                          <span className="text-[11px] text-muted">{h.weight.toFixed(1)}%</span>
                        </span>
                        <span className="text-base text-muted transition group-hover:text-ink" aria-hidden>
                          ›
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {revealOpen ? (
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="glass-soft rounded-2xl border border-white/[0.06] p-4">
                  <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">Excluded by view</p>
                  <p className="mt-2 font-mono text-lg text-ink">{formatInr(excluded)}</p>
                </div>
                <div className="glass-soft rounded-2xl border border-white/[0.06] p-4">
                  <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">USD-native leg</p>
                  <p className="mt-2 font-mono text-lg text-ink">{usdPct.toFixed(1)}%</p>
                  <p className="mt-1 text-[10px] text-muted">FX on USD-denominated lines</p>
                </div>
                <div className="glass-soft rounded-2xl border border-white/[0.06] p-4">
                  <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">Missing cost</p>
                  <p className="mt-2 font-mono text-lg text-ink">{missingN} lines</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="md:col-span-4">
          <ShieldHealthCard data={data} />
        </div>
      </section>

      <TodaySleevePerformance holdings={data.holdings} total_book_inr={data.totals.market_value} />

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="glass max-h-[92px] rounded-2xl border border-white/[0.09] px-4 py-3 shadow-[0_18px_70px_rgba(0,0,0,0.55)]">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">Day move</p>
          <p
            className={`mt-1 font-mono text-xl ${
              data.totals.day_change_value >= 0 ? "text-gain-muted" : "text-loss-muted"
            }`}
          >
            {data.totals.day_change_value >= 0 ? "+" : ""}
            {formatInr(data.totals.day_change_value)}
          </p>
          {data.totals.day_change_pct != null ? (
            <p className="mt-0.5 font-mono text-[10px] text-muted">
              {data.totals.day_change_pct >= 0 ? "+" : ""}
              {data.totals.day_change_pct.toFixed(2)}%
            </p>
          ) : (
            <p className="mt-0.5 text-[10px] text-muted">Intraday % n/a</p>
          )}
        </div>
        <div className="glass max-h-[92px] rounded-2xl border border-white/[0.09] px-4 py-3 shadow-[0_18px_70px_rgba(0,0,0,0.55)]">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">Drawdown</p>
          {ddReady ? (
            <p className="mt-1 font-mono text-xl text-loss-muted">{dd.toFixed(1)}%</p>
          ) : (
            <p className="mt-1 text-xs text-muted">Snapshots building</p>
          )}
        </div>
        <div className="glass max-h-[92px] rounded-2xl border border-white/[0.09] px-4 py-3 shadow-[0_18px_70px_rgba(0,0,0,0.55)]">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">Breaches</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xl text-ink">{breaches}</span>
            {data.alerts.concentration[0] ? (
              firstConcHolding ? (
                <button
                  type="button"
                  title="Open in inspector"
                  onClick={() => setInspectorHolding(firstConcHolding)}
                  className="rounded-full border border-ion/30 bg-ion/10 px-2 py-0.5 text-[10px] font-medium text-ion transition hover:border-ion/50"
                >
                  {data.alerts.concentration[0].name.slice(0, 14)}
                  {data.alerts.concentration[0].name.length > 14 ? "…" : ""}
                </button>
              ) : (
                <Link
                  href="/decide#concentration"
                  className="rounded-full border border-ion/30 bg-ion/10 px-2 py-0.5 text-[10px] font-medium text-ion hover:border-ion/50"
                >
                  {data.alerts.concentration[0].name.slice(0, 14)}
                  {data.alerts.concentration[0].name.length > 14 ? "…" : ""}
                </Link>
              )
            ) : null}
            {data.alerts.missing_cost_basis.length > 0 ? (
              firstMissingHolding ? (
                <button
                  type="button"
                  title="Open in inspector"
                  onClick={() => setInspectorHolding(firstMissingHolding)}
                  className="rounded-full border border-white/[0.12] px-2 py-0.5 text-[10px] text-muted transition hover:border-ion/35 hover:text-ink"
                >
                  Missing cost
                </button>
              ) : (
                <Link
                  href="/decide#cost"
                  className="rounded-full border border-white/[0.12] px-2 py-0.5 text-[10px] text-muted hover:border-ion/35"
                >
                  Missing cost
                </Link>
              )
            ) : null}
            {data.alerts.stale_data ? (
              <span className="rounded-full border border-ember/30 px-2 py-0.5 text-[10px] text-ember/90">Stale</span>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
