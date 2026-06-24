"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo } from "react";

import { ActionPlanPanel } from "@/components/ActionPlanPanel";
import { usePortfolio } from "@/components/PortfolioContext";
import { summarizeAlerts } from "@/lib/alertSummary";
import { holdingDisambiguator } from "@/lib/assetLabels";
import { formatInr, formatPct1 } from "@/lib/format";

function DecidePageInner() {
  const { data, err, loading, setInspectorHolding, thr } = usePortfolio();
  const router = useRouter();
  const search = useSearchParams();

  useEffect(() => {
    const hid = search.get("holding");
    if (!hid || search.has("trimPct")) return;
    if (!data) return;
    const h = data.holdings.find((x) => x.id === hid);
    if (!h) return;
    setInspectorHolding(h);
    const clean = new URL(window.location.href);
    clean.searchParams.delete("holding");
    const next = `${clean.pathname}${clean.search}${clean.hash || ""}`;
    router.replace(next);
  }, [search, data, router, setInspectorHolding]);

  const usdPct = data?.usd_exposure_pct ?? data?.allocation.by_currency.find((s) => s.key === "USD")?.pct ?? 0;
  const offshorePct = data?.global_equity_offshore_pct ?? 0;

  const costHoldings = useMemo(() => {
    if (!data) return [];
    const n = summarizeAlerts(data.alerts, data.meta, data.holdings).missingCostHoldings;
    if (n <= 0) return [];
    const seen = new Set<string>();
    const out: { key: string; label: string; id?: string }[] = [];
    for (const name of data.alerts.missing_cost_basis) {
      const matches = data.holdings.filter((h) => h.name === name);
      if (matches.length === 0) {
        if (!seen.has(name)) {
          seen.add(name);
          out.push({ key: name, label: name });
        }
        continue;
      }
      for (const h of matches) {
        const label = holdingDisambiguator(h);
        if (seen.has(label)) continue;
        seen.add(label);
        out.push({ key: `${h.id}-${label}`, label, id: h.id });
      }
    }
    return out;
  }, [data]);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 md:px-7">
        <div className="h-48 rounded-[20px] bg-panel2" />
      </main>
    );
  }

  if (err || !data) {
    return (
      <main className="mx-auto max-w-lg px-4 py-24 text-center md:px-7">
        <h1 className="font-display text-2xl text-ink">Could not load portfolio</h1>
        <p className="mt-2 text-muted">{err ?? "Unknown error"}</p>
      </main>
    );
  }

  const fxMode = data.meta.data_completeness?.fx_mode ?? "static";

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-10 pb-20 md:px-7 md:py-[42px]">
      <div className="eyebrow">Decide · the ranked plan</div>

      <section id="concentration" className="panel-card scroll-mt-28">
        <h2 className="flex items-center gap-3 font-display text-[22px] font-semibold text-ink">
          <span className="rounded-md border border-brass-dim px-2 py-0.5 font-mono text-xs font-normal text-brass">
            01
          </span>
          Action plan
        </h2>
        <Suspense fallback={<div className="mt-4 h-24 animate-pulse rounded-lg bg-panel2" />}>
          <div className="mt-4">
            <ActionPlanPanel items={data.action_plan} holdings={data.holdings} embedded />
          </div>
        </Suspense>
      </section>

      <section id="rules" className="panel-card scroll-mt-28">
        <h2 className="flex items-center gap-3 font-display text-[22px] font-semibold text-ink">
          <span className="rounded-md border border-brass-dim px-2 py-0.5 font-mono text-xs font-normal text-brass">
            02
          </span>
          Guardrails
        </h2>
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
          Single-name concentration threshold:{" "}
          <span className="rounded bg-brass/10 px-1.5 py-0.5 font-mono text-brass-soft">{thr}%</span>
          {data.alerts.concentration.length > 0 ? (
            <>
              {" "}
              — <strong className="text-ink">{data.alerts.concentration.length}</strong> position
              {data.alerts.concentration.length === 1 ? "" : "s"} above this line on Map charts and the action plan.
            </>
          ) : (
            <> — no positions above this line in the active view.</>
          )}
        </p>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("tw-open-settings"))}
          className="link-action mt-3 inline-flex text-sm"
        >
          Adjust in Settings → Guardrails
        </button>
      </section>

      <section id="cost" className="panel-card scroll-mt-28">
        <h2 className="flex items-center gap-3 font-display text-[22px] font-semibold text-ink">
          <span className="rounded-md border border-brass-dim px-2 py-0.5 font-mono text-xs font-normal text-brass">
            03
          </span>
          Cost basis
        </h2>
        {costHoldings.length > 0 ? (
          <>
            <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
              <strong className="text-ink">{costHoldings.length} holding{costHoldings.length === 1 ? "" : "s"}</strong>{" "}
              still need cost basis for full PnL. If they stay blank after a sync, open{" "}
              <strong className="text-ink">Settings → Refresh now</strong> so the data agent can refill averages.
            </p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {costHoldings.slice(0, 12).map((row) => (
                <li key={row.key}>
                  {row.id ? (
                    <Link
                      href={`/decide?holding=${encodeURIComponent(row.id)}#cost`}
                      className="flex min-h-12 items-center gap-3 rounded-[11px] border border-line bg-ink-bg px-4 py-3 text-[13px] text-ink transition hover:border-coral/50 hover:bg-coral/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peri/60"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full bg-coral shadow-[0_0_8px] shadow-coral" aria-hidden />
                      <span className="min-w-0 flex-1 leading-snug">{row.label}</span>
                      <span className="text-muted-dim" aria-hidden>
                        →
                      </span>
                    </Link>
                  ) : (
                    <div className="flex min-h-12 items-center gap-3 rounded-[11px] border border-line bg-ink-bg px-4 py-3 text-[13px] text-muted">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-coral" aria-hidden />
                      {row.label}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-3 flex items-center gap-3 text-[13.5px] text-muted">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-mint text-mint">✓</span>
            Cost basis looks complete for this pass — PnL lines should be trustworthy where shown.
          </p>
        )}
      </section>

      <section id="fx" className="panel-card scroll-mt-28">
        <h2 className="flex items-center gap-3 font-display text-[22px] font-semibold text-ink">
          <span className="rounded-md border border-brass-dim px-2 py-0.5 font-mono text-xs font-normal text-brass">
            04
          </span>
          FX &amp; offshore equity
        </h2>
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
          <strong className="text-ink">Offshore global equity</strong> (US-listed stocks + US ETFs) is about{" "}
          <span className="rounded bg-brass/10 px-1.5 py-0.5 font-mono text-brass-soft">{formatPct1(offshorePct)}</span>{" "}
          of the active INR book. The <strong className="text-ink">USD-native leg</strong> (USD-denominated market
          value) is{" "}
          <span className="rounded bg-brass/10 px-1.5 py-0.5 font-mono text-brass-soft">{formatPct1(usdPct)}</span>. FX
          mode:{" "}
          <span className="rounded bg-brass/10 px-1.5 py-0.5 font-mono text-brass-soft">{fxMode}</span>.
        </p>
        <p className="mt-3 text-[12.5px] text-muted-dim">
          Tax lots, STT/LTCG, and per-name hedges are not modeled here — see README for scope.
        </p>
      </section>
    </main>
  );
}

export default function DecidePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl px-4 py-12 md:px-7">
          <div className="h-48 rounded-[20px] bg-panel2" />
        </main>
      }
    >
      <DecidePageInner />
    </Suspense>
  );
}
