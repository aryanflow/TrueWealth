# True Wealth verification

## Commands (from repository root unless noted)

Database migrations:

```bash
cd backend && alembic upgrade head
```

Backend tests:

```bash
cd backend && python -m pytest -q
```

Frontend production build (root delegates to `frontend/`):

```bash
npm run build
```

## Manual checklist after UI or API changes

1. **Settings, Connection**: Connect INDmoney opens OAuth and returns to the active tab (for example `/today`). Disconnect clears the session and leaves a coherent empty or mock state. Refresh now calls `POST /api/refresh` and updates last sync times.
2. **Settings, Views**: Active view dropdown switches the book. Asset group toggles persist. Reset restores defaults.
3. **Settings, Advanced**: MCP endpoint and discovered tool names are read-only. Raw last error appears when present. Reconnect live stream and reload controls work without breaking the page.
4. **Today**: No full holdings table. Hero shows total wealth, as-of, confidence badge (Good, Partial, or Degraded), one insight line, three summary tiles, action chips when relevant, top five preview rows open the holding inspector.
5. **Map**: Exposure horizontal bars and ranked list, concentration ladder with trim or dilute hints, wealth and drawdown charts or empty state, expandable holdings table with Simple or Pro columns, row click opens the holding inspector.
6. **Decide**: Action plan cards and simulate modal show before or after weights and asset exposure strips. Deep links from Today or the inspector open simulate when query params are present.

## API notes

- `GET /api/status`: lightweight status and quality fields for Settings.
- `POST /api/refresh`: forces holdings then prices refresh (same effect as `GET /api/portfolio?refresh=1`).
