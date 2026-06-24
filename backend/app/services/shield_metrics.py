"""Server-side Shield triage score (single source of truth for the dashboard)."""

from __future__ import annotations

from app.schemas import PortfolioResponse, ShieldSnapshot


def compute_shield_snapshot(data: PortfolioResponse) -> ShieldSnapshot:
    dc = data.meta.data_completeness
    score_base = dc.score if dc else 72.0
    missing = dc.missing_cost_basis_count if dc else len(data.alerts.missing_cost_basis)
    invalid = (dc.invalid_price_count if dc else 0) or (dc.excluded_suspicious_price_count if dc else 0) or 0
    stale = 1 if data.alerts.stale_data else 0
    conc = len(data.alerts.concentration)

    data_pct = round(min(100, max(0, score_base - invalid * 8 - stale * 6)))
    risk_pct = round(max(0, min(100, 100 - conc * 14 - stale * 12 - invalid * 10)))
    top = sorted(data.allocation.by_asset_type, key=lambda s: -s.pct)[0] if data.allocation.by_asset_type else None
    top_pct = top.pct if top else 0.0
    align_pct = round(max(0, min(100, 100 - max(0, top_pct - 25) * 1.05)))

    score = round(data_pct * 0.45 + risk_pct * 0.35 + align_pct * 0.2)
    breach_text = (
        "No concentration breaches in this view."
        if conc == 0
        else f"{conc} concentration line{'s' if conc != 1 else ''} above your guardrail."
    )

    sleeves = [s for s in data.allocation.by_asset_type if s.pct > 0.05]
    n = max(1, len(sleeves))
    ideal = 100 / n
    drift = sum(abs(s.pct - ideal) for s in sleeves)
    align_subline = (
        f"Sleeve mix vs equal split: drift {drift:.0f} pts · largest sleeve {top_pct:.1f}%."
        if n >= 2 and drift > 4
        else f"Largest sleeve {top_pct:.1f}% of the INR book in this view."
    )

    formula = f"{score} = 45%×{data_pct} + 35%×{risk_pct} + 20%×{align_pct}"
    return ShieldSnapshot(
        data_pct=data_pct,
        risk_pct=risk_pct,
        align_pct=align_pct,
        score=score,
        missing_cost=missing,
        invalid_price=invalid,
        breach_text=breach_text,
        align_subline=align_subline,
        formula=formula,
    )
