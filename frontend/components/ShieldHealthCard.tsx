"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useCommandPaletteOptional } from "@/components/CommandPalette";
import type { PortfolioResponse } from "@/lib/types";
import { computeShieldMetrics, shieldScoreFormula } from "@/lib/shieldMetrics";

const RING_META = [
  { key: "data", label: "Data integrity", color: "var(--peri)", r: 49 },
  { key: "risk", label: "Risk discipline", color: "var(--mint)", r: 37 },
  { key: "align", label: "Plan alignment", color: "var(--brass)", r: 25 },
] as const;

export function ShieldHealthCard({ data }: { data: PortfolioResponse }) {
  const cmd = useCommandPaletteOptional();
  const [kbdMod, setKbdMod] = useState("⌘");
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    setKbdMod(typeof navigator !== "undefined" && /mac/i.test(navigator.platform) ? "⌘" : "Ctrl");
    const t = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const m = useMemo(() => computeShieldMetrics(data), [data]);
  const formula = useMemo(() => shieldScoreFormula(m), [m]);

  const ringValues = {
    data: m.dataPct,
    risk: m.riskPct,
    align: m.alignPct,
  };

  return (
    <div className="panel-card flex h-full flex-col">
      <p className="text-[11px] uppercase tracking-[0.28em] text-muted-dim">Shield · trust, risk, alignment</p>
      <h3 className="mt-2 font-display text-xl font-semibold text-ink">Is the book sound?</h3>
      <p className="mt-1 max-w-[38ch] text-[12.5px] text-muted">
        Three rings on one 0–100 scale. Hover the score for how it blends.
      </p>

      <div className="relative mx-auto my-5 grid h-[184px] w-[184px] place-items-center">
        <svg width="184" height="184" viewBox="0 0 184 184" fill="none" className="block" aria-hidden>
          {RING_META.map((g) => (
            <circle key={`bg-${g.r}`} cx="92" cy="92" r={g.r} stroke="#23262F" strokeWidth="7" fill="none" />
          ))}
          {RING_META.map((g, i) => {
            const c = 2 * Math.PI * g.r;
            const v = ringValues[g.key];
            const dash = animated ? c - (c * v) / 100 : c;
            return (
              <circle
                key={`fg-${g.r}`}
                cx="92"
                cy="92"
                r={g.r}
                fill="none"
                stroke={g.color}
                strokeWidth="7"
                strokeLinecap="round"
                transform="rotate(-90 92 92)"
                strokeDasharray={`${c}`}
                strokeDashoffset={dash}
                className="motion-reduce:transition-none"
                style={{
                  transition: animated ? `stroke-dashoffset 1.3s cubic-bezier(0.6,0,0.2,1) ${0.2 + i * 0.15}s` : "none",
                }}
              />
            );
          })}
        </svg>
        <button
          type="button"
          className="absolute inset-0 flex items-center justify-center rounded-full text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/60"
          title={formula}
          aria-label={`Shield health ${m.score}. ${formula}`}
        >
          <div>
            <p className="font-display text-[46px] font-semibold leading-none text-ink">{m.score}</p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.34em] text-muted-dim">Health</p>
          </div>
        </button>
      </div>

      <ul className="mb-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-muted" aria-label="Ring legend">
        {RING_META.map((g) => (
          <li key={g.key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} aria-hidden />
            <span>
              {g.label}{" "}
              <span className="font-mono text-ink">{ringValues[g.key]}%</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="mb-4 text-center font-mono text-[10px] text-muted-dim" title={formula}>
        {formula}
      </p>

      <div className="space-y-3.5">
        <div>
          <div className="flex justify-between text-[12.5px]">
            <span className="font-medium text-ink">Data integrity</span>
            <span className="font-mono font-semibold text-peri">{m.dataPct}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-line">
            <div
              className="h-full rounded bg-peri motion-reduce:transition-none"
              style={{ width: animated ? `${m.dataPct}%` : "0%", transition: "width 1.1s cubic-bezier(0.6,0,0.2,1)" }}
            />
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-dim">
            Missing cost lines: {m.missingCost} · Invalid / excluded prices: {m.invalidPrice}
          </p>
        </div>
        <div>
          <div className="flex justify-between text-[12.5px]">
            <span className="font-medium text-ink">Risk discipline</span>
            <span className="font-mono font-semibold text-mint">{m.riskPct}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-line">
            <div
              className="h-full rounded bg-mint motion-reduce:transition-none"
              style={{ width: animated ? `${m.riskPct}%` : "0%", transition: "width 1.1s cubic-bezier(0.6,0,0.2,1) 0.1s" }}
            />
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-dim">{m.breachText}</p>
        </div>
        <div>
          <div className="flex justify-between text-[12.5px]">
            <span className="font-medium text-ink">Plan alignment</span>
            <span className="font-mono font-semibold text-brass-soft">{m.alignPct}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-line">
            <div
              className="h-full rounded bg-brass motion-reduce:transition-none"
              style={{ width: animated ? `${m.alignPct}%` : "0%", transition: "width 1.1s cubic-bezier(0.6,0,0.2,1) 0.2s" }}
            />
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-dim">{m.alignSubline}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/decide#concentration" className="btn-primary w-full justify-center sm:flex-1">
          Open Decide for the ranked plan →
        </Link>
        {cmd ? (
          <button
            type="button"
            onClick={() => cmd.openPalette()}
            className="btn-ghost !min-h-10"
            aria-label="Open command palette"
            title="Command palette"
          >
            <kbd className="font-mono text-[10px]">{kbdMod}</kbd>
            <kbd className="ml-1 font-mono text-[10px]">K</kbd>
          </button>
        ) : null}
      </div>
    </div>
  );
}
