---
name: true-wealth-api-types-sync
description: >-
  Keeps frontend TypeScript types aligned with FastAPI Pydantic schemas for True
  Wealth. Use when changing PortfolioResponse, PortfolioMeta, DataCompleteness,
  NormalizedHolding, or any field returned by GET /api/portfolio or SSE payloads.
---

# True Wealth — API ↔ `frontend/lib/types.ts`

## Rule

When adding or renaming fields on **`backend/app/schemas.py`** models that the dashboard consumes, update **`frontend/lib/types.ts`** in the same change (or immediately after) so props, SSE handlers, and charts stay type-accurate.

## High-churn pairs

- `NormalizedHolding` ↔ `NormalizedHolding` interface (`book_include`, `inr_*`, etc.)
- `PortfolioMeta` ↔ `PortfolioMeta` interface (`data_completeness`, `active_view`, `full_book_totals`, `excluded_value`, `coverage`, …)
- `DataCompleteness` ↔ `DataCompleteness` interface

## Verify

Run `npm run build` in the repo root after TS edits; fix type errors before finishing.
