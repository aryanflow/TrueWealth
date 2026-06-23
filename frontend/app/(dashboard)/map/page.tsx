"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { DecisionCharts } from "@/components/DecisionCharts";
import { DonutAllocation } from "@/components/DonutAllocation";
import { ExposureCard } from "@/components/ExposureCard";
import { FundLabSection } from "@/components/FundLabSection";
import { HoldingsTable } from "@/components/HoldingsTable";
import { usePortfolio } from "@/components/PortfolioContext";
import { formatInr } from "@/lib/format";
import type { NormalizedHolding } from "@/lib/types";

function bookInr(h: NormalizedHolding): number {
  const v = h.inr_market_value;
  if (v != null && v > 0) return v;
  return h.market_value;
}

function MapPageInner() {
  const searchParams = useSearchParams();
  const focus = searchParams.get("focus");
  const key = searchParams.get("key");
  const focusKey = `${focus ?? ""}|${key ?? ""}`;

  const exposureAnchorRef = useRef<HTMLDivElement>(null);
  const { data, err, loading, thr, setInspectorHolding, openHoldingById, reload } = usePortfolio();
  const [tableOpen, setTableOpen] = useState(false);
  const [columnPreset, setColumnPreset] = useState<"simple" | "pro">("simple");

  const thrNum = parseFloat(thr) || 15;

  const totalInrActive = useMemo(() => {
    if (!data) return 0;
    return data.holdings.reduce((s, h) => s + bookInr(h), 0);
  }, [data]);

  useEffect(() => {
    if (!focus && !key) return;
    const el = exposureAnchorRef.current ?? document.getElementById("map-exposure");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusKey, focus, key]);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="h-40 rounded-2xl bg-line/40" />
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

  const excluded = data.meta.excluded_value ?? 0;
  const viewName = data.meta.active_view?.name ?? "All assets";

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-10 md:space-y-10">
      {excluded > 0.01 ? (
        <div className="rounded-xl border border-warn-muted/25 bg-warn-muted/10 px-4 py-3 text-sm text-ink/90">
          <p>
            <span className="font-medium text-ink">{formatInr(excluded)}</span> of the full INR book is outside the active
            view <span className="text-muted">({viewName})</span> — US stocks, FDs, or other toggled sleeves may be hidden.
            Edit sleeves in <strong className="text-ink">Settings</strong> (header gear) → Views.
          </p>
          {data.allocation_full_book ? (
            <p className="mt-2 text-xs text-muted">
              Full-book asset mix is available on the API as <span className="font-mono text-ink/80">allocation_full_book</span>{" "}
              for comparison with the active view slices.
            </p>
          ) : null}
        </div>
      ) : null}

      <div ref={exposureAnchorRef} className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <ExposureCard
          by_asset_type={data.allocation.by_asset_type}
          by_currency={data.allocation.by_currency}
          by_country={data.allocation.by_country}
          initialTab={focus}
          highlightKey={key}
        />
        <section className="rounded-xl border border-line bg-surface/60 p-4 shadow-card">
          <h3 className="font-display text-lg text-ink">Allocation donut</h3>
          <p className="mt-1 text-xs text-muted">Same sleeves as exposure · active view</p>
          <div className="mt-2">
            <DonutAllocation slices={data.allocation.by_asset_type} />
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-1">
        <DecisionCharts
          history={data.history}
          holdings={data.holdings}
          thresholdPct={thrNum}
          meta={data.meta}
          totalInrActive={totalInrActive}
          highlightHoldingId={null}
          onSelectHolding={(id) => openHoldingById(id)}
          alerts={data.alerts}
        />
      </div>

      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
        {!tableOpen ? (
          <button
            type="button"
            onClick={() => {
              setColumnPreset("pro");
              setTableOpen(true);
            }}
            className="w-full min-w-0 rounded-2xl border border-hairline bg-surface-elevated/40 px-4 py-4 text-left text-sm font-medium text-ink hover:border-ion/35"
          >
            Show holdings ({data.holdings.length}) — opens pro columns
          </button>
        ) : (
          <HoldingsTable
            holdings={data.holdings}
            onRowClick={(h) => setInspectorHolding(h)}
            columnPreset={columnPreset}
            columnPresetControl={{ value: columnPreset, onChange: setColumnPreset }}
          />
        )}
      </div>

      <FundLabSection funds={data.mf_lab} onAfterMfRefresh={() => void reload().catch(() => {})} />
    </main>
  );
}

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 py-12">
          <div className="h-40 rounded-2xl bg-line/40" />
        </main>
      }
    >
      <MapPageInner />
    </Suspense>
  );
}
