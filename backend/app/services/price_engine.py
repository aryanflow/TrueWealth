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


def apply_prices_to_holdings(
    holdings: list[dict],
) -> list[dict]:
    """Mutate copies: set last_price if missing; recompute market_value and optional unrealized."""
    out = []
    for h in holdings:
        row = dict(h)
        qty = float(row.get("quantity") or 0)
        ltp = row.get("last_price")
        if ltp is None:
            row["last_price"] = pseudo_price(row.get("symbol"), row.get("isin"))
        lp = float(row["last_price"])
        row["market_value"] = qty * lp
        ac = row.get("avg_cost")
        if ac is not None:
            try:
                row["unrealized_pnl"] = (lp - float(ac)) * qty
            except (TypeError, ValueError):
                pass
        out.append(row)
    return out
