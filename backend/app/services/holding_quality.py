"""Post-normalize checks: implied price vs market value, absurd native prices, book inclusion."""

from __future__ import annotations

import logging
from datetime import datetime

from app.schemas import AssetType, Currency, NormalizedHolding
from app.services.fx_book import apply_inr_book, book_value_inr, sum_inr_market

log = logging.getLogger(__name__)

# Per-share USD sanity: above this, field mapping is almost certainly wrong (BRK.A is ~0.5–0.7M).
_MAX_SANE_USD_LAST_PRICE = 1_500_000.0


def reconcile_native_price_vs_market_value(h: NormalizedHolding) -> NormalizedHolding:
    """If qty*last_price disagrees badly with broker market_value, trust market_value and fix implied price."""
    qty = float(h.quantity or 0.0)
    mval = float(h.market_value or 0.0)
    ltp = h.last_price
    if qty <= 0 or mval <= 0 or ltp is None or float(ltp) <= 0:
        return h
    implied = qty * float(ltp)
    if implied <= 0:
        return h
    rel = abs(implied - mval) / max(mval, 1.0)
    if rel > 0.75:
        fixed_ltp = mval / qty
        log.debug(
            "reconcile price: id=%s name=%s implied=%.4f mval=%.4f -> ltp %.4f",
            h.id,
            h.name[:40],
            implied,
            mval,
            fixed_ltp,
        )
        return h.model_copy(update={"last_price": fixed_ltp})
    return h


def apply_book_quality_pass(holdings: list[NormalizedHolding]) -> tuple[list[NormalizedHolding], int, str]:
    """Mark holdings with absurd native USD last price as excluded from INR book totals."""
    out: list[NormalizedHolding] = []
    excluded = 0
    names: list[str] = []
    for h in holdings:
        lp = h.last_price
        if (
            h.currency == Currency.USD
            and lp is not None
            and float(lp) > _MAX_SANE_USD_LAST_PRICE
            and h.asset_type in (AssetType.US_STOCK, AssetType.ETF, AssetType.IN_STOCK)
        ):
            excluded += 1
            if len(names) < 6:
                names.append(h.name[:48] or (h.symbol or "") or h.id)
            out.append(h.model_copy(update={"book_include": False}))
            log.warning(
                "excluding holding from book totals: suspicious USD last_price id=%s name=%s price=%s",
                h.id,
                h.name[:60],
                lp,
            )
        else:
            out.append(h)
    note = ""
    if excluded:
        note = f"{excluded} holding(s) excluded due to suspicious price mapping"
        if names:
            note += f": {', '.join(names)}"
        if excluded > len(names):
            note += ", …"
    return out, excluded, note


def log_reconciliation_summary(holdings: list[NormalizedHolding], total_inr: float) -> None:
    n = len(holdings)
    inc = sum(1 for h in holdings if h.book_include)
    log.info("book reconciliation: lines=%s included=%s sum_inr_book=%.2f", n, inc, total_inr)


def finalize_holdings_pipeline(
    holdings: list[NormalizedHolding],
    *,
    usd_inr: float,
    fx_as_of: datetime,
) -> list[NormalizedHolding]:
    """Reconcile price vs MV, INR book, absurd-price exclusions (idempotent for already-filled INR rows)."""
    hs = [reconcile_native_price_vs_market_value(h) for h in holdings]
    hs = apply_inr_book(hs, usd_inr=usd_inr, fx_as_of=fx_as_of)
    hs, _, _ = apply_book_quality_pass(hs)
    log_reconciliation_summary(hs, sum_inr_market(hs))
    return hs


def prepare_holdings_from_priced_rows(
    rows: list[dict],
    *,
    usd_inr: float,
    fx_as_of: datetime,
) -> list[NormalizedHolding]:
    """Validate MCP rows, reconcile native MV vs price, INR book, then absurd-price exclusions."""
    hs = [NormalizedHolding.model_validate(x) for x in rows]
    return finalize_holdings_pipeline(hs, usd_inr=usd_inr, fx_as_of=fx_as_of)
