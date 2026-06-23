"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo } from "react";

import { ActionPlanPanel } from "@/components/ActionPlanPanel";
import { usePortfolio } from "@/components/PortfolioContext";

function DecidePageInner() {
  const { data, err, loading, setInspectorHolding } = usePortfolio();
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

  const costNote = useMemo(() => {
    if (!data?.alerts.missing_cost_basis.length) return null;
    return `${data.alerts.missing_cost_basis.length} names still need cost basis for full PnL.`;
  }, [data]);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="h-48 rounded-2xl bg-line/40" />
      </main>
    );
  }

  if (err || !data) {
    return (
      <main className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-display text-2xl text-ink">Could not load portfolio</h1>
        <p className="mt-2 text-muted">{err ?? "Unknown error"}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-10 md:space-y-8">
      <section id="concentration" className="scroll-mt-24">
        <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-line/40" />}>
          <ActionPlanPanel items={data.action_plan} holdings={data.holdings} />
        </Suspense>
      </section>

      <section id="cost" className="scroll-mt-24 space-y-3 rounded-2xl border border-hairline bg-surface-elevated/40 px-5 py-6">
        <h2 className="font-display text-lg text-ink">Cost basis</h2>
        <p className="text-sm text-muted">
          {costNote ?? "No missing cost flags in this pass. PnL lines should be trustworthy where shown."}
        </p>
        <p className="text-xs text-muted">
          If names stay blank after a refresh, open <span className="font-medium text-ink">Settings</span> (top-right)
          and run <span className="font-medium text-ink">Refresh now</span> so MCP can refill averages.
        </p>
        {data.alerts.missing_cost_basis.length > 0 ? (
          <ul className="mt-4 max-h-48 list-disc space-y-1 overflow-y-auto pl-5 text-sm text-muted">
            {data.alerts.missing_cost_basis.slice(0, 12).map((n) => {
              const hid = data.holdings.find((h) => h.name === n)?.id;
              return (
                <li key={n}>
                  {hid ? (
                    <Link
                      href={`/decide?holding=${encodeURIComponent(hid)}#cost`}
                      className="text-ion underline-offset-2 hover:text-ion/85"
                    >
                      {n}
                    </Link>
                  ) : (
                    n
                  )}
                </li>
              );
            })}
            {data.alerts.missing_cost_basis.length > 12 ? (
              <li className="list-none pl-0 text-xs">+{data.alerts.missing_cost_basis.length - 12} more</li>
            ) : null}
          </ul>
        ) : null}
      </section>

      <section id="fx" className="scroll-mt-24 space-y-3 rounded-2xl border border-hairline bg-surface-elevated/40 px-5 py-6">
        <h2 className="font-display text-lg text-ink">FX & offshore equity</h2>
        <p className="text-sm leading-relaxed text-muted">
          <span className="font-medium text-ink">Offshore global equity</span> (US-listed stocks + US ETFs) is about{" "}
          <span className="font-mono text-ink">{offshorePct.toFixed(1)}%</span> of the active INR book. The{" "}
          <span className="font-medium text-ink">USD-native leg</span> (USD-denominated MV lines) is{" "}
          <span className="font-mono text-ink">{usdPct.toFixed(1)}%</span>. FX mode:{" "}
          <span className="font-mono text-ink">{data.meta.data_completeness?.fx_mode ?? "static"}</span>.
        </p>
        <p className="text-xs text-muted">
          Tax lots, STT/LTCG, and per-name hedges are not modeled here—see README for scope.
        </p>
      </section>
    </main>
  );
}

export default function DecidePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 py-12">
          <div className="h-48 rounded-2xl bg-line/40" />
        </main>
      }
    >
      <DecidePageInner />
    </Suspense>
  );
}
