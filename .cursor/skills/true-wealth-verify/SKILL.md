---
name: true-wealth-verify
description: >-
  Runs migrations, backend tests, and frontend production build for the True
  Wealth repo. Use when verifying changes, before merge, after backend or
  frontend edits, or when the user says run tests, CI, pytest, or build.
---

# True Wealth — verify

## Default verification (run in repo root unless noted)

1. **DB migrations** (from `backend/`, venv active):

   ```bash
   cd backend && alembic upgrade head
   ```

2. **Backend tests**:

   ```bash
   cd backend && python -m pytest -q
   ```

3. **Frontend production build** (root delegates to `frontend/`):

   ```bash
   npm run build
   ```

Fix failures (deps, ports, migration drift) before reporting success.

## Dev restart (when servers misbehave)

Stop existing **uvicorn** and **Next** jobs first (Ctrl+C or end background task), then start clean so ports and `.next` hot reload stay sane. Do not only append “run these” for routine verify unless the user asked for instructions only.

## Scope

Single-user read-only dashboard; no broker writes. Empty live book without MCP is expected, not a test failure by itself.
