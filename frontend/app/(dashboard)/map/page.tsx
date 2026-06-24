"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { DecisionCharts } from "@/components/DecisionCharts";
import { DonutAllocation } from "@/components/DonutAllocation";
import { ExposureCard } from "@/components/ExposureCard";
import { FundLabSection } from "@/components/FundLabSection";
import { HoldingsTable } from "@/components/HoldingsTable";
import { usePortfolio } from "@/components/PortfolioContext";
import { labelSlice } from "@/lib/assetLabels";
import { formatInr } from "@/lib/format";
import { filterHoldingsBySleeve, type SleeveId } from "@/lib/sleeves";
import type { NormalizedHolding } from "@/lib/types";

function bookInr(h: NormalizedHolding): number {
  const v = h.inr_market_value;
  if (v != null && v > 0) return v;
  return h.market_value;
}

const SLEEVE_LABELS: Record<SleeveId, string> = {
  mutual_funds: "Mutual funds",
  fixed_deposits: "Fixed deposits",
  retirement: "EPF & retirement",
  indian_equity: "Indian stocks",
  crypto: "Crypto",
  us_equity: "US stocks",
};

function parseSleeve(raw: string | null): SleeveId | null {
  if (!raw) return null;
  const ids = Object.keys(SLEEVE_LABELS) as SleeveId[];
  return ids.includes(raw as SleeveId) ? (raw as SleeveId) : null;
}

function MapPageInner() {
  const searchParams = useSearchParams();
  const focus = searchParams.get("focus");
  const key = searchParams.get("key");
  const sleeve = parseSleeve(searchParams.get("sleeve"));
  const openHoldings = searchParams.get("holdings") === "1";
  const focusHoldingId = searchParams.get("holding");
  const focusKey = `${focus ?? ""}|${key ?? ""}|${sleeve ?? ""}|${openHoldings}|${focusHoldingId ?? ""}`;

  const exposureAnchorRef = useRef<HTMLDivElement>(null);
  const holdingsAnchorRef = useRef<HTMLDivElement>(null);
  const { data, err, loading, thr, setInspectorHolding, openHoldingById, reload } = usePortfolio();
  const [tableOpen, setTableOpen] = useState(openHoldings);
  const [columnPreset, setColumnPreset] = useState<"simple" | "pro">("pro");
  const [donutFocus, setDonutFocus] = useState<string | null>(null);

  const thrNum = parseFloat(thr) || 15;

  const holdingsForTable = useMemo(() => {
    if (!data) return [];
    if (!sleeve) return data.holdings;
    return filterHoldingsBySleeve(data.holdings, sleeve);
  }, [data, sleeve]);

  const totalInrActive = useMemo(() => {
    return holdingsForTable.reduce((s, h) => s + bookInr(h), 0);
  }, [holdingsForTable]);

  useEffect(() => {
    if (openHoldings || focusHoldingId) {
      setTableOpen(true);
      const t = window.setTimeout(() => {
        if (focusHoldingId) {
          const row = document.getElementById(`holding-row-${focusHoldingId}`);
          row?.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          holdingsAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 120);
      return () => window.clearTimeout(t);
    }
    if (focus || key) {
      exposureAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [focusKey, focus, key, openHoldings, focusHoldingId]);

  useEffect(() => {
    if (!focusHoldingId || !data) return;
    openHoldingById(focusHoldingId);
  }, [focusHoldingId, data, openHoldingById]);

  useEffect(() => {
    if (key) {
      try {
        setDonutFocus(decodeURIComponent(key));
      } catch {
        setDonutFocus(key);
      }
    }
  }, [key]);

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 md:px-7">
        <div className="h-40 animate-pulse rounded-[20px] bg-panel2" />
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

  const excluded = data.meta.excluded_value ?? 0;
  const viewName = data.meta.active_view?.name ?? "All assets";

  return (
    <main className="mx-auto max-w-7xl space-y-10 px-4 py-10 pb-20 md:px-7 md:py-[42px]">
      <div className="eyebrow">Map · where is my money</div>
      <div>
        <h1 className="section-title">The exposure atlas</h1>
        <p className="section-sub">
          Same sleeves, three lenses — plus holdings filtered when you arrive from a sleeve card on Today.
        </p>
      </div>

      {sleeve ? (
        <div className="rounded-xl border border-peri/30 bg-peri/10 px-4 py-3 text-sm text-ink">
          <strong>{SLEEVE_LABELS[sleeve]}</strong> — showing {holdingsForTable.length} holding
          {holdingsForTable.length === 1 ? "" : "s"} in this sleeve
          {key ? (
            <>
              {" "}
              · exposure slice <span className="font-mono text-peri">{labelSlice(key, "asset")}</span>
            </>
          ) : null}
        </div>
      ) : null}

      {excluded > 0.01 ? (
        <div className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-ink">
          <p>
            <span className="font-mono font-medium">{formatInr(excluded)}</span> outside active view{" "}
            <span className="text-muted">({viewName})</span>. Edit in <strong>Settings → Views</strong>.
          </p>
        </div>
      ) : null}

      <div id="map-exposure" ref={exposureAnchorRef} className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <ExposureCard
          by_asset_type={data.allocation.by_asset_type}
          by_currency={data.allocation.by_currency}
          by_country={data.allocation.by_country}
          initialTab={focus}
          highlightKey={key}
        />
        <section className="panel-card">
          <h3 className="font-display text-lg font-semibold text-ink">Allocation</h3>
          <p className="mt-1 font-mono text-xs text-muted-dim">active view · share of book</p>
          <div className="mt-4">
            <DonutAllocation
              slices={data.allocation.by_asset_type}
              kind="asset"
              focusKey={donutFocus}
              onFocus={setDonutFocus}
            />
          </div>
        </section>
      </div>

      <DecisionCharts
        history={data.history}
        holdings={sleeve ? holdingsForTable : data.holdings}
        thresholdPct={thrNum}
        meta={data.meta}
        totalInrActive={totalInrActive}
        highlightHoldingId={focusHoldingId}
        onSelectHolding={(id) => openHoldingById(id)}
        alerts={data.alerts}
      />

      <div
        id="map-holdings"
        ref={holdingsAnchorRef}
        className="-mx-4 scroll-mt-28 px-4 md:mx-0 md:px-0"
      >
        {!tableOpen ? (
          <button
            type="button"
            onClick={() => {
              setColumnPreset("pro");
              setTableOpen(true);
            }}
            className="btn-ghost w-full justify-between !px-5 !py-4 text-left hover:border-peri/40"
          >
            <span>
              Show holdings ({sleeve ? holdingsForTable.length : data.holdings.length}
              {sleeve ? ` · ${SLEEVE_LABELS[sleeve]}` : ""})
            </span>
            <span className="text-muted-dim">tap rows for inspector →</span>
          </button>
        ) : (
          <HoldingsTable
            holdings={holdingsForTable}
            highlightHoldingId={focusHoldingId}
            onRowClick={(h) => setInspectorHolding(h)}
            columnPreset={columnPreset}
            columnPresetControl={{ value: columnPreset, onChange: setColumnPreset }}
            exportFilename={sleeve ? `true-wealth-${sleeve}` : "true-wealth-holdings"}
            title={sleeve ? `${SLEEVE_LABELS[sleeve]} holdings` : "Holdings"}
            syncUrl
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
        <main className="mx-auto max-w-7xl px-4 py-12 md:px-7">
          <div className="h-40 rounded-[20px] bg-panel2" />
        </main>
      }
    >
      <MapPageInner />
    </Suspense>
  );
}
