"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { usePortfolio } from "@/components/PortfolioContext";

const LS_KEY = "tw_dismiss_data_quality_banner";

export function DataQualityBanner() {
  const { data } = usePortfolio();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(typeof window !== "undefined" && window.localStorage.getItem(LS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const message = useMemo(() => {
    if (!data) return null;
    const conf = data.meta.confidence ?? "partial";
    if (conf === "good") return null;
    const notes = data.meta.confidence_notes?.filter(Boolean) ?? [];
    if (notes.length) return notes.join(" · ");
    if (conf === "partial") return "Partial data: book or basis may be incomplete for this pass.";
    if (conf === "degraded") return "Degraded: sync, MCP, or price mapping needs attention.";
    return null;
  }, [data]);

  const onDismiss = useCallback(() => {
    try {
      window.localStorage.setItem(LS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, []);

  if (!message || dismissed) return null;

  return (
    <div className="border-b border-hairline bg-black/30 px-4 py-2 text-center text-[12px] text-muted motion-reduce:transition-none">
      <span className="text-ink/90">{message}</span>
      <Link href="/decide" className="ml-2 font-medium text-ion underline-offset-2 hover:text-ion/85">
        Review in Decide
      </Link>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-3 rounded-md border border-line px-2 py-0.5 text-[11px] text-ink hover:bg-surface/50"
      >
        Dismiss
      </button>
    </div>
  );
}
