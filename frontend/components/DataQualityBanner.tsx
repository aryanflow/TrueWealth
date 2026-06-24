"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { usePortfolio } from "@/components/PortfolioContext";
import { summarizeAlerts } from "@/lib/alertSummary";

const LS_KEY = "tw_dismiss_cost_basis_banner";

/** Single global strip for missing cost basis — Today tab only. */
export function DataQualityBanner() {
  const pathname = usePathname();
  const { data } = usePortfolio();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(typeof window !== "undefined" && window.localStorage.getItem(LS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const missingN = useMemo(() => {
    if (!data) return 0;
    return summarizeAlerts(data.alerts, data.meta, data.holdings).missingCostHoldings;
  }, [data]);

  const onDismiss = useCallback(() => {
    try {
      window.localStorage.setItem(LS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, []);

  const onToday = pathname === "/today" || pathname === "/";
  if (!onToday || !data || missingN <= 0 || dismissed) return null;

  return (
    <div className="border-b border-line bg-coral/[0.045]">
      <div className="mx-auto flex min-h-[46px] max-w-7xl flex-wrap items-center gap-3 px-4 py-2 text-[13px] text-muted md:px-7">
        <span>
          <strong className="font-semibold text-coral">{missingN} holding{missingN === 1 ? "" : "s"}</strong> missing
          cost basis — affects PnL quality.
        </span>
        <Link href="/decide#cost" className="link-action shrink-0 text-[13px]">
          Review in Decide →
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto min-h-9 rounded-md border border-line px-3 py-1 text-xs text-muted-dim transition hover:border-line2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peri/60"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
