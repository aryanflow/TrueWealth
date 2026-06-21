"""Normalize raw broker/MCP payloads into NormalizedHolding."""

from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from app.schemas import AssetType, Country, Currency, NormalizedHolding

log = logging.getLogger(__name__)

# INDmoney `networth_holdings` asset_type literals -> canonical classification.
MCP_ASSET_DEFAULTS: dict[str, tuple[AssetType, Country, Currency]] = {
    "IND_STOCK": (AssetType.IN_STOCK, Country.IN, Currency.INR),
    "MF": (AssetType.MF, Country.IN, Currency.INR),
    "US_STOCK": (AssetType.US_STOCK, Country.US, Currency.USD),
    "BOND": (AssetType.BOND, Country.IN, Currency.INR),
    "EPF": (AssetType.EPF, Country.IN, Currency.INR),
    "NPS": (AssetType.NPS, Country.IN, Currency.INR),
    "SA": (AssetType.SA, Country.IN, Currency.INR),
    "FD": (AssetType.FD, Country.IN, Currency.INR),
    "CRYPTO": (AssetType.CRYPTO, Country.IN, Currency.INR),
    "INSURANCE": (AssetType.INSURANCE, Country.IN, Currency.INR),
    "VEHICLE": (AssetType.VEHICLE, Country.IN, Currency.INR),
    "RE": (AssetType.RE, Country.IN, Currency.INR),
    "RD": (AssetType.RD, Country.IN, Currency.INR),
    "AIF": (AssetType.AIF, Country.IN, Currency.INR),
    "PMS": (AssetType.PMS, Country.IN, Currency.INR),
    "PPF": (AssetType.PPF, Country.IN, Currency.INR),
    "GOLD": (AssetType.GOLD, Country.IN, Currency.INR),
    "SGB": (AssetType.GOLD, Country.IN, Currency.INR),
}


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


def _broker_reported_inr(row: dict[str, Any]) -> float | None:
    """INDmoney often sends a separate INR book figure for US lines; prefer this over FX on native MV."""
    keys = (
        "inr_market_value",
        "market_value_inr",
        "current_value_inr",
        "value_in_inr",
        "value_inr",
        "mval_inr",
        "portfolio_value_inr",
        "amount_inr",
        "valueInInr",
        "converted_value_inr",
        "indian_value",
        "holding_value_inr",
        "marketValueInInr",
    )
    for k in keys:
        v = _to_float(row.get(k))
        if v is not None and v > 0:
            return v
    return None


def _dedupe_holdings(items: list[NormalizedHolding]) -> list[NormalizedHolding]:
    """Same stable id twice: keep the row with the larger reported native + INR magnitudes (likely richer payload)."""
    best: dict[str, NormalizedHolding] = {}
    for h in items:
        cur = best.get(h.id)
        if cur is None:
            best[h.id] = h
            continue

        def _score(x: NormalizedHolding) -> float:
            return abs(float(x.market_value or 0.0)) + abs(float(x.inr_market_value or 0.0))

        if _score(h) > _score(cur):
            best[h.id] = h
    return list(best.values())


_ASSET_HINTS = (
    (AssetType.CASH, ("cash", "liquid", "savings", "bank")),
    (AssetType.MF, ("mutual", "mf", "sip", "fund")),
    (AssetType.ETF, ("etf", "exchange traded")),
    (AssetType.IN_STOCK, ("eq", "equity", "stock", "nse", "bse", "share")),
    (AssetType.US_STOCK, ("us stock", "nasdaq", "nyse", "us_equity")),
    (AssetType.EPF, ("epf", "provident")),
    (AssetType.CRYPTO, ("crypto", "bitcoin", "ethereum")),
    (AssetType.FD, (" fixed deposit", "fd ", " term deposit")),
    (AssetType.GOLD, ("gold", "sovereign gold", "sgb", "bullion")),
)


def infer_asset_type(text: str | None, explicit: str | None) -> AssetType:
    if explicit:
        e = str(explicit).upper().replace(" ", "_")
        if e in MCP_ASSET_DEFAULTS:
            return MCP_ASSET_DEFAULTS[e][0]
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
    for _at_m, cc_m, _cur_m in MCP_ASSET_DEFAULTS.values():
        if _at_m == asset_type:
            return cc_m
    if asset_type in (AssetType.IN_STOCK, AssetType.MF, AssetType.ETF) and "us" not in blob:
        if "nse" in blob or "bse" in blob or "inr" in blob:
            return Country.IN
    if asset_type == AssetType.IN_STOCK:
        return Country.IN
    if asset_type in (
        AssetType.MF,
        AssetType.ETF,
        AssetType.EPF,
        AssetType.FD,
        AssetType.PPF,
        AssetType.BOND,
        AssetType.NPS,
        AssetType.SA,
        AssetType.RD,
        AssetType.INSURANCE,
        AssetType.RE,
        AssetType.CRYPTO,
        AssetType.AIF,
        AssetType.PMS,
        AssetType.VEHICLE,
    ):
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


def classify_holding(row: dict[str, Any], text_blob: str) -> tuple[AssetType, Country, Currency, str | None]:
    """Prefer MCP `asset_type` literal; fall back to text inference."""
    explicit_at = _pick(row, "asset_type", "assetType", "instrument_type", "category")
    ac2_raw = _pick(row, "assetclass_l2", "assetClass_l2", "asset_class_l2")
    asset_class_l2 = str(ac2_raw).strip() if ac2_raw is not None else None
    if explicit_at:
        key = str(explicit_at).upper().replace(" ", "_").replace("-", "_")
        if key in MCP_ASSET_DEFAULTS:
            at, cc, cur = MCP_ASSET_DEFAULTS[key]
            return at, cc, cur, asset_class_l2
    at = infer_asset_type(text_blob, str(explicit_at) if explicit_at else None)
    cc = infer_country(at, text_blob, str(_pick(row, "country", "region") or "") or None)
    cur = infer_currency(str(_pick(row, "currency", "ccy") or "") or None, cc)
    # MF / Indian book: never leave MF as OTHER currency when country is IN
    if at == AssetType.MF and cur == Currency.OTHER and cc == Country.IN:
        cur = Currency.INR
    if at == AssetType.MF and cc == Country.OTHER:
        cc, cur = Country.IN, Currency.INR
    return at, cc, cur, asset_class_l2


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
    ltp = _to_float(
        _pick(
            row,
            "ltp",
            "last_traded_price",
            "lastPrice",
            "LTP",
            "current_price",
            "nav",
            "unit_price",
            "last_price",
            "close",
        )
    )
    inv_amt = _to_float(_pick(row, "invested_amount", "invested_value", "cost", "total_cost"))
    mval = _to_float(_pick(row, "market_value", "current_value", "value", "mkt_value"))
    if mval is None and ltp is not None:
        mval = qty * ltp
    mval = mval or 0.0
    if avg is None and inv_amt is not None and qty > 0:
        avg = inv_amt / qty

    rep_inr = _broker_reported_inr(row) or 0.0
    day_chg = _to_float(_pick(row, "day_change", "day_change_value", "dayChange", "pnl_today"))
    unreal = _to_float(_pick(row, "unrealized_pnl", "pnl", "gain", "overall_pnl"))
    if unreal is None and avg is not None and ltp is not None:
        unreal = (ltp - avg) * qty

    explicit_at = _pick(row, "asset_type", "assetType", "instrument_type", "category")
    text_blob = " ".join(
        str(x).lower()
        for x in (name, symbol, str(explicit_at or ""), str(_pick(row, "segment", "exchange") or ""))
    )
    at, cc, cur, asset_class_l2 = classify_holding(row, text_blob)

    acc = str(_pick(row, "account_id", "accountId", "folio_id", "folioId", "client_id") or "").strip()
    exch = str(_pick(row, "exchange", "segment", "listing_exchange") or "").strip()
    ind_key = _pick(row, "ind_key", "indKey", "instrument_key", "instrumentKey", "instrument_id", "instrumentId")
    hid = str(_pick(row, "id", "holding_id", "position_id") or "").strip()
    if ind_key is not None and str(ind_key).strip():
        ik = str(ind_key).strip()
        hid = _stable_id([ik, acc]) if acc else (ik[:128] if len(ik) <= 128 else _stable_id([ik]))
    elif not hid:
        if isin and acc:
            hid = _stable_id([isin, acc])
        elif symbol and acc and exch:
            hid = _stable_id([symbol.lower(), exch.lower(), acc])
        else:
            inv_code = str(_pick(row, "investment_code", "") or "")
            at_raw = str(explicit_at or "")
            hpct = str(_pick(row, "holding_percent", "") or "")
            inv_amt_s = str(inv_amt if inv_amt is not None else "")
            mval_s = str(mval)
            hid = _stable_id(
                [isin or "", inv_code, symbol or "", name, str(qty), at_raw, mval_s, inv_amt_s, hpct, acc]
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
        asset_class_l2=asset_class_l2,
        inr_market_value=rep_inr,
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
    return _dedupe_holdings(out)


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
