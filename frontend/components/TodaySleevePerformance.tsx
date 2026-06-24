"use client";

import Link from "next/link";
import { useMemo } from "react";

import { MoneyValue } from "@/components/MoneyValue";
import { sleeveColor } from "@/lib/assetLabels";
import { deriveIntradayStatus, intradayUnavailableCopy } from "@/lib/intraday";
import { mapSleeveHoldingsHref } from "@/lib/mapLinks";
import { classifySleeve, filterHoldingsBySleeve, type SleeveId } from "@/lib/sleeves";
import { formatPct } from "@/lib/format";
import type { NormalizedHolding } from "@/lib/types";

function bookInr(h: NormalizedHolding): number {
  const v = h.inr_market_value;
  if (v != null && v > 0) return v;
  return h.market_value;
}

function dayInr(h: NormalizedHolding): number {
  return h.inr_day_change_value ?? h.day_change_value ?? 0;
}

function unrealInr(h: NormalizedHolding): number | null {
  const u = h.inr_unrealized_pnl ?? h.unrealized_pnl;
  return u != null ? u : null;
}

const SLEEVE_META: Record<
  SleeveId,
  { label: string; tagline: string; mapKey: string }
> = {
  mutual_funds: { label: "Mutual funds", tagline: "MFs in this view", mapKey: "MF" },
  fixed_deposits: { label: "Fixed deposits", tagline: "FD & RD", mapKey: "FD" },
  retirement: { label: "EPF & retirement", tagline: "EPF, NPS, PPF", mapKey: "EPF" },
  indian_equity: { label: "Indian stocks", tagline: "Listed India · incl. ETFs", mapKey: "IN_STOCK" },
  crypto: { label: "Crypto", tagline: "Digital assets", mapKey: "CRYPTO" },
  us_equity: { label: "US stocks", tagline: "US listings · incl. ETFs", mapKey: "US_STOCK" },
};

const SLEEVE_ORDER: SleeveId[] = [
  "mutual_funds",
  "fixed_deposits",
  "retirement",
  "indian_equity",
  "crypto",
  "us_equity",
];

function buildRollups(holdings: NormalizedHolding[], total_book_inr: number) {
  return SLEEVE_ORDER.map((id) => {
    const lines = filterHoldingsBySleeve(holdings, id);
    const meta = SLEEVE_META[id];
    let book = 0;
    let day = 0;
    let unreal = 0;
    let unreal_lines = 0;
    let prev = 0;
    for (const h of lines) {
      const mv = bookInr(h);
      book += mv;
      day += dayInr(h);
      prev += mv - dayInr(h);
      const u = unrealInr(h);
      if (u != null) {
        unreal += u;
        unreal_lines += 1;
      }
    }
    const day_pct_est = prev > 1 ? (day / prev) * 100 : null;
    const unreal_na = lines.length > 0 && unreal_lines === 0;
    const unreal_partial = unreal_lines > 0 && unreal_lines < lines.length;
    return {
      id,
      label: meta.label,
      tagline: meta.tagline,
      count: lines.length,
      book_inr: book,
      day_inr: day,
      day_pct_est,
      unreal_inr: unreal_na ? null : unreal,
      unreal_na,
      unreal_partial,
      pct_of_book: total_book_inr > 0 ? (book / total_book_inr) * 100 : 0,
      map_href: mapSleeveHoldingsHref(id, meta.mapKey),
    };
  }).filter((r) => r.count > 0);
}

export function TodaySleevePerformance({
  holdings,
  total_book_inr,
  totals,
}: {
  holdings: NormalizedHolding[];
  total_book_inr: number;
  totals?: { day_change_value: number };
}) {
  const rows = useMemo(() => buildRollups(holdings, total_book_inr), [holdings, total_book_inr]);
  const intraday = useMemo(
    () =>
      deriveIntradayStatus(
        {
          day_change_value: totals?.day_change_value ?? 0,
          day_change_pct: null,
          market_value: total_book_inr,
          unrealized_pnl: null,
        },
        holdings,
      ),
    [holdings, totals, total_book_inr],
  );

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted">
        No sleeves in this view. Widen the active view in Settings or run a data refresh.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((r) => {
        const accent = sleeveColor(SLEEVE_META[r.id].mapKey);
        return (
          <article
            key={r.id}
            className="group relative overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-panel to-ink2 p-5 transition hover:-translate-y-0.5 hover:border-line2 hover:shadow-raised motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            style={{ borderLeftWidth: 3, borderLeftColor: accent }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-[15px] font-semibold text-ink">{r.label}</h3>
                <p className="mt-0.5 text-[11px] text-muted-dim">{r.tagline}</p>
              </div>
              <span className="shrink-0 rounded-md border border-line px-2 py-0.5 font-mono text-[10px] text-muted-dim">
                {r.count} {r.count === 1 ? "line" : "lines"}
              </span>
            </div>

            <p className="mt-4 text-[23px] font-semibold">
              <MoneyValue inr={r.book_inr} className="text-[23px] text-ink" />
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-muted-dim">Book · INR</p>

            <dl className="mt-4 space-y-2 border-t border-line pt-3 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-dim">Weight in view</dt>
                <dd className="font-mono text-muted">{r.pct_of_book.toFixed(1)}%</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-dim">Day move</dt>
                <dd className={`text-right ${intraday === "available" ? "" : "text-muted-dim"}`}>
                  {intraday !== "available" ? (
                    <span className="text-[10px] font-sans">—</span>
                  ) : (
                    <MoneyValue inr={r.day_inr} signed className={r.day_inr >= 0 ? "text-mint" : "text-coral"} />
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-dim">Unrealized</dt>
                <dd className="text-right">
                  {r.unreal_na ? (
                    <Link href="/decide#cost" className="link-action text-[11px] font-sans">
                      Add cost basis
                    </Link>
                  ) : (
                    <MoneyValue
                      inr={r.unreal_inr ?? 0}
                      signed
                      className={(r.unreal_inr ?? 0) >= 0 ? "text-mint" : "text-coral"}
                    />
                  )}
                </dd>
              </div>
            </dl>

            <div className="mt-4">
              <Link
                href={r.map_href}
                className="btn-ghost w-full justify-center !min-h-9 !px-3 !py-2 !text-[11px]"
              >
                Show {r.count} holding{r.count === 1 ? "" : "s"} on Map →
              </Link>
            </div>
          </article>
        );
      })}
      {intraday !== "available" ? (
        <p className="col-span-full text-xs text-muted-dim">{intradayUnavailableCopy(intraday)}</p>
      ) : null}
    </div>
  );
}

export { classifySleeve };
