"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";

import { useCommandPaletteOptional } from "@/components/CommandPalette";
import type { PortfolioResponse } from "@/lib/types";

function ringDash(pct: number, r: number): string {
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, pct));
  const d = (v / 100) * c;
  return `${d} ${c - d}`;
}

export function ShieldHealthCard({ data }: { data: PortfolioResponse }) {
  const gid = useId().replace(/:/g, "");
  const edgeId = `shield-edge-${gid}`;
  const glowId = `shield-glow-${gid}`;
  const cmd = useCommandPaletteOptional();
  const [kbdMod, setKbdMod] = useState("⌘");
  const [explainOpen, setExplainOpen] = useState(false);

  useEffect(() => {
    setKbdMod(typeof navigator !== "undefined" && /mac/i.test(navigator.platform) ? "⌘" : "Ctrl");
  }, []);

  const {
    dataPct,
    riskPct,
    alignPct,
    score,
    missingCost,
    invalidPrice,
    breachText,
    alignSubline,
    explainBody,
  } = useMemo(() => {
    const dc = data.meta.data_completeness;
    const scoreBase = dc?.score ?? 72;
    const missing = dc?.missing_cost_basis_count ?? data.alerts.missing_cost_basis.length;
    const invalid = dc?.invalid_price_count ?? dc?.excluded_suspicious_price_count ?? 0;
    const stale = data.alerts.stale_data ? 1 : 0;
    const conc = data.alerts.concentration.length;

    const dataPct = Math.round(Math.min(100, Math.max(0, scoreBase - invalid * 8 - stale * 6)));
    const riskPct = Math.round(Math.max(0, Math.min(100, 100 - conc * 14 - stale * 12 - invalid * 10)));
    const top = [...data.allocation.by_asset_type].sort((a, b) => b.pct - a.pct)[0];
    const topPct = top?.pct ?? 0;
    const alignPct = Math.round(Math.max(0, Math.min(100, 100 - Math.max(0, topPct - 25) * 1.05)));

    const score = Math.round(dataPct * 0.45 + riskPct * 0.35 + alignPct * 0.2);
    const breachText =
      conc === 0
        ? "No concentration breaches in this view."
        : `${conc} concentration line${conc === 1 ? "" : "s"} above your guardrail.`;

    const sleeves = data.allocation.by_asset_type.filter((s) => s.pct > 0.05);
    const n = Math.max(1, sleeves.length);
    const ideal = 100 / n;
    const drift = sleeves.reduce((acc, s) => acc + Math.abs(s.pct - ideal), 0);
    const alignSubline =
      n >= 2 && drift > 4
        ? `Sleeve mix vs equal split: summed absolute drift ${drift.toFixed(0)} pts (largest sleeve ${topPct.toFixed(1)}%).`
        : `Largest sleeve ${topPct.toFixed(1)}% of the INR book in this view.`;

    const explainBody = [
      "Three rings, same 0–100 scale:",
      "Outer · Data integrity: completeness score minus penalties for stale sync, suspicious prices, and MCP issues.",
      "Middle · Risk discipline: eases when concentration alerts and staleness are low.",
      "Inner · Plan alignment: tightens when one asset-class sleeve dominates the book.",
      "Center number is the weighted blend below—not a forecast or return estimate.",
    ].join(" ");

    return {
      dataPct,
      riskPct,
      alignPct,
      score,
      missingCost: missing,
      invalidPrice: invalid,
      breachText,
      alignSubline,
      explainBody,
    };
  }, [data]);

  const rOuter = ringDash(dataPct, 49);
  const rMid = ringDash(riskPct, 37);
  const rInner = ringDash(alignPct, 25);

  return (
    <div className="glass-soft relative overflow-hidden rounded-3xl border border-white/[0.06] p-6 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted">Shield</p>
          <p className="mt-2 font-display text-lg text-ink/90">Trust, risk, alignment</p>
          <p className="mt-1 text-xs text-muted">Rings use the same 0–100 scale; center is the weighted blend.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            aria-expanded={explainOpen}
            onClick={() => setExplainOpen((o) => !o)}
            className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-1.5 text-[11px] font-medium text-muted transition hover:border-ion/35 hover:text-ink"
          >
            {explainOpen ? "Hide explain" : "Explain"}
          </button>

          <button
            type="button"
            onClick={() => cmd?.openPalette()}
            className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-black/30 px-2.5 py-1.5 text-[10px] font-medium text-muted transition hover:border-ion/35 hover:text-ink"
            aria-label="Open command palette"
          >
            <kbd className="rounded border border-hairline bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-ink/90">
              {kbdMod}
            </kbd>
            <kbd className="rounded border border-hairline bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-ink/90">K</kbd>
          </button>
        </div>
      </div>

      {explainOpen ? (
        <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/30 p-4 text-sm leading-relaxed text-muted">
          <p>{explainBody}</p>
        </div>
      ) : null}

      <Link
        href="/decide#concentration"
        className="mt-5 block w-full rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.045] to-white/[0.02] p-5 text-left backdrop-blur-md transition hover:border-ion/30"
      >
        <div className="flex flex-col items-center gap-6">
          <div className="relative h-[180px] w-[180px] shrink-0">
            <svg width="180" height="180" viewBox="0 0 180 180" fill="none" className="block" aria-hidden>
              <defs>
                <linearGradient id={edgeId} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="rgba(110,168,255,0.85)" />
                  <stop offset="1" stopColor="rgba(104,215,198,0.75)" />
                </linearGradient>
                <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="6" result="b" />
                  <feColorMatrix
                    in="b"
                    type="matrix"
                    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 .5 0"
                  />
                  <feMerge>
                    <feMergeNode />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <path
                d="M90 16c20.5 15.1 43.2 18.3 63 20.3v52.5c0 40.3-27.1 65.4-63 69.7-35.9-4.3-63-29.4-63-69.7V36.3C46.8 34.3 69.5 31.1 90 16Z"
                stroke={`url(#${edgeId})`}
                strokeWidth="1.6"
                opacity={0.95}
              />
              <path
                d="M90 28c17.4 12.6 36.6 15.2 53.2 17v44.1c0 33.6-22.7 54.6-53.2 58.2C59.5 143.7 36.8 122.7 36.8 89.1V45c16.6-1.8 35.8-4.4 53.2-17Z"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1.2"
              />
              <g opacity={0.9}>
                <circle cx="90" cy="88" r="49" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
                <circle cx="90" cy="88" r="37" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
                <circle cx="90" cy="88" r="25" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
              </g>
              <g filter={`url(#${glowId})`}>
                <circle
                  cx="90"
                  cy="88"
                  r="49"
                  stroke="rgba(104,215,198,0.95)"
                  strokeWidth="9"
                  strokeLinecap="round"
                  transform="rotate(-90 90 88)"
                  strokeDasharray={rOuter}
                />
                <circle
                  cx="90"
                  cy="88"
                  r="37"
                  stroke="rgba(255,204,102,0.95)"
                  strokeWidth="9"
                  strokeLinecap="round"
                  transform="rotate(-90 90 88)"
                  strokeDasharray={rMid}
                />
                <circle
                  cx="90"
                  cy="88"
                  r="25"
                  stroke="rgba(110,168,255,0.95)"
                  strokeWidth="9"
                  strokeLinecap="round"
                  transform="rotate(-90 90 88)"
                  strokeDasharray={rInner}
                />
              </g>
              <g transform="translate(90 88) scale(7.2) translate(-12 -12)" opacity={0.88}>
                <path
                  vectorEffect="nonScalingStroke"
                  d="M7.2 12.2c1.2-1.8 2.8-3 4.8-3.6 2.1-.6 4.1-.3 5.8.8"
                  stroke="rgba(104,215,198,0.72)"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  vectorEffect="nonScalingStroke"
                  d="M8.2 15.7c1.9 1.2 4.1 1.6 6.4 1.1"
                  stroke="rgba(255,204,102,0.62)"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
            </svg>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="font-mono text-2xl text-ink">{score}</p>
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted">Health</p>
              </div>
            </div>
          </div>

          <div className="w-full max-w-xl space-y-4 text-left">
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted">Data integrity</span>
                  <span className="font-mono text-xs text-muted">{dataPct}%</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-mintglass/80" style={{ width: `${dataPct}%` }} />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted/85">
                  Missing cost lines: {missingCost}. Invalid / excluded prices: {invalidPrice}.
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted">Risk discipline</span>
                  <span className="font-mono text-xs text-warn-muted">{riskPct}%</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-ember/80" style={{ width: `${riskPct}%` }} />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted/85">{breachText}</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted">Plan alignment</span>
                  <span className="font-mono text-xs text-ion">{alignPct}%</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-ion/80" style={{ width: `${alignPct}%` }} />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted/85">{alignSubline}</p>
              </div>
            </div>
            <p className="text-center text-sm font-medium text-ion">Open Decide for the ranked action plan →</p>
          </div>
        </div>
      </Link>

      <p className="mt-4 text-xs text-muted/70">
        Shield is triage only—not a performance forecast. Numbers come from the same book as Today and Map after the
        latest refresh.
      </p>
    </div>
  );
}
