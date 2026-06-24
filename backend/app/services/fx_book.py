"""Convert native MV / PnL / day-change into INR for a single base-currency book."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Iterable

from collections import defaultdict

from app.schemas import Currency, NormalizedHolding

log = logging.getLogger(__name__)


def apply_inr_book(holdings: list[NormalizedHolding], *, usd_inr: float, fx_as_of: datetime | None = None) -> list[NormalizedHolding]:
    """Fill `inr_*` and simple total-return % where cost basis exists.

    For USD legs: prefer broker ``inr_market_value`` when present. If absent, detect when
    ``market_value`` is already INR (ratio to qty×LTP ≈ FX) and skip an extra FX multiply.
    """
    ts = fx_as_of or datetime.now(timezone.utc)
    rate = float(usd_inr) if usd_inr and usd_inr > 0 else 94.61
    out: list[NormalizedHolding] = []
    for h in holdings:
        mv = float(h.market_value or 0.0)
        unreal = h.unrealized_pnl
        day = h.day_change_value
        fx_used: float | None = None
        fx_ts: datetime | None = None
        broker_inr = float(h.inr_market_value or 0.0)
        if broker_inr > 0:
            # Broker-reported INR book (common on US lines); never multiply native MV by FX again.
            inr_mv = broker_inr
            if h.inr_unrealized_pnl is not None:
                inr_unreal = float(h.inr_unrealized_pnl)
            elif h.currency == Currency.USD:
                inr_unreal = float(unreal) * rate if unreal is not None else None
            else:
                inr_unreal = float(unreal) if unreal is not None else None
            if h.currency == Currency.USD:
                inr_day = float(day) * rate if day is not None else None
            else:
                inr_day = float(day) if day is not None else None
            fx_used = None
            fx_ts = ts
        elif h.currency == Currency.USD:
            q = float(h.quantity or 0.0)
            lp = float(h.last_price) if h.last_price is not None else 0.0
            implied_usd = (q * lp) if q > 0 and lp > 0 else 0.0
            # INDmoney sometimes puts **INR book** in ``market_value`` while ``currency`` stays USD.
            # If mv ≈ qty×LTP×FX, ``mv`` is already INR — do not multiply by ``usd_inr`` again.
            if implied_usd > 1e-6 and mv > 0:
                ratio = mv / implied_usd
                if rate * 0.88 <= ratio <= rate * 1.18:
                    inr_mv = mv
                    fx_used = None
                else:
                    inr_mv = mv * rate
                    fx_used = rate
            else:
                inr_mv = mv * rate
                fx_used = rate
            fx_ts = ts
            if h.inr_unrealized_pnl is not None:
                inr_unreal = float(h.inr_unrealized_pnl)
            else:
                inr_unreal = float(unreal) * rate if unreal is not None else None
            inr_day = float(day) * rate if day is not None else None
        else:
            inr_mv = mv
            inr_unreal = float(unreal) if unreal is not None else None
            inr_day = float(day) if day is not None else None

        r_loc = r_fx = r_tot = None
        if h.avg_cost is not None and h.quantity:
            cost = float(h.avg_cost) * float(h.quantity)
            if cost > 0 and mv > 0:
                r_tot = (mv / cost - 1.0) * 100.0
                r_loc = r_tot
                r_fx = 0.0 if h.currency == Currency.USD else 0.0

        out.append(
            h.model_copy(
                update={
                    "inr_market_value": round(inr_mv, 4),
                    "inr_unrealized_pnl": round(inr_unreal, 4) if inr_unreal is not None else None,
                    "inr_day_change_value": round(inr_day, 4) if inr_day is not None else None,
                    "fx_usd_inr_used": round(fx_used, 6) if fx_used is not None else None,
                    "fx_as_of": fx_ts,
                    "return_local_pct": round(r_loc, 4) if r_loc is not None else None,
                    "return_fx_inr_pct": round(r_fx, 4) if r_fx is not None else None,
                    "return_total_inr_pct": round(r_tot, 4) if r_tot is not None else None,
                }
            )
        )
    return out


def book_value_inr(h: NormalizedHolding) -> float:
    if not h.book_include:
        return 0.0
    v = float(h.inr_market_value or 0.0)
    if v > 0:
        return v
    return float(h.market_value or 0.0)


def sum_inr_market(holdings: Iterable[NormalizedHolding]) -> float:
    return sum(book_value_inr(h) for h in holdings)


def instrument_dedupe_key(h: NormalizedHolding) -> str:
    """Stable line identity for dedupe.

    Do **not** bucket only by ISIN: the same mutual fund / stock can appear in multiple folios
    or accounts with different ``id``s; merging them dropped rows and distorted totals.
    ``NormalizedHolding.id`` already encodes ind_key / ISIN+account / symbol+exchange+account from
    the normalizer.
    """
    return f"id:{h.id}"


def dedupe_holdings_by_instrument(items: list[NormalizedHolding]) -> list[NormalizedHolding]:
    """Keep one row per instrument; prefer the line with larger INR book value."""
    buckets: dict[str, list[NormalizedHolding]] = defaultdict(list)
    for h in items:
        buckets[instrument_dedupe_key(h)].append(h)
    out: list[NormalizedHolding] = []
    for group in buckets.values():
        primary = max(group, key=book_value_inr)
        out.append(primary)
    return out
