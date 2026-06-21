"""Deterministic pseudo-prices when LTP missing."""

from __future__ import annotations

import hashlib


def pseudo_price(symbol: str | None, isin: str | None, seed: str = "truewealth-v1") -> float:
    key = (symbol or isin or "unknown").upper()
    h = hashlib.sha256(f"{seed}:{key}".encode()).hexdigest()
    n = int(h[:12], 16)
    # Range ~ 10 .. 50000 scaled down for readability
    base = 10 + (n % 100000) / 100.0
    return round(base, 4)


def _to_float(v: object) -> float | None:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def apply_prices_to_holdings(
    holdings: list[dict],
) -> list[dict]:
    """Mutate copies: set last_price if missing; only derive market_value when broker did not supply one."""
    out = []
    for h in holdings:
        row = dict(h)
        qty = float(row.get("quantity") or 0)
        mval_existing = _to_float(row.get("market_value"))
        ltp = row.get("last_price")
        if ltp is None:
            row["last_price"] = pseudo_price(row.get("symbol"), row.get("isin"))
        lp = float(row["last_price"])
        if mval_existing is None or abs(mval_existing) < 1e-9:
            row["market_value"] = qty * lp
        else:
            row["market_value"] = mval_existing
        ac = row.get("avg_cost")
        if row.get("unrealized_pnl") is None and ac is not None:
            try:
                row["unrealized_pnl"] = (lp - float(ac)) * qty
            except (TypeError, ValueError):
                pass
        out.append(row)
    return out
