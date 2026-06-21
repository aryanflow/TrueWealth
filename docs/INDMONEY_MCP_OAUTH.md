# INDmoney MCP: connectivity probe (no Claude required)

Probed from the network on **2026-06-22** against `https://mcp.indmoney.com/mcp`.

## Unauthenticated JSON-RPC

`POST /mcp` with `{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}` returns:

- **HTTP 401**
- Body: `{"error":"invalid_token","error_description":"Authentication required"}`
- Header `www-authenticate` includes  
  `resource_metadata="https://mcp.indmoney.com/.well-known/oauth-protected-resource"`

So the MCP HTTP surface is **OAuth-protected**; a valid **Bearer** access token is required for JSON-RPC.

## OAuth metadata (public)

`GET https://mcp.indmoney.com/.well-known/oauth-protected-resource` returns JSON including:

- `authorization_servers`: `["https://mcp.indmoney.com/"]`
- `scopes_supported`: `portfolio:read` (and related)

`GET https://mcp.indmoney.com/.well-known/oauth-authorization-server` returns a full authorization server document, including:

| Field | Value |
|--------|--------|
| `authorization_endpoint` | `https://mcp.indmoney.com/authorize` |
| `token_endpoint` | `https://mcp.indmoney.com/token` |
| `registration_endpoint` | `https://mcp.indmoney.com/register` |
| `revocation_endpoint` | `https://mcp.indmoney.com/revoke` |
| `code_challenge_methods_supported` | `S256` (PKCE) |
| `grant_types_supported` | `authorization_code`, `refresh_token` |
| `response_types_supported` | `code` |

So the same host implements **standard OAuth 2.1-style** discovery, not a Claude-only proprietary wire format.

## Dynamic client registration

`POST https://mcp.indmoney.com/register` with `Content-Type: application/json` and a minimal public client body, for example:

```json
{
  "client_name": "TrueWealth-probe",
  "redirect_uris": ["http://127.0.0.1:8765/callback"],
  "token_endpoint_auth_method": "none"
}
```

returned **HTTP 201** with a JSON body including:

- `client_id` (UUID)
- `grant_types`, `response_types`, `scope` (`portfolio:read market:read`), etc.

So **any application** (including True Wealth) can obtain a `client_id` without Claude, as long as it uses a **registered redirect URI** (typically `http://127.0.0.1:<port>/...` or an HTTPS app callback).

## Authorize endpoint (sanity)

`GET https://mcp.indmoney.com/authorize` without query parameters returns **400** with JSON listing required fields, including:

- `client_id`
- `response_type`
- `code_challenge`

That matches a **PKCE authorization code** flow.

## Conclusion

- **Claude is not technically required** to talk to INDmoney MCP. It is the **documented product path** for end users.
- **True Wealth** implements **register → authorize (browser) → token** as `GET /api/indmoney/auth/start`, `GET /api/indmoney/auth/callback`, plus `POST /api/indmoney/auth/refresh` and `POST /api/indmoney/auth/disconnect`. Env: `TRUEWEALTH_API_PUBLIC_BASE` (callback origin), `FRONTEND_OAUTH_SUCCESS_URL`, `CORS_ORIGINS` (allowlist for optional `return_base` on start), `INDMONEY_OAUTH_ISSUER`. The dashboard link passes `return_base` so the post-OAuth **303** returns to the **same browser origin** you opened (e.g. `localhost` vs `127.0.0.1`). Pasting a Bearer in the UI still works and is used if OAuth access is missing.

Further work: encrypt `client_secret` / tokens at rest, multi-user support, and richer error UX if INDmoney changes behaviour.

## True Wealth routes (implemented)

| Method | Path | Purpose |
|--------|------|--------|
| GET | `/api/indmoney/auth/start` | DCR if needed, PKCE, optional `return_base` (allowlisted), redirect to INDmoney `/authorize` |
| GET | `/api/indmoney/auth/callback` | Exchange code, store tokens, re-run MCP discovery |
| POST | `/api/indmoney/auth/refresh` | Refresh access token via `refresh_token` |
| POST | `/api/indmoney/auth/disconnect` | Revoke (best effort) and clear stored OAuth tokens |

`POST /api/mcp/disconnect` also revokes OAuth tokens and clears the saved MCP URL and pasted Bearer.

After INDmoney redirects, the browser may **briefly show** `…/api/indmoney/auth/callback?code=…` on the API host; the backend returns **303** to the success page (default **`FRONTEND_OAUTH_SUCCESS_URL`**, e.g. `http://localhost:3000/?indmoney_oauth=ok`, or the **`return_base`** you send from the dashboard if it matches `FRONTEND_OAUTH_SUCCESS_URL` or **`CORS_ORIGINS`**) **immediately** after saving tokens; MCP discover + holdings refresh run **in the background** so the tab does not sit waiting on the callback URL. **Do not refresh** the callback URL: the `code` is **single-use**.

**Token / revoke:** send **`client_id` in the form body** and **`Authorization: Basic`** (`client_id` + `client_secret`, empty password if the client is public). INDmoney returns `unauthorized_client` if either piece is missing.

## Community references (not affiliated)

### [abinashstack/indmoney-watch](https://github.com/abinashstack/indmoney-watch) — relevant

Open-source **macOS** Go CLI (`indw`) that implements **OAuth 2.1 + PKCE + dynamic client registration** against `mcp.indmoney.com`, stores tokens in the **Keychain**, and calls INDmoney MCP over **JSON-RPC (Streamable HTTP + SSE)**. Useful as a working reference for:

- End-to-end **browser login** (`indw login`) without Claude
- **Tool names** the server exposes in practice (examples from their README): `get_user_networth_v2`, `holdings`, `user_watchlist`, `get_indian_stocks_details` / `get_us_stocks_details`, `indian_stocks_sips`, `mf_sips`

INDmoney can change schemas anytime; treat any third-party client as **reverse-engineered**, not a contract.

### [gptshivam595/INDmoney-Review-mcp-agent](https://github.com/gptshivam595/INDmoney-Review-mcp-agent) — different problem

Despite the name, this repo is a **weekly App Store / Google Play review** aggregation agent (clusters reviews, Google Docs, Gmail, operator dashboard). The `--product indmoney` flag is a **preset for that review pipeline**, not integration with INDmoney’s **financial** MCP. It does **not** substitute for OAuth or portfolio JSON-RPC against `mcp.indmoney.com`.
