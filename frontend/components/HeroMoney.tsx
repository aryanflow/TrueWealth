"use client";

import { useMemo } from "react";

import { useDisplayPreferences } from "@/components/DisplayPreferences";
import { usePortfolio } from "@/components/PortfolioContext";
import { bookCurrencyLabel } from "@/lib/bookCurrency";
import { formatInrHero } from "@/lib/format";

export function HeroMoney({ inr, className = "" }: { inr: number; className?: string }) {
  const { hideBalances, displayCurrency } = useDisplayPreferences();
  const { data } = usePortfolio();
  const fx = data?.meta.fx_usd_inr ?? null;

  const parts = useMemo(() => {
    if (displayCurrency === "USD" && fx && fx > 0) {
      const usd = inr / fx;
      const main = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.floor(Math.abs(usd)));
      const frac = Math.round((Math.abs(usd) % 1) * 100);
      const dec = frac > 0 ? `.${String(frac).padStart(2, "0")}` : "";
      return { symbol: "$", main, dec };
    }
    const h = formatInrHero(inr);
    return { symbol: h.symbol, main: h.main, dec: h.dec };
  }, [inr, displayCurrency, fx]);

  const label = bookCurrencyLabel(displayCurrency, fx);

  if (hideBalances) {
    return (
      <div>
        <p className="text-[11px] uppercase tracking-[0.28em] text-muted-dim">Total wealth · hidden</p>
        <p className={`mt-3 font-display text-[clamp(2.5rem,7vw,5.1rem)] font-medium leading-[0.98] text-muted-dim ${className}`}>
          ••••••
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="text-[11px] uppercase tracking-[0.28em] text-muted-dim">Total wealth · {label}</p>
      <p
        className={`mt-3 font-display text-[clamp(2.5rem,7vw,5.1rem)] font-medium leading-[0.98] tracking-tight text-ink ${className}`}
      >
        <span className="align-[0.18em] text-[0.5em] font-semibold text-brass">{parts.symbol}</span>
        {parts.main}
        {parts.dec ? <span className="text-[0.42em] text-muted-dim">{parts.dec}</span> : null}
      </p>
    </>
  );
}
