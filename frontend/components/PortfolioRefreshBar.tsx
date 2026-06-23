"use client";

import { usePortfolio } from "@/components/PortfolioContext";

/** Thin progress strip while portfolio reload runs (last data stays visible). */
export function PortfolioRefreshBar() {
  const { refreshing, data } = usePortfolio();
  if (!refreshing || !data) return null;
  return (
    <div className="h-0.5 w-full overflow-hidden bg-hairline" aria-hidden={false} aria-label="Refreshing portfolio">
      <div className="h-full w-1/3 animate-pulse bg-gradient-to-r from-transparent via-ion/80 to-transparent motion-reduce:animate-none" />
    </div>
  );
}
