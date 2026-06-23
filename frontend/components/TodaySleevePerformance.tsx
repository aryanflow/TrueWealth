"use client";

import Link from "next/link";
import { useMemo } from "react";

import { formatInr, formatPct } from "@/lib/format";
import type { NormalizedHolding } from "@/lib/types";

import { mapExposureHref } from "./TodayAllocationStrip";

function bookInr(h: NormalizedHolding): number {
  const v = h.inr_market_value;
  if (v != null && v > 0) return v;
  return h.market_value;
}

function dayInr(h: NormalizedHolding): number {
  const d = h.inr_day_change_value ?? h.day_change_value;
  return d ?? 0;
}

function unrealInr(h: NormalizedHolding): number | null {
  const u = h.inr_unrealized_pnl ?? h.unrealized_pnl;
  return u != null ? u : null;
}

function includeHolding(h: NormalizedHolding): boolean {
  return h.book_include !== false;
}

export type TodaySleeveId = "indian_equity" | "us_equity" | "crypto" | "mutual_funds";

function classifySleeve(h: NormalizedHolding): TodaySleeveId | null {
  const t = h.asset_type;
  if (t === "CRYPTO") return "crypto";
  if (t === "MF") return "mutual_funds";
  if (t === "IN_STOCK") return "indian_equity";
  if (t === "US_STOCK") return "us_equity";
  if (t === "ETF") return h.country === "US" ? "us_equity" : "indian_equity";
  return null;
}

/** Map deep-link asset slice key (best-effort for combined Indian equity sleeve). */
function mapAssetKey(id: TodaySleeveId, indian: { stocks: number; etfs: number }): string {
  if (id === "mutual_funds") return "MF";
  if (id === "crypto") return "CRYPTO";
  if (id === "us_equity") return "US_STOCK";
  return indian.etfs > indian.stocks ? "ETF" : "IN_STOCK";
}

export interface SleeveRollup {
  id: TodaySleeveId;
  label: string;
  tagline: string;
  count: number;
  book_inr: number;
  day_inr: number;
  day_pct_est: number | null;
  unreal_inr: number | null;
  /** True if every line in the sleeve had null unrealized. */
  unreal_na: boolean;
  /** Some lines had PnL, some did not. */
  unreal_partial: boolean;
  pct_of_book: number;
  map_href: string;
}

function buildRollups(holdings: NormalizedHolding[], total_book_inr: number): SleeveRollup[] {
  const ids: TodaySleeveId[] = ["indian_equity", "us_equity", "crypto", "mutual_funds"];
  const meta: Record<
    TodaySleeveId,
    {
      label: string;
      tagline: string;
      book: number;
      day: number;
      unreal: number;
      unreal_lines: number;
      n: number;
    }
  > = {
    indian_equity: { label: "Indian stocks", tagline: "Listed India · incl. India ETFs", book: 0, day: 0, unreal: 0, unreal_lines: 0, n: 0 },
    us_equity: { label: "US stocks", tagline: "US listings · incl. US ETFs", book: 0, day: 0, unreal: 0, unreal_lines: 0, n: 0 },
    crypto: { label: "Crypto", tagline: "Digital assets", book: 0, day: 0, unreal: 0, unreal_lines: 0, n: 0 },
    mutual_funds: { label: "Mutual funds", tagline: "MFs in this view", book: 0, day: 0, unreal: 0, unreal_lines: 0, n: 0 },
  };

  let indian_stocks_only = 0;
  let indian_etfs_only = 0;

  for (const h of holdings) {
    if (!includeHolding(h)) continue;
    const sleeve = classifySleeve(h);
    if (!sleeve) continue;
    const m = meta[sleeve];
    const mv = bookInr(h);
    const d = dayInr(h);
    const u = unrealInr(h);
    m.book += mv;
    m.day += d;
    m.n += 1;
    if (sleeve === "indian_equity") {
      if (h.asset_type === "ETF") indian_etfs_only += 1;
      else if (h.asset_type === "IN_STOCK") indian_stocks_only += 1;
    }
    if (u != null) {
      m.unreal += u;
      m.unreal_lines += 1;
    }
  }

  const indianCounts = { stocks: indian_stocks_only, etfs: indian_etfs_only };

  return ids.map((id) => {
    const m = meta[id];
    let prev = 0;
    for (const h of holdings) {
      if (!includeHolding(h)) continue;
      if (classifySleeve(h) !== id) continue;
      prev += bookInr(h) - dayInr(h);
    }
    const day_pct_est = prev > 1 ? (m.day / prev) * 100 : null;
    const pct_of_book = total_book_inr > 0 ? (m.book / total_book_inr) * 100 : 0;
    const mapKey = mapAssetKey(id, indianCounts);
    const unreal_na = m.n > 0 && m.unreal_lines === 0;
    const unreal_partial = m.n > 0 && m.unreal_lines > 0 && m.unreal_lines < m.n;
    return {
      id,
      label: m.label,
      tagline: m.tagline,
      count: m.n,
      book_inr: m.book,
      day_inr: m.day,
      day_pct_est,
      unreal_inr: unreal_na ? null : m.unreal,
      unreal_na,
      unreal_partial,
      pct_of_book,
      map_href: mapExposureHref("asset", mapKey),
    };
  });
}

function pctTone(pct: number | null): string {
  if (pct == null || Number.isNaN(pct)) return "text-muted";
  if (pct > 0.02) return "text-gain-muted";
  if (pct < -0.02) return "text-loss-muted";
  return "text-muted";
}

function dayTone(n: number): string {
  if (n > 0.5) return "text-gain-muted";
  if (n < -0.5) return "text-loss-muted";
  return "text-muted";
}

export function TodaySleevePerformance({
  holdings,
  total_book_inr,
}: {
  holdings: NormalizedHolding[];
  total_book_inr: number;
}) {
  const rows = useMemo(() => buildRollups(holdings, total_book_inr), [holdings, total_book_inr]);

  return (
    <section className="space-y-4" aria-labelledby="today-sleeves-heading">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="today-sleeves-heading" className="font-display text-xl text-ink md:text-2xl">
            How sleeves are doing
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Indian equities, US listings, crypto, and mutual funds—book size, today’s move, and unrealized PnL where the
            feed gives cost basis. Same book as the header total.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((r, i) => {
          const accents = [
            "from-teal-500/[0.12] to-transparent",
            "from-ion/[0.14] to-transparent",
            "from-amber-400/[0.10] to-transparent",
            "from-rose-400/[0.09] to-transparent",
          ];
          const accent = accents[i % accents.length];
          return (
            <article
              key={r.id}
              className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-black/25 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm md:p-5"
            >
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent} opacity-90`}
                aria-hidden
              />
              <div className="relative">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold tracking-tight text-ink">{r.label}</h3>
                    <p className="mt-0.5 text-[10px] leading-snug text-muted">{r.tagline}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-muted">
                    {r.count} {r.count === 1 ? "line" : "lines"}
                  </span>
                </div>

                <p className="mt-4 font-mono text-lg text-ink md:text-xl">
                  <span className="numeric">{formatInr(r.book_inr)}</span>
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-muted">Book (INR)</p>

                <dl className="mt-4 space-y-2 border-t border-white/[0.06] pt-3 text-xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted">Weight in view</dt>
                    <dd className="font-mono text-ink">{r.pct_of_book.toFixed(1)}%</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted">Day move</dt>
                    <dd className={`text-right font-mono ${dayTone(r.day_inr)}`}>
                      {r.count === 0 ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <>
                          {r.day_inr >= 0 ? "+" : ""}
                          {formatInr(r.day_inr)}
                          {r.day_pct_est != null ? (
                            <span className={`ml-1.5 text-[10px] ${pctTone(r.day_pct_est)}`}>
                              ({formatPct(r.day_pct_est)})
                            </span>
                          ) : null}
                        </>
                      )}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted">Unrealized</dt>
                    <dd className={`text-right font-mono ${r.unreal_inr == null ? "text-muted" : dayTone(r.unreal_inr)}`}>
                      {r.count === 0 ? (
                        "—"
                      ) : r.unreal_na ? (
                        "n/a"
                      ) : (
                        <>
                          {(r.unreal_inr ?? 0) >= 0 ? "+" : ""}
                          {formatInr(r.unreal_inr ?? 0)}
                          {r.unreal_partial ? (
                            <span className="ml-1 text-[10px] font-normal text-muted" title="Some lines lack cost basis">
                              partial
                            </span>
                          ) : null}
                        </>
                      )}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex justify-end">
                  <Link
                    href={r.map_href}
                    className="text-[10px] font-medium uppercase tracking-[0.14em] text-ion underline-offset-2 transition hover:text-ion/80"
                  >
                    Map →
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
