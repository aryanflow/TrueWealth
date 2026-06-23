"""Ranked, quantified portfolio actions (rule-based MVP)."""

from __future__ import annotations

from app.schemas import ActionPlanItem, AssetType, ConcentrationAlert, NormalizedHolding
from app.services.fx_book import book_value_inr


def _concentration_confidence(c: ConcentrationAlert) -> str:
    """Align with severity of breach vs guardrail (single source for Decide labels)."""
    over = float(c.weight) - float(c.threshold)
    thr = max(float(c.threshold), 1e-6)
    rel = over / thr
    if over >= 5.0 or rel >= 0.2:
        return "high"
    if over >= 2.0 or rel >= 0.08:
        return "medium"
    return "low"


def _holding_for(holdings: list[NormalizedHolding], holding_id: str) -> NormalizedHolding | None:
    for h in holdings:
        if h.id == holding_id:
            return h
    return None


def _pct_of_line(amount: float, line_inr: float) -> str:
    if line_inr <= 0 or amount <= 0:
        return ""
    p = 100.0 * amount / line_inr
    return f" (~{p:.1f}% of this line's INR book)"


def _smallcap_mf_inr(holdings: list[NormalizedHolding]) -> float:
    s = 0.0
    for h in holdings:
        if h.asset_type != AssetType.MF:
            continue
        blob = f"{h.name} {h.asset_class_l2 or ''}".lower()
        if "small" in blob:
            s += book_value_inr(h)
    return s


def build_action_plan(
    holdings: list[NormalizedHolding],
    *,
    concentration: list[ConcentrationAlert],
    total_inr: float,
    usd_weight_pct: float,
    mf_smallcap_proxy_pct: float,
    global_equity_offshore_pct: float = 0.0,
) -> list[ActionPlanItem]:
    """Deterministic ranked actions from current book and alerts."""
    _ = total_inr  # reserved for future sizing / liquidity constraints
    items: list[ActionPlanItem] = []
    rank = 1
    for c in concentration[:5]:
        trim = float(c.suggested_trim_inr)
        dilute_add = float(c.suggested_dilute_inr)
        h_match = _holding_for(holdings, c.holding_id)
        l2 = ""
        if h_match and h_match.asset_class_l2:
            l2 = f" [{h_match.asset_class_l2}]"
        line_inr = float(c.inr_market_value) if c.inr_market_value else (book_value_inr(h_match) if h_match else 0.0)
        sens = (float(c.weight) / 100.0) * 30.0
        why_it_matters = (
            f"{c.name}{l2} at {c.weight:.1f}% is above your {c.threshold:.0f}% guardrail. "
            f"As a rough stress illustration only: if this name fell ~30%, the book-level wobble from this slice alone is on the order of −{sens:.1f} percentage points "
            f"(heuristic, not a forecast or stress test)."
        )
        trim_note = _pct_of_line(trim, line_inr)
        dilute_note = _pct_of_line(dilute_add, line_inr)
        fix_a = (
            f"Trim about ₹{trim:,.0f} to reach ~{c.threshold:.0f}% weight (indicative, not tax-aware).{trim_note}"
            if trim > 0
            else "Review position size vs policy."
        )
        fix_b = (
            f"Alternatively add ~₹{dilute_add:,.0f} to uncorrelated sleeves to dilute without selling (cashflow permitting).{dilute_note} "
            f"e.g. add to liquid / large-cap index sleeve."
            if dilute_add > 0
            else "Add new uncorrelated exposure across sleeves to dilute concentration — e.g. add to liquid / large-cap index sleeve."
        )
        items.append(
            ActionPlanItem(
                rank=rank,
                issue=f"{c.name} is {c.weight:.1f}% of book vs {c.threshold:.0f}% guardrail",
                why_it_matters=why_it_matters,
                fix_a=fix_a,
                fix_b=fix_b,
                constraints="Exit load / tax not modeled in V1 unless you add lot data.",
                confidence=_concentration_confidence(c),
                suggested_trim_inr=round(float(trim), 4) if trim > 0 else None,
                suggested_dilute_inr=round(float(dilute_add), 4) if dilute_add > 0 else None,
                holding_id=c.holding_id,
            )
        )
        rank += 1

    if usd_weight_pct >= 15.0 and rank <= 8:
        geo = global_equity_offshore_pct
        geo_note = f" US/global equity (US_STOCK) on the INR book is ~{geo:.1f}%." if geo > 0.05 else ""
        items.append(
            ActionPlanItem(
                rank=rank,
                issue=(
                    f"USD-denominated currency book is ~{usd_weight_pct:.1f}% of INR book (native USD lines only).{geo_note}"
                ),
                why_it_matters="INR strength can compress returns on USD-native lines even when US tickers are flat; Indian stocks stay INR in this model.",
                fix_a="Hedge notionally via INR debt sleeve or reduce USD-currency beta at the margin.",
                fix_b="Keep USD-native exposure for diversification but cap to your policy band.",
                constraints="FX model uses static USDINR in MVP.",
                confidence="medium",
            )
        )
        rank += 1

    if mf_smallcap_proxy_pct >= 35.0 and rank <= 8:
        sc_inr = _smallcap_mf_inr(holdings)
        items.append(
            ActionPlanItem(
                rank=rank,
                issue=f"Small-cap oriented MF sleeves ~{mf_smallcap_proxy_pct:.0f}% of book (name/category proxy).",
                why_it_matters="Small-cap beta clusters drawdowns and overlaps across funds.",
                fix_a=(
                    f"Consolidate overlapping small-cap funds into one core sleeve. "
                    f"Indicative small-cap MF notional on book ~₹{sc_inr:,.0f} (heuristic from names/categories)."
                ),
                fix_b="Rebalance toward flexi-cap / multi-asset per your risk budget; e.g. add to liquid / large-cap index sleeve.",
                constraints="Overlap is heuristic until fund holdings are ingested.",
                confidence="low",
            )
        )
        rank += 1

    items.sort(key=lambda x: x.rank)
    return items[:8]
