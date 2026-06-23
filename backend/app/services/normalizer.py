"""Normalize raw broker/MCP payloads into NormalizedHolding."""

from __future__ import annotations

import hashlib
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from app.config import settings
from app.schemas import AssetType, Country, Currency, NormalizedHolding
from app.services.fx_book import dedupe_holdings_by_instrument

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


def _us_stock_ltp_inr_hint_to_usd(ltp: float) -> float:
    """INDmoney often quotes US names in INR per share while ``asset_type`` is US_STOCK.

    Values like ~19_893 (NVDA) or ~65_000 (VOO) are INR; dividing by USDINR yields a plausible
    USD last. Very high USD tickers (e.g. BRK.A) stay unchanged: ``ltp/rate`` would exceed the
    converted band.
    """
    rate = float(settings.usdinr_rate or 94.61)
    if rate <= 0 or ltp < 12_000:
        return ltp
    usd = ltp / rate
    if 0.01 <= usd <= 4_000:
        return usd
    return ltp


# INDmoney often uses one generic ``ind_key`` for every row of a sleeve (e.g. all EPF accounts).
_MULTI_ACCOUNT_EXPLICIT_TYPES = frozenset(
    {
        "EPF",
        "FD",
        "NPS",
        "PPF",
        "SA",
        "RD",
        "INSURANCE",
        "BOND",
        "RE",
        "VEHICLE",
        "AIF",
        "PMS",
    }
)


def _resolve_raw_market_value(
    row: dict[str, Any],
    *,
    explicit_upper: str,
    qty: float,
    ltp: float | None,
    bal: float | None,
) -> float:
    """Native market value in row currency.

    US stocks: prefer explicit position-size fields before ``market_value`` — INDmoney sometimes
    repeats per-share ``ltp`` in ``market_value``, which would inflate fractional positions. If only
    that echo is present, fall back to ``quantity * ltp`` (position notional in USD).
    """
    if explicit_upper == "US_STOCK":
        mval = _to_float(
            _pick(
                row,
                "current_value",
                "current_market_value",
                "current_market_value_usd",
                "holding_current_value",
                "holding_value",
                "position_value",
                "position_current_value",
                "portfolio_value",
                "market_value",
                "mkt_value",
                "corpus",
                "total_value",
                "value",
            )
        )
    else:
        mval = _to_float(
            _pick(
                row,
                "market_value",
                "current_value",
                "mkt_value",
                "corpus",
                "total_value",
                "holding_value",
                "portfolio_value",
                "value",
            )
        )
    if mval is None and ltp is not None:
        mval = qty * float(ltp)
    mval_f = float(mval or 0.0)

    if explicit_upper == "US_STOCK" and qty > 0 and ltp is not None:
        lp = float(ltp)
        if lp > 1e-12 and mval_f > 0:
            notional = float(qty) * lp
            # ``market_value`` duplicated last price (per share) while qty is fractional shares.
            rel_mv_lp = abs(mval_f - lp) / lp
            if rel_mv_lp < 0.025 and abs(notional - mval_f) / max(mval_f, 1e-9) > 0.05:
                mval_f = notional
            # Broker ``market_value`` can be INR-scale or wrong while LTP is already USD — trust qty×LTP.
            if notional > 1e-8 and mval_f > notional * 4.0 + 1.0:
                mval_f = notional

    if mval_f <= 0 and bal is not None and bal > 0 and qty <= 0:
        mval_f = float(bal)
    return mval_f


def _json_field_name(k: object) -> str:
    """Normalize JSON keys so ``currentValueInr`` matches ``current_value_inr``."""
    s = str(k).strip()
    if not s:
        return ""
    return re.sub(r"(?<!^)(?=[A-Z])", "_", s).replace("-", "_").lower()


def _broker_reported_inr(row: dict[str, Any]) -> float | None:
    """INDmoney often sends a separate INR book figure for US/global lines; prefer over FX on native MV.

    Keys are matched case-insensitively and across common camelCase variants.
    """
    inv = {_json_field_name(k): v for k, v in row.items() if isinstance(k, str)}
    keys = (
        "inr_market_value",
        "market_value_inr",
        "current_value_inr",
        "value_in_inr",
        "value_inr",
        "mval_inr",
        "portfolio_value_inr",
        "amount_inr",
        "converted_value_inr",
        "indian_value",
        "holding_value_inr",
        "market_value_in_inr",
        "total_value_inr",
        "current_market_value_inr",
        "position_value_inr",
    )
    for want in keys:
        v = _to_float(inv.get(want))
        if v is not None and v > 0:
            return v
    return None


_ASSET_HINTS = (
    (AssetType.CASH, ("cash", "liquid", "savings", "bank")),
    (AssetType.MF, ("mutual", "mf", "sip", "fund")),
    (AssetType.ETF, ("etf", "exchange traded")),
    # Fixed-income / retirement before equity text: employer names often contain "share"/"equity".
    (AssetType.EPF, ("epf", "provident")),
    (AssetType.PPF, ("ppf", "public provident")),
    (AssetType.NPS, ("national pension", "nps")),
    (AssetType.IN_STOCK, ("equity", "stock", "nse", "bse", "share")),
    (AssetType.US_STOCK, ("us stock", "nasdaq", "nyse", "us_equity")),
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
    # US listings: canonical USD native leg for allocation / FX buckets
    if at == AssetType.US_STOCK:
        cc, cur = Country.US, Currency.USD
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

    # Do not map `balance` to quantity except crypto (some feeds only expose coin size as balance).
    explicit_pre = str(_pick(row, "asset_type", "assetType") or "").upper().replace(" ", "_").replace("-", "_")
    # INDmoney often sends a generic `quantity` (e.g. 1) for MFs while `total_units` / `units` hold scheme units.
    qty_keys: tuple[str, ...] = ("total_units", "units", "shares", "no_of_shares", "quantity", "qty")
    if explicit_pre == "CRYPTO":
        qty_keys = qty_keys + ("balance", "available_balance")
    qty = _to_float(_pick(row, *qty_keys)) or 0.0
    bal = None if explicit_pre == "CRYPTO" else _to_float(_pick(row, "balance", "available_balance"))
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
    if explicit_pre == "US_STOCK" and ltp is not None:
        ltp = _us_stock_ltp_inr_hint_to_usd(float(ltp))
    inv_amt = _to_float(
        _pick(
            row,
            "invested_amount",
            "invested_value",
            "investment_amount",
            "amount_invested",
            "total_invested",
            "purchase_value",
            "total_cost",
            "cost",
            "principal",
            # Omit `book_value` — feeds often use it for current book / NAV aggregate, not cost basis.
        )
    )
    mval = _resolve_raw_market_value(row, explicit_upper=explicit_pre, qty=qty, ltp=ltp, bal=bal)
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
    name_key = (name or "").strip().lower()[:160]
    if ind_key is not None and str(ind_key).strip():
        ik = str(ind_key).strip()
        if explicit_pre in _MULTI_ACCOUNT_EXPLICIT_TYPES:
            # Same ``ind_key`` across multiple accounts (common for EPF) must not dedupe to one line.
            hid = _stable_id([ik, acc, name_key])
        elif acc:
            hid = _stable_id([ik, acc])
        elif len(ik) <= 128:
            hid = ik
        else:
            hid = _stable_id([ik])
    elif not hid:
        if isin and acc:
            hid = _stable_id([isin, acc])
        elif symbol and acc and exch:
            hid = _stable_id([symbol.lower(), exch.lower(), acc])
        else:
            inv_code = str(_pick(row, "investment_code", "") or "")
            at_raw = str(explicit_at or "")
            hid = _stable_id([isin or "", inv_code, symbol or "", name_key, at_raw, acc])

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
    return dedupe_holdings_by_instrument(out)


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
