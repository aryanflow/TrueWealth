"""Normalize raw broker/MCP payloads into NormalizedHolding."""

from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from app.schemas import AssetType, Country, Currency, NormalizedHolding

log = logging.getLogger(__name__)


def _stable_id(parts: list[str]) -> str:
    raw = "|".join(p or "" for p in parts).lower()
    if raw.strip("|"):
        return hashlib.sha256(raw.encode()).hexdigest()[:32]
    return uuid.uuid4().hex


def _pick(d: dict[str, Any], *keys: str) -> Any:
    for k in keys:
        if k in d and d[k] is not None:
            return d[k]
    return None


def _to_float(v: Any) -> float | None:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


_ASSET_HINTS = (
    (AssetType.CASH, ("cash", "liquid", "savings", "fd", "bank")),
    (AssetType.MF, ("mutual", "mf", "sip", "fund")),
    (AssetType.ETF, ("etf", "exchange traded")),
    (AssetType.IN_STOCK, ("eq", "equity", "stock", "nse", "bse", "share")),
    (AssetType.US_STOCK, ("us stock", "nasdaq", "nyse", "us_equity")),
)


def infer_asset_type(text: str | None, explicit: str | None) -> AssetType:
    if explicit:
        e = str(explicit).upper().replace(" ", "_")
        for at in AssetType:
            if e == at.value or e in (at.name,):
                return at
        mapping = {
            "EQUITY": AssetType.IN_STOCK,
            "STOCKS": AssetType.IN_STOCK,
            "STOCK": AssetType.IN_STOCK,
            "MUTUAL_FUND": AssetType.MF,
            "MUTUALFUND": AssetType.MF,
            "DEBT_MF": AssetType.MF,
        }
        if e in mapping:
            return mapping[e]
    blob = (text or "").lower()
    for at, hints in _ASSET_HINTS:
        if any(h in blob for h in hints):
            return at
    return AssetType.OTHER


def infer_country(asset_type: AssetType, text: str | None, explicit: str | None) -> Country:
    if explicit:
        x = str(explicit).upper()
        if x in ("IN", "INDIA", "IND"):
            return Country.IN
        if x in ("US", "USA", "UNITED_STATES"):
            return Country.US
    blob = (text or "").lower()
    if asset_type == AssetType.US_STOCK or "us " in blob or ".us" in blob or "nasdaq" in blob:
        return Country.US
    if asset_type in (AssetType.IN_STOCK, AssetType.MF, AssetType.ETF) and "us" not in blob:
        if "nse" in blob or "bse" in blob or "inr" in blob:
            return Country.IN
    if asset_type == AssetType.IN_STOCK:
        return Country.IN
    return Country.OTHER


def infer_currency(explicit: str | None, country: Country) -> Currency:
    if explicit:
        x = str(explicit).upper()
        if x in ("INR", "RS", "RUPEES"):
            return Currency.INR
        if x in ("USD", "DOLLAR", "DOLLARS"):
            return Currency.USD
    if country == Country.IN:
        return Currency.INR
    if country == Country.US:
        return Currency.USD
    return Currency.OTHER


def normalize_raw_holding(row: dict[str, Any], *, now: datetime | None = None) -> NormalizedHolding:
    """Map a single dict (flexible keys) to NormalizedHolding."""
    ts = now or datetime.now(timezone.utc)
    name = str(
        _pick(row, "name", "investment", "security_name", "scrip_name", "instrument_name", "title") or "",
    )
    symbol = _pick(row, "symbol", "ticker", "trading_symbol", "scrip_code", "investment_code")
    symbol = str(symbol) if symbol is not None else None
    isin = _pick(row, "isin", "ISIN")
    isin = str(isin) if isin is not None else None

    qty = _to_float(_pick(row, "quantity", "qty", "units", "shares", "balance", "total_units")) or 0.0
    avg = _to_float(_pick(row, "avg_cost", "average_price", "avgPrice", "avg_buy_price", "buy_avg"))
    ltp = _to_float(_pick(row, "last_price", "ltp", "lastPrice", "close", "current_price", "nav", "unit_price"))
    inv_amt = _to_float(_pick(row, "invested_amount", "invested_value", "cost", "total_cost"))
    mval = _to_float(_pick(row, "market_value", "current_value", "value", "mkt_value"))
    if mval is None and ltp is not None:
        mval = qty * ltp
    mval = mval or 0.0
    if avg is None and inv_amt is not None and qty > 0:
        avg = inv_amt / qty

    day_chg = _to_float(_pick(row, "day_change", "day_change_value", "dayChange", "pnl_today"))
    unreal = _to_float(_pick(row, "unrealized_pnl", "pnl", "gain", "overall_pnl"))
    if unreal is None and avg is not None and ltp is not None:
        unreal = (ltp - avg) * qty

    explicit_at = _pick(row, "asset_type", "assetType", "instrument_type", "category")
    text_blob = " ".join(
        str(x).lower()
        for x in (name, symbol, str(explicit_at or ""), str(_pick(row, "segment", "exchange") or ""))
    )
    at = infer_asset_type(text_blob, str(explicit_at) if explicit_at else None)
    cc = infer_country(at, text_blob, str(_pick(row, "country", "region") or "") or None)
    cur = infer_currency(str(_pick(row, "currency", "ccy") or "") or None, cc)

    hid = str(_pick(row, "id", "holding_id", "position_id") or "")
    if not hid:
        inv_code = str(_pick(row, "investment_code", "") or "")
        at_raw = str(explicit_at or "")
        hpct = str(_pick(row, "holding_percent", "") or "")
        inv_amt_s = str(inv_amt if inv_amt is not None else "")
        mval_s = str(mval)
        hid = _stable_id(
            [isin or "", inv_code, symbol or "", name, str(qty), at_raw, mval_s, inv_amt_s, hpct]
        )

    return NormalizedHolding(
        id=hid,
        name=name or (symbol or "Holding"),
        symbol=symbol,
        isin=isin,
        asset_type=at,
        country=cc,
        currency=cur,
        quantity=qty,
        avg_cost=avg,
        last_price=ltp,
        market_value=mval,
        unrealized_pnl=unreal,
        day_change_value=day_chg,
        weight=0.0,
        source="indmoney",
        updated_at=ts,
    )


def normalize_payload(payload: Any, *, now: datetime | None = None) -> list[NormalizedHolding]:
    """Accept list or dict with common wrapper keys."""
    if payload is None:
        log.info("normalize_payload: payload is None -> []")
        return []
    if isinstance(payload, list):
        rows = payload
        log.info("normalize_payload: list input len=%s", len(rows))
    elif isinstance(payload, dict):
        for key in ("holdings", "data", "positions", "portfolio", "items", "result"):
            v = payload.get(key)
            if isinstance(v, list):
                rows = v
                log.info("normalize_payload: dict wrapper key=%s len=%s other_keys=%s", key, len(v), list(payload)[:12])
                break
        else:
            rows = [payload]
            log.info("normalize_payload: dict with no list wrapper; treating whole dict as one row keys=%s", list(payload)[:20])
    else:
        log.warning("normalize_payload: unsupported type=%s repr=%r", type(payload).__name__, repr(payload)[:400])
        return []

    out: list[NormalizedHolding] = []
    for r in rows:
        if isinstance(r, dict):
            out.append(normalize_raw_holding(r, now=now))
    if not out and rows:
        log.warning("normalize_payload: had %s rows but produced 0 holdings (check field mapping)", len(rows))
    return out


def extract_transactions(payload: Any) -> list[dict[str, Any]]:
    if payload is None:
        return []
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]
    if isinstance(payload, dict):
        for key in ("transactions", "trades", "data", "items"):
            v = payload.get(key)
            if isinstance(v, list):
                return [x for x in v if isinstance(x, dict)]
    return []
