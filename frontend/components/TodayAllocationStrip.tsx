"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { AllocationSlice } from "@/lib/types";

const COLORS = [
  "rgba(110,168,255,0.95)",
  "rgba(104,215,198,0.95)",
  "rgba(255,204,102,0.95)",
  "rgba(255,125,154,0.9)",
  "#8b7ab8",
  "#5a6b82",
  "#4a6fa5",
];

type Tab = "asset" | "country" | "currency";

function slicesFor(
  tab: Tab,
  by_asset_type: AllocationSlice[],
  by_currency: AllocationSlice[],
  by_country: AllocationSlice[],
): AllocationSlice[] {
  if (tab === "asset") return by_asset_type;
  if (tab === "country") return by_country;
  return by_currency;
}

/** Deep link to Map exposure: `/map?focus=<tab>&key=<encodeURIComponent(slice.key)>`. Map scrolls to Exposure and highlights the row; no separate backend filter. */
export function mapExposureHref(tab: Tab, sliceKey: string): string {
  return `/map?focus=${encodeURIComponent(tab)}&key=${encodeURIComponent(sliceKey)}`;
}

export function TodayAllocationStrip({
  by_asset_type,
  by_currency,
  by_country,
}: {
  by_asset_type: AllocationSlice[];
  by_currency: AllocationSlice[];
  by_country: AllocationSlice[];
}) {
  const [tab, setTab] = useState<Tab>("asset");

  const sorted = useMemo(() => {
    const src = slicesFor(tab, by_asset_type, by_currency, by_country);
    return [...src].sort((a, b) => b.pct - a.pct);
  }, [tab, by_asset_type, by_currency, by_country]);

  const top = sorted[0];
  const insight =
    top && top.pct > 70 ? `Largest sleeve is ${top.key} at ${top.pct.toFixed(1)}% of this view.` : null;

  return (
    <section className="glass rounded-3xl border border-white/[0.09] p-6 md:p-7 shadow-[0_18px_70px_rgba(0,0,0,0.55)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted">Map</p>
          <h2 className="mt-2 font-display text-2xl text-ink">Where is my money?</h2>
          <p className="mt-1 text-sm text-muted">
            Tap a slice to open Map on Exposure with that row highlighted. This is a client deep link only.
          </p>
        </div>
        <div
          className="inline-flex shrink-0 rounded-2xl border border-white/[0.06] bg-black/25 p-1"
          role="tablist"
          aria-label="Exposure slice"
        >
          {(["asset", "country", "currency"] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                tab === id
                  ? "border border-ion/25 bg-ion/15 text-ink"
                  : "text-muted hover:text-ink/90"
              }`}
            >
              {id === "asset" ? "Asset" : id === "country" ? "Country" : "Currency"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/[0.06] bg-black/30 p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-muted">
          <span>Active view allocation</span>
          <span className="font-mono">100%</span>
        </div>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted">No positions in this view.</p>
        ) : (
          <>
            <div className="flex h-3 overflow-hidden rounded-full bg-white/[0.06]" aria-label="Allocation by slice">
              {sorted.slice(0, 8).map((s, i) => (
                <Link
                  key={s.key}
                  href={mapExposureHref(tab, s.key)}
                  className="block h-full min-h-[12px] min-w-[8px] flex-shrink-0 rounded-sm outline-none ring-offset-0 transition-[flex-grow] focus-visible:ring-2 focus-visible:ring-ion/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0d14] motion-reduce:transition-none"
                  style={{
                    width: `${s.pct}%`,
                    backgroundColor: COLORS[i % COLORS.length],
                  }}
                  title={`${s.key} ${s.pct.toFixed(1)}% · open Map`}
                  aria-label={`Open Map, Exposure, ${s.key}`}
                />
              ))}
            </div>
            <ul className="mt-4 grid gap-2 md:grid-cols-2">
              {sorted.slice(0, 4).map((s, i) => (
                <li key={s.key}>
                  <Link
                    href={mapExposureHref(tab, s.key)}
                    className="flex items-center justify-between gap-2 rounded-xl px-2 py-2 text-sm outline-none transition hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-ion/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0d14]"
                    aria-label={`Open Map focused on ${s.key}`}
                  >
                    <span className="flex min-w-0 items-center gap-2 text-ink/90">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        aria-hidden
                      />
                      <span className="truncate">{s.key}</span>
                    </span>
                    <span className="shrink-0 font-mono text-muted">{s.pct.toFixed(1)}%</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {insight ? <p className="mt-3 text-xs text-warn-muted/95">{insight}</p> : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted/70">Values follow your active portfolio view.</p>
        <Link href="/map" className="text-xs font-medium text-ion transition hover:text-ion/80">
          Open full map
        </Link>
      </div>
    </section>
  );
}
