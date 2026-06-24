"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { labelSlice, sleeveColor } from "@/lib/assetLabels";
import { formatPct1 } from "@/lib/format";
import { mapExposureHref } from "@/lib/mapLinks";
import type { AllocationSlice } from "@/lib/types";

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
    top && top.pct > 70
      ? `Largest sleeve is ${labelSlice(top.key, tab)} at ${formatPct1(top.pct)} of this view.`
      : null;

  return (
    <section className="panel-card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow !mb-2">Map preview</p>
          <h2 className="section-title">Where is my money?</h2>
          <p className="section-sub">Tap a slice — Map opens on Exposure with that row highlighted.</p>
        </div>
        <div className="inline-flex shrink-0 rounded-lg border border-line bg-ink-bg p-1" role="tablist">
          {(["asset", "country", "currency"] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`min-h-9 rounded-md px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peri/60 ${
                tab === id ? "bg-panel2 text-brass-soft" : "text-muted-dim hover:text-ink"
              }`}
            >
              {id === "asset" ? "Asset" : id === "country" ? "Country" : "Currency"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-ink-bg/50 p-4">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted">No positions in this view.</p>
        ) : (
          <>
            <div className="flex h-3.5 overflow-hidden rounded-lg border border-line" aria-label="Allocation by slice">
              {sorted.slice(0, 8).map((s, i) => (
                <Link
                  key={s.key}
                  href={mapExposureHref(tab, s.key)}
                  className="block h-full min-w-[8px] flex-shrink-0 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peri/60"
                  style={{ width: `${s.pct}%`, backgroundColor: sleeveColor(s.key, i) }}
                  title={`${labelSlice(s.key, tab)} ${formatPct1(s.pct)}`}
                />
              ))}
            </div>
            <ul className="mt-4 grid gap-2 md:grid-cols-2">
              {sorted.slice(0, 4).map((s, i) => (
                <li key={s.key}>
                  <Link href={mapExposureHref(tab, s.key)} className="link-action flex justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: sleeveColor(s.key, i) }} />
                      <span className="truncate text-ink">{labelSlice(s.key, tab)}</span>
                    </span>
                    <span className="font-mono text-muted">{formatPct1(s.pct)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {insight ? <p className="mt-3 text-xs text-warn">{insight}</p> : null}
    </section>
  );
}
