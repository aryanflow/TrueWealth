"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { labelSlice, sleeveColor } from "@/lib/assetLabels";
import { mapExposureHref } from "@/lib/mapLinks";
import { formatPct1 } from "@/lib/format";
import { MoneyValue } from "@/components/MoneyValue";
import type { AllocationSlice } from "@/lib/types";

export function ExposureSpine({
  slices,
  kind = "asset",
  mapBase = "/map",
}: {
  slices: AllocationSlice[];
  kind?: "asset" | "country" | "currency";
  mapBase?: string;
}) {
  const sorted = useMemo(
    () => [...slices].filter((s) => s.pct > 0.0001).sort((a, b) => b.pct - a.pct),
    [slices],
  );
  const [focus, setFocus] = useState<string | null>(null);

  const toggle = useCallback((key: string) => {
    setFocus((f) => (f === key ? null : key));
  }, []);

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted">
        No sleeves in this view yet. Connect your book or widen the active view in Settings.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-semibold text-ink">Exposure spine</h3>
        <span className="font-mono text-[11px] text-muted">click a sleeve to focus</span>
      </div>

      <div
        className="flex h-14 overflow-hidden rounded-xl border border-line bg-ink-bg motion-safe:animate-none"
        aria-label="Allocation spine"
      >
        {sorted.map((s, i) => {
          const dim = focus != null && focus !== s.key;
          const showPct = s.pct >= 5;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              className={`group relative flex h-full min-w-[6px] items-center justify-center border-0 p-0 transition-[filter,opacity] duration-300 motion-reduce:transition-none focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peri/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
                dim ? "saturate-[0.35] brightness-[0.72]" : "hover:brightness-110"
              } ${focus === s.key ? "ring-2 ring-inset ring-brass/60" : ""}`}
              style={{
                width: `${s.pct}%`,
                backgroundColor: sleeveColor(s.key, i),
                animation: "spine-grow 1.1s cubic-bezier(0.6,0,0.2,1) forwards",
                animationDelay: `${i * 70}ms`,
              }}
              title={`${labelSlice(s.key, kind)} ${formatPct1(s.pct)}`}
              aria-pressed={focus === s.key}
              aria-label={`${labelSlice(s.key, kind)}, ${formatPct1(s.pct)} of book`}
            >
              <span
                className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/15 to-transparent"
                aria-hidden
              />
              {showPct ? (
                <span className="relative font-mono text-[11px] font-semibold text-ink-bg mix-blend-hard-light">
                  {formatPct1(s.pct)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-t border-line">
        {sorted.map((s, i) => {
          const selected = focus === s.key;
          const dim = focus != null && !selected;
          return (
            <div
              key={s.key}
              className={`grid grid-cols-[18px_1fr_auto_auto] items-center gap-3 border-b border-line px-1.5 py-3 transition-colors ${
                selected ? "bg-brass/[0.06] shadow-[inset_2px_0_0_0] shadow-brass" : ""
              } ${dim ? "opacity-45" : ""}`}
            >
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: sleeveColor(s.key, i) }}
                aria-hidden
              />
              <button
                type="button"
                onClick={() => toggle(s.key)}
                className="min-w-0 text-left font-mono text-[13px] text-ink transition hover:text-brass-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peri/60"
              >
                {labelSlice(s.key, kind)}
              </button>
              <span className="min-w-[3rem] text-right font-mono text-[13px] text-muted">{formatPct1(s.pct)}</span>
              <Link
                href={mapExposureHref(kind, s.key)}
                className="min-w-[7.5rem] text-right font-mono text-[13px] text-mint transition hover:text-mint/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peri/60"
              >
                <MoneyValue inr={s.value} className="text-mint" />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
