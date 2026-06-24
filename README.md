# TRUE WEALTH

Single-user **read-only** portfolio dashboard for an Indian investor. **INDmoney MCP** is the primary holdings source when configured; otherwise the live book is **empty** (no hidden sample data on the refresh path). Use `backend/sample_data/` only for offline dev fixtures.

**Not investment advice.** No trades, no stored broker passwords.

The main app uses route tabs: **`/today`**, **`/map`**, **`/decide`** (home redirects to `/today`). See [VERIFICATION.md](./VERIFICATION.md) for commands and a manual QA checklist.

## Repository layout

```
TrueWealth/
├── .env.example
├── .gitignore
├── LICENSE
├── README.md
├── backend/
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   │       ├── 001_initial_schema.py
│   │       ├── 002_rules_mcp_endpoint.py
│   │       └── 003_rules_mcp_bearer_token.py
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── state.py
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── router.py
│   │   │   ├── health.py
│   │   │   ├── portfolio.py
│   │   │   ├── rules.py
│   │   │   ├── mcp.py
│   │   │   └── stream.py
│   │   ├── mcp/
│   │   │   ├── __init__.py
│   │   │   ├── client.py          # JSON-RPC tools/list, tools/call
│   │   │   └── adapter.py         # Discovery + heuristic capability binding
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── allocations.py
│   │   │   ├── broadcast.py
│   │   │   ├── normalizer.py
│   │   │   ├── portfolio_service.py
│   │   │   ├── price_engine.py
│   │   │   └── pipelines/__init__.py   # News / fundamentals stubs (V1 empty)
│   │   └── tasks/
│   │       ├── __init__.py
│   │       └── background.py      # Price / holdings / alerts / heartbeat loops
│   ├── sample_data/
│   │   ├── holdings.json
│   │   └── transactions.json
│   ├── scripts/
│   │   └── mcp_probe.py           # CLI: tools/list + optional holdings summary
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_normalizer.py
│   │   └── test_allocations.py
│   ├── requirements.txt
│   └── pytest.ini
└── frontend/
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx
    │   ├── page.tsx
    │   └── mcp/
    │       ├── layout.tsx
    │       └── page.tsx
    ├── components/
    │   ├── AllocationCharts.tsx
    │   ├── AlertsPanel.tsx
    │   ├── Disclaimer.tsx
    │   ├── HeroCards.tsx
    │   ├── HoldingsTable.tsx
    │   ├── MetricTip.tsx
    │   ├── McpConnectionStepper.tsx
    │   ├── WealthHero.tsx
    │   ├── mcp/
    │   │   └── McpBlocks.tsx
    │   └── StatusBar.tsx
    ├── lib/
    │   ├── format.ts
    │   ├── types.ts
    │   ├── useSse.ts
    │   ├── allocationInsights.ts
    │   └── mcpDemoTools.ts
    ├── next.config.js
    ├── package.json
    ├── postcss.config.mjs
    ├── tailwind.config.ts
    └── tsconfig.json
```

## Internal API schema (normalized)

**NormalizedHolding**: extended `asset_type` (e.g. `EPF`, `CRYPTO`, `FD`, …), optional `asset_class_l2`, native `market_value` in `currency`, plus **`inr_market_value`** / `inr_unrealized_pnl` / `inr_day_change_value` and optional `fx_usd_inr_used` for the single **INR book** used in totals and allocation.

**PortfolioResponse**: `totals` (all **INR** when `base_currency` is INR), `allocation` (slices by native tag but **values are INR-equivalent**), `action_plan`, `performance` (snapshot-based TWRR/drawdown/vol; XIRR status), `mf_lab`, `history` (daily INR snapshots for the **active** portfolio view when snapshot metadata matches), `meta.data_completeness`, `meta.fx_usd_inr`, plus **`meta.active_view`**, **`meta.full_book_totals`**, **`meta.excluded_value`**, **`meta.coverage`**, **`meta.history_matches_view`**, **`meta.last_snapshot_at`**.

## Portfolio views

Saved in SQLite (`portfolio_views` + `rules.active_portfolio_view_id`). The dashboard **View** control filters which asset groups count toward totals, holdings, allocation, concentration, action plan, and snapshot history. **`meta.full_book_totals`** is always the unfiltered INR book; **`meta.excluded_value`** is full minus active. Presets: **All assets** (everything on), **Investable only** (hides FD, EPF, gold, other bucket), **Locked long-term** (only FD, EPF, gold, other). API: `GET/POST /api/views`, `PUT /api/views/{id}`, `POST /api/views/active/{id}`, `POST /api/views/{id}/reset`. Changing toggles triggers a server-side recompute without MCP refresh.

## Prerequisites

- **Python 3.11+** recommended (3.9+ may work with current typing style).
- **Node.js 18+** for the frontend.

## Environment variables

Copy `.env.example` to `backend/.env` (or export vars in your shell). Important:

| Variable | Purpose |
|----------|---------|
| `INDMONEY_MCP_URL` | Optional override of the MCP JSON-RPC URL. If unset, the server uses INDmoney’s documented default **`https://mcp.indmoney.com/mcp`**. The dashboard can still save a different URL in SQLite (or clear to mock-only). |
| `DATABASE_URL` | Optional override; default `sqlite+aiosqlite:///.../backend/data/truewealth.db`. |
| `CORS_ORIGINS` | Comma-separated origins; default `http://localhost:3000`. |
| `USDINR_RATE` | Static USD→INR spot for converting US legs into the INR book when the broker does not send INR book fields (default **94.61**; override via env). |
| `OHLC_ENRICH_MAX` | Max MCP `get_indian_stocks_ohlc` calls per price refresh to proxy day P&amp;L when missing (default **5**). |

## Run migrations after pulling

```bash
cd backend && source .venv/bin/activate && alembic upgrade head
```

New columns (holdings INR book, `mf_fund_cache`, `fx_rates`, rules MCP, OAuth, etc.) require this.

## Run the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
mkdir -p data
alembic upgrade head
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Endpoints: `GET /api/health`, `GET /api/portfolio`, `GET /api/stream` (SSE), `GET|POST /api/rules`, **`POST /api/mcp/connect`**, **`POST /api/mcp/bearer`** (save or clear pasted Bearer token in SQLite), **`POST /api/mcp/disconnect`** (clear saved URL and token from the UI).

Background cadence (defaults, overridable via `rules` table / POST body):

- **~10s**: price pass + `prices` SSE (uses LTP when present, else deterministic pseudo-price from symbol hash).
- **~120s**: MCP/mock holdings pull + `holdings` SSE.
- **~60s**: alerts recompute + `alerts` SSE.
- **~15s**: `status` heartbeat SSE.

## Run the frontend

From the repo root you can run **`npm run dev`** / **`npm run build`** (see root `package.json`); they delegate to `frontend/`. First-time setup still needs dependencies in `frontend`:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** for the dashboard and **http://localhost:3000/mcp** for the INDmoney MCP landing (thesis, tool catalog, security, quickstart). `next.config.js` rewrites `/api/*` to `http://127.0.0.1:8000/api/*`, so start the backend first.

## INDmoney MCP URL (defaults)

INDmoney documents a **single public endpoint** for all supported clients: **`https://mcp.indmoney.com/mcp`** ([INDmoney MCP](https://www.indmoney.com/mcp)). TRUE WEALTH uses that as the **built-in default** when the database has no override and you have not chosen mock-only.

The URL field in the UI is still useful for **proxies**, **tunnels**, or if INDmoney publishes a different host for your region.

### Browser sign-in vs this local API

INDmoney’s page explains that connecting (e.g. in Claude) opens their sign-in flow (**OTP + MPIN**, consent, OAuth 2.1). This app is a **headless** JSON-RPC client: it does not open a browser for you, so you may see **401 / auth errors** until you use an authenticated proxy or attach a **Bearer token** (see below). That is separate from “which URL to call.” A **live probe** of their MCP host shows the same server also publishes **standard OAuth** (`/.well-known/...`, `/register`, `/authorize`, `/token`); see **`docs/INDMONEY_MCP_OAUTH.md`** for details and a path to connect **without** Claude once OAuth is implemented in-app.

### Live portfolio data (True Wealth backend)

1. **OAuth**: The hosted MCP is built for clients that complete INDmoney’s **browser OAuth**. True Wealth only sends `POST` JSON-RPC; it does not implement that redirect flow.
2. **Ways to get real holdings into this app**
   - **Dashboard token (SQLite)**: on the home page, expand **Help: how to get a token…** under INDmoney connect, then use **Save token & connect** if you have a Bearer string from your own bridge. `POST /api/mcp/bearer` saves or clears it; see API list below.
   - **`INDMONEY_MCP_BEARER_TOKEN`** in `backend/.env` (optional): used when no non-empty token is saved in SQLite; **restart uvicorn** after edits.
   - **Authenticated proxy**: set that URL in the UI or `INDMONEY_MCP_URL` if the proxy handles auth without a client Bearer.
3. **Without the above**: Expect **401** against `https://mcp.indmoney.com/mcp` and **mock** sample data in the UI, which is normal for local development.

### Connect checklist (dashboard)

1. **Backend**: `cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`
2. **Frontend**: from repo root `npm run dev` (or `cd frontend && npm run dev`) so the UI is on **http://localhost:3000** and `/api` proxies to **:8000**
3. If the page says it **could not load portfolio**, fix the API first (wrong port, firewall, or uvicorn not running).
4. **Save token & connect** (dashboard): saves the MCP URL, optionally saves a pasted Bearer to SQLite, then runs discovery. Expand the in-page **Help** disclosure for how INDmoney’s Claude flow differs from this app. Without auth, INDmoney usually returns **401** and the UI stays on **mock**.

## Probe INDmoney MCP (CLI)

From `backend/`, with `backend/.env` loaded (same variables as the API: `INDMONEY_MCP_URL`, `INDMONEY_MCP_BEARER_TOKEN`):

```bash
cd backend
python3 scripts/mcp_probe.py
python3 scripts/mcp_probe.py --holdings
python3 scripts/mcp_probe.py --env-only   # ignore SQLite; .env bearer only
```

By default the script reads **`DATABASE_URL`** (default `backend/data/truewealth.db`) and uses the same token order as the API: **OAuth access token** (if `expires_at` is still in the future), then **saved MCP bearer** from the dashboard, then **`INDMONEY_MCP_BEARER_TOKEN`**. It does **not** refresh an expired OAuth row from the CLI—use the app or set a bearer in `.env`. It prints the resolved MCP URL, auth source, `tools/list` entries, selected holdings/tx tools, and with `--holdings` a short normalized summary. **`--env-only`** skips SQLite (matches your terminal when only `.env` is set and no token).

If nothing provides a Bearer, INDmoney returns **401**; the script prints short next steps.

## MCP troubleshooting

1. **Discovery**: On startup the API logs discovered tool names and the heuristic pick for “holdings-like” and “transactions-like” tools (keyword scoring, no hardcoded vendor tool IDs).
2. **Protocol**: The client sends JSON-RPC 2.0 `POST` bodies: `tools/list`, optional `initialize`, then `tools/call` with `{ "name": "<discovered>", "arguments": {} }`. Optional header: **`INDMONEY_MCP_BEARER_TOKEN`** → `Authorization: Bearer …`. Put a different base URL in `INDMONEY_MCP_URL` or the dashboard if you use a proxy.
3. **Failures**: Any discovery or holdings error keeps the app **up** and switches (or stays) in **mock** mode with `mcp_degraded` / `mcp_connected` flags in `meta`.

## Mock mode

If you choose **mock-only** from the dashboard (cleared URL), or MCP discovery/calls fail, holdings load from `backend/sample_data/holdings.json` (and transactions from `transactions.json`). `meta.mode` is `mock` and the UI shows a **Mock book** pill.

## Scope & limitations (V1)

Indian tax lots, STT/LTCG sequencing, SIP-specific cost basis, and per-name FX hedges are **not modeled** in the dashboard math—figures are indicative for allocation and risk triage only. Target-date glidepaths and automated tax harvesting remain out of scope until lot-level data is available.

**Planned follow-ups (not in V1 UI):** a dedicated **tax context** panel needs purchase dates / tenure from MCP or manual DB columns; a **target allocation** widget needs persisted targets, drift math versus `allocation`, and Decide/Map surfacing—track as larger features when product priority allows.

## Tests

```bash
cd backend
source .venv/bin/activate
pytest
```

## SQL tables (V1)

`holdings_current`, `transactions`, `portfolio_snapshots`, `rules`, `refresh_log`, plus **stub** tables `news_items`, `fundamentals`, `pipeline_runs` for future news/fundamentals pipelines (no rows written in V1 beyond migrations).

## Safety

Read-only analytics. No order placement. Secrets only via `.env` (never commit real `.env`).
