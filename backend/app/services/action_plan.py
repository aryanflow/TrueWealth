"""Ranked, quantified portfolio actions (rule-based MVP)."""

from __future__ import annotations

from app.schemas import ActionPlanItem, ConcentrationAlert, NormalizedHolding


def build_action_plan(
    holdings: list[NormalizedHolding],
    *,
    concentration: list[ConcentrationAlert],
    total_inr: float,
    usd_weight_pct: float,
    mf_smallcap_proxy_pct: float,
) -> list[ActionPlanItem]:
    """Deterministic ranked actions from current book and alerts."""
    items: list[ActionPlanItem] = []
    rank = 1
    for c in concentration[:5]:
        trim = float(c.suggested_trim_inr)
        dilute_add = float(c.suggested_dilute_inr)
        items.append(
            ActionPlanItem(
                rank=rank,
                issue=f"{c.name} is {c.weight:.1f}% of book vs {c.threshold:.0f}% guardrail",
                why_it_matters="Single-name risk dominates drawdowns and sequencing risk when trimming.",
                fix_a=f"Trim about ₹{trim:,.0f} to reach ~{c.threshold:.0f}% weight (indicative, not tax-aware)."
                if trim > 0
                else "Review position size vs policy.",
                fix_b=f"Alternatively add ~₹{dilute_add:,.0f} to uncorrelated sleeves to dilute without selling (cashflow permitting)."
                if dilute_add > 0
                else "Add new uncorrelated exposure across sleeves to dilute concentration.",
                constraints="Exit load / tax not modeled in V1 unless you add lot data.",
                confidence="medium",
                suggested_trim_inr=round(float(trim), 4) if trim > 0 else None,
                suggested_dilute_inr=round(float(dilute_add), 4) if dilute_add > 0 else None,
                holding_id=c.holding_id,
            )
        )
        rank += 1

    if usd_weight_pct >= 15.0 and rank <= 8:
        items.append(
            ActionPlanItem(
                rank=rank,
                issue=f"USD-linked exposure is ~{usd_weight_pct:.1f}% of INR book (FX sensitivity).",
                why_it_matters="INR strength erodes USD leg even when US tickers are flat.",
                fix_a="Hedge notionally via INR debt sleeve or reduce USD beta at the margin.",
                fix_b="Keep USD for diversification but cap to your policy band.",
                constraints="FX model uses static USDINR in MVP.",
                confidence="medium",
            )
        )
        rank += 1

    if mf_smallcap_proxy_pct >= 35.0 and rank <= 8:
        items.append(
            ActionPlanItem(
                rank=rank,
                issue=f"Small-cap oriented MF sleeves ~{mf_smallcap_proxy_pct:.0f}% of book (name/category proxy).",
                why_it_matters="Small-cap beta clusters drawdowns and overlaps across funds.",
                fix_a="Consolidate overlapping small-cap funds into one core sleeve.",
                fix_b="Rebalance toward flexi-cap / multi-asset per your risk budget.",
                constraints="Overlap is heuristic until fund holdings are ingested.",
                confidence="low",
            )
        )
        rank += 1

    items.sort(key=lambda x: x.rank)
    return items[:8]
