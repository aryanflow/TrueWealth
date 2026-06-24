"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { formatInr } from "@/lib/format";
import type { ActionPlanItem, NormalizedHolding } from "@/lib/types";

import { SimulateModal } from "./SimulateModal";

function bookInr(h: NormalizedHolding): number {
  const v = h.inr_market_value;
  if (v != null && v > 0) return v;
  return h.market_value;
}

export function ActionPlanPanel({
  items,
  holdings,
  embedded = false,
}: {
  items: ActionPlanItem[];
  holdings: NormalizedHolding[];
  embedded?: boolean;
}) {
  const [sim, setSim] = useState<ActionPlanItem | null>(null);
  const search = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const hid = search.get("holding");
    if (!hid) return;
    if (!search.has("trimPct")) return;

    const trimPct = parseFloat(search.get("trimPct") || "15") || 15;
    const h = holdings.find((x) => x.id === hid);
    if (!h) {
      const clean = new URL(window.location.href);
      clean.searchParams.delete("holding");
      clean.searchParams.delete("trimPct");
      router.replace(`${clean.pathname}${clean.search}${clean.hash || ""}`);
      return;
    }
    const total = holdings.reduce((s, x) => s + bookInr(x), 0);
    if (total <= 0) return;
    const tgt = (trimPct / 100) * total;
    const mv = bookInr(h);
    const trim = Math.max(0, mv - tgt);
    setSim({
      rank: 0,
      issue: `Trim ${h.name}`,
      why_it_matters: "Opened from the inspector with a target weight in mind.",
      fix_a: `Sell about ${formatInr(trim)} notional to approach the target weight.`,
      fix_b: "Add new capital elsewhere so this name becomes a smaller slice of the book.",
      constraints: "Indicative only. Not tax or lot aware.",
      confidence: "low",
      suggested_trim_inr: trim,
      suggested_dilute_inr: null,
      holding_id: h.id,
    });
    const clean = new URL(window.location.href);
    clean.searchParams.delete("holding");
    clean.searchParams.delete("trimPct");
    router.replace(`${clean.pathname}${clean.search}${clean.hash || ""}`);
  }, [search, holdings, router]);

  const empty = (
    <div className="flex items-start gap-3 text-[13.5px] text-muted">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-mint text-mint">✓</span>
      <p>
        No ranked actions yet. Tighten concentration rules in Settings or run a data refresh to surface a plan.
      </p>
    </div>
  );

  const list = (
    <ul className="space-y-4">
      {items.map((a) => (
        <li key={a.rank} className="rounded-xl border border-line bg-ink-bg/60 p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-ink">
              <span className="mr-2 font-mono text-xs text-brass">#{a.rank}</span>
              {a.issue}
            </p>
            <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] font-medium capitalize tracking-wide text-muted">
              {a.confidence}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">{a.why_it_matters}</p>
          <div className="mt-3 grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
            <div className="rounded-md border border-mint/25 bg-mint/[0.06] p-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-dim">Option A · Trim</p>
              <p className="mt-1 text-ink/90">{a.fix_a}</p>
              {a.suggested_trim_inr != null && a.suggested_trim_inr > 0 ? (
                <p className="mt-1 font-mono text-mint">{formatInr(a.suggested_trim_inr)}</p>
              ) : null}
            </div>
            <div className="rounded-md border border-peri/25 bg-peri/[0.06] p-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-dim">Option B · Dilute</p>
              <p className="mt-1 text-ink/90">{a.fix_b}</p>
              {a.suggested_dilute_inr != null && a.suggested_dilute_inr > 0 ? (
                <p className="mt-1 font-mono text-peri">{formatInr(a.suggested_dilute_inr)}</p>
              ) : null}
            </div>
          </div>
          {a.constraints ? (
            <p className="mt-2 text-[11px] text-ember">
              <span className="font-medium">Constraints:</span> {a.constraints}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => setSim(a)}
            className="btn-ghost mt-3 !min-h-9 !px-3 !py-1.5 !text-[11px]"
          >
            Simulate
          </button>
        </li>
      ))}
    </ul>
  );

  if (embedded) {
    return (
      <>
        {!items.length ? empty : list}
        <SimulateModal open={sim != null} onClose={() => setSim(null)} item={sim} holdings={holdings} />
      </>
    );
  }

  return (
    <section className="panel-card">
      <h2 className="font-display text-xl font-semibold text-ink">Action plan</h2>
      <div className="mt-4">{!items.length ? empty : list}</div>
      <SimulateModal open={sim != null} onClose={() => setSim(null)} item={sim} holdings={holdings} />
    </section>
  );
}
