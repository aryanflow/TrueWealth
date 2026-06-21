---
name: true-wealth-holdings-pipeline
description: >-
  Explains True Wealth holdings normalization, INR book, FX, dedupe, and quality
  passes. Use when fixing wrong totals, USD weights, double-counted lines, bad
  last_price, MCP field mapping, normalizer, fx_book, price_engine,
  holding_quality, or state refresh paths.
---

# True Wealth — holdings → INR book

## File map

| Area | Module |
|------|--------|
| MCP rows → `NormalizedHolding` | `backend/app/services/normalizer.py` |
| Pseudo-LTP / preserve broker MV | `backend/app/services/price_engine.py` |
| Native → INR (`inr_*`, USD×rate) | `backend/app/services/fx_book.py` |
| Reconcile LTP vs MV, absurd USD price, pipeline glue | `backend/app/services/holding_quality.py` |
| Fetch, price, persist, cache | `backend/app/state.py` |
| Totals, views, snapshots | `backend/app/services/portfolio_service.py` |

## Invariants (do not regress)

1. **Broker `market_value`**  
   `apply_prices_to_holdings` must not overwrite a non-zero broker `market_value` with `qty * last_price`. Only fill MV when missing or ~zero.

2. **Broker-reported INR**  
   If MCP populates INR book fields (`market_value_inr`, `inr_market_value`, … — see `_broker_reported_inr` in normalizer), `apply_inr_book` must use that as `inr_market_value` and **not** multiply native USD MV by FX again.

3. **Stable identity**  
   Prefer `ind_key` / `instrument_id` (+ `account_id` when present); fallback `isin`+account, then symbol+exchange+account; avoid deduping by name. `normalize_payload` dedupes by `id`, keeping the row with larger `|market_value| + |inr_market_value|`.

4. **LTP field order**  
   Prefer `ltp`, `last_traded_price`, `lastPrice` before `close` so US lines do not pick a wrong “close” field as share price.

5. **Pipeline**  
   After priced dicts: `prepare_holdings_from_priced_rows` (validate → reconcile LTP vs MV → `apply_inr_book` → absurd-USD exclusion). DB-only recompute: `finalize_holdings_pipeline` on `read_holdings_from_db` results (`rebuild_portfolio_cache`).

6. **Totals**  
   Aggregations use `book_value_inr` / `sum_inr_market`; excluded lines have `book_include=False` and must not inflate totals; surface counts via `DataCompleteness` / UI banner.

## MCP source

`backend/app/mcp/adapter.py` discovers a holdings-like tool; INDmoney often uses **`networth_holdings`** merged per `asset_type`. Live path has **no hidden sample** data.
