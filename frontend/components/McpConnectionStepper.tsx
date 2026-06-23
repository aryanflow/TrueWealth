"use client";

import { useEffect, useState, type FormEvent } from "react";

import { MCP_PUBLIC_ENDPOINT } from "@/lib/mcpDemoTools";

import type { PortfolioMeta } from "@/lib/types";

type Props = {
  initialUrl: string;
  meta: PortfolioMeta;
  onDone: () => void;
};

function formatDetail(d: unknown): string {
  if (typeof d === "string") return d;
  if (Array.isArray(d))
    return d
      .map((x) =>
        typeof x === "object" && x && "msg" in x ? String((x as { msg: string }).msg) : JSON.stringify(x),
      )
      .join("; ");
  return "Request failed";
}

export function McpConnectionStepper({ initialUrl, meta, onDone }: Props) {
  const resolvedUrl = initialUrl.trim() || MCP_PUBLIC_ENDPOINT;
  const [url, setUrl] = useState(resolvedUrl);
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setUrl(initialUrl.trim() || MCP_PUBLIC_ENDPOINT);
  }, [initialUrl]);

  const step3Active = meta.mode === "live" && meta.mcp_connected && !meta.mcp_degraded;

  function startIndmoneyOAuth(scope: string) {
    const path =
      typeof window !== "undefined" && window.location.pathname && window.location.pathname !== "/"
        ? window.location.pathname
        : "/today";
    const rb = encodeURIComponent(`${window.location.origin}${path}`);
    const sc = encodeURIComponent(scope);
    window.location.assign(`/api/indmoney/auth/start?scope=${sc}&return_base=${rb}`);
  }

  async function postConnect(endpoint: string) {
    const r = await fetch("/api/mcp/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mcp_endpoint: endpoint.trim() }),
    });
    const j = (await r.json().catch(() => ({}))) as {
      detail?: unknown;
      mcp_connected?: boolean;
      mcp_degraded?: boolean;
      mode?: string;
      tool_inventory?: string[];
    };
    if (!r.ok) throw new Error(formatDetail(j.detail));
    if (j.mcp_connected && !j.mcp_degraded) {
      setMsg(`Connected. Discovery OK. Book mode: ${j.mode ?? "unknown"}.`.trim());
    } else if (j.mcp_connected && j.mcp_degraded) {
      setMsg("MCP responded but no holdings-like tool matched. Check Advanced for tool names or backend logs.");
    } else {
      setMsg(
        "INDmoney did not accept this client (typical: 401 without a valid token). The UI may stay on mock sample data. Try Save token & connect after you have a Bearer string, or use a proxy URL.",
      );
    }
  }

  async function saveAndConnect(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (token.trim()) {
        const br = await fetch("/api/mcp/bearer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bearer_token: token.trim() }),
        });
        const bj = (await br.json().catch(() => ({}))) as { detail?: unknown };
        if (!br.ok) throw new Error(formatDetail(bj.detail));
      }
      await postConnect(url);
      onDone();
    } catch (er) {
      const m = er instanceof Error ? er.message : "Failed";
      if (m === "Failed to fetch" || m.includes("NetworkError")) {
        setMsg("Cannot reach the True Wealth API from this page.");
      } else {
        setMsg(m);
      }
    } finally {
      setBusy(false);
    }
  }

  async function clearToken() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/mcp/bearer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bearer_token: "" }),
      });
      const j = (await r.json().catch(() => ({}))) as { detail?: unknown };
      if (!r.ok) throw new Error(formatDetail(j.detail));
      setToken("");
      setMsg("Saved token cleared. Reconnect if you still want live data.");
      onDone();
    } catch (er) {
      setMsg(er instanceof Error ? er.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/mcp/disconnect", { method: "POST" });
      const j = (await r.json().catch(() => ({}))) as { detail?: unknown };
      if (!r.ok) throw new Error(formatDetail(j.detail));
      setToken("");
      setMsg("Mock only: URL, saved token, and INDmoney OAuth tokens cleared.");
      onDone();
    } catch (er) {
      setMsg(er instanceof Error ? er.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="rounded-2xl border border-line bg-surface/60 p-5 shadow-card"
      aria-label="Connect INDmoney MCP"
    >
      <h2 className="font-display text-lg text-ink">INDmoney: simple connect</h2>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        This dashboard sends JSON-RPC to your MCP URL. You can <strong className="text-ink">sign in with INDmoney</strong>{" "}
        below (OAuth 2.1 + PKCE + dynamic registration on <span className="font-mono text-ink/80">mcp.indmoney.com</span>
        ), or paste a Bearer token if you use a proxy. Tokens and OAuth secrets live in <strong className="text-ink">local SQLite only</strong>, not in git.
      </p>

      <div className="mt-4 rounded-xl border border-ion/25 bg-ion/[0.07] p-4">
        <p className="text-sm font-medium text-ink">Browser sign-in (recommended)</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Opens INDmoney to approve scopes. After approval you are sent back to this site&apos;s origin (same tab
          host as the dashboard). Your API must use the same host/port as{" "}
          <span className="font-mono text-ink/80">TRUEWEALTH_API_PUBLIC_BASE</span> (see backend <span className="font-mono">.env</span>
          ); the default callback is <span className="font-mono text-ink/80">http://127.0.0.1:8000/api/indmoney/auth/callback</span>.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => startIndmoneyOAuth("portfolio:read")}
            className="inline-flex items-center justify-center rounded-xl bg-ion px-4 py-2.5 text-xs font-semibold text-twilight transition hover:bg-ion/90"
          >
            Connect with INDmoney (portfolio)
          </button>
          <button
            type="button"
            onClick={() => startIndmoneyOAuth("portfolio:read market:read")}
            className="inline-flex items-center justify-center rounded-xl border border-line px-4 py-2.5 text-xs font-medium text-ink transition hover:border-ion/35"
          >
            portfolio + market read
          </button>
        </div>
        {meta.indmoney_oauth_connected ? (
          <p className="mt-2 text-[11px] text-mintglass">OAuth session on file for this machine.</p>
        ) : null}
      </div>

      <details className="mt-3 rounded-xl border border-line/70 bg-canvas/35">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink">
          Help: how to get a token, how INDmoney MCP works, how to update True Wealth
        </summary>
        <div className="space-y-4 border-t border-line/60 px-4 pb-4 pt-3 text-xs leading-relaxed text-muted">
          <section>
            <p className="font-medium text-ink">Can True Wealth connect without Claude?</p>
            <p className="mt-1">
              Yes, <strong className="text-ink">in principle</strong>. The same host publishes standard OAuth: public
              metadata at{" "}
              <span className="font-mono text-ink/80">/.well-known/oauth-authorization-server</span>, dynamic client
              registration at <span className="font-mono text-ink/80">/register</span>, browser sign-in at{" "}
              <span className="font-mono text-ink/80">/authorize</span> (PKCE), and tokens at{" "}
              <span className="font-mono text-ink/80">/token</span>. A raw <span className="font-mono">POST /mcp</span>{" "}
              without a Bearer still returns <strong className="text-ink">401</strong>, as expected.
            </p>
            <p className="mt-2">
              True Wealth now runs that flow for you: <span className="font-mono text-ink/90">GET /api/indmoney/auth/start</span>{" "}
              registers a client when needed, stores PKCE state, redirects to INDmoney, then{" "}
              <span className="font-mono text-ink/90">/api/indmoney/auth/callback</span> exchanges the code and saves tokens in SQLite.
              Technical notes: <span className="font-mono text-ink/90">docs/INDMONEY_MCP_OAUTH.md</span>.
            </p>
          </section>

          <section>
            <p className="font-medium text-ink">How do I get a Bearer token for True Wealth today?</p>
            <p className="mt-1">
              On <strong className="text-ink">indmoney.com/mcp</strong>, INDmoney explains that you connect through{" "}
              <strong className="text-ink">Claude</strong> (web, desktop, or Claude Code): add a custom connector, paste{" "}
              <span className="font-mono text-ink/90">{MCP_PUBLIC_ENDPOINT}</span>, click Connect, then sign in on
              INDmoney with mobile, OTP, and MPIN, and approve consent. That flow uses{" "}
              <strong className="text-ink">OAuth 2.1 with PKCE</strong>. They state there are{" "}
              <strong className="text-ink">no long-lived API keys</strong> for you to copy, and that access is read-only
              (no trades). The short-lived session is between INDmoney and the MCP host (for example Claude), not
              something this app can read out for you.
            </p>
            <p className="mt-2">
              So a pasteable <span className="font-mono">Authorization: Bearer</span> value only appears if{" "}
              <strong className="text-ink">you</strong> add software in the middle (a gateway, lab proxy, or similar) that
              completes login and then either forwards MCP to this backend or gives you a machine token their docs
              describe. If you only use official Claude plus INDmoney, use Claude for questions; keep True Wealth on
              mock, or add your own bridge later.
            </p>
          </section>

          <section>
            <p className="font-medium text-ink">INDmoney MCP in Claude (official quick path)</p>
            <ol className="mt-1 list-decimal space-y-1 pl-4">
              <li>Open Claude, go to Settings, Connectors, add a custom connector.</li>
              <li>
                Paste the server URL: <span className="font-mono text-ink/90">{MCP_PUBLIC_ENDPOINT}</span> (streamable
                HTTP in Claude Code / Desktop config as in their docs).
              </li>
              <li>
                Click Connect. You are redirected to INDmoney, enter OTP and MPIN there (not on Claude), approve the
                consent screen, then return to Claude.
              </li>
            </ol>
            <p className="mt-2">
              After that, Claude can call many tools (portfolio snapshot, holdings, mutual funds, Indian and US
              market data, options, charts, and more; their site lists capabilities and sample prompts). True Wealth
              does not embed Claude; it only calls the same HTTP MCP endpoint as a small API client.
            </p>
          </section>

          <section>
            <p className="font-medium text-ink">How to update MCP in this app (True Wealth)</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>
                <strong className="text-ink">MCP URL</strong> is prefilled with INDmoney&apos;s public endpoint. Change
                it only if you use a proxy or another host.
              </li>
              <li>
                <strong className="text-ink">Bearer token</strong>: paste only if you have a string from your gateway
                or env workflow. Leave blank to keep a token already saved in SQLite.
              </li>
              <li>
                <strong className="text-ink">Save token &amp; connect</strong>: saves a non-empty token to this
                machine&apos;s SQLite, then runs discovery and a holdings refresh for the URL above.
              </li>
              <li>
                <strong className="text-ink">Clear saved token</strong>: removes the stored Bearer only (URL unchanged).
              </li>
              <li>
                <strong className="text-ink">Mock only</strong>: clears saved URL and token; sample data only until you
                connect again.
              </li>
              <li>
                Optional env <span className="font-mono text-ink/90">INDMONEY_MCP_BEARER_TOKEN</span> on the API still
                works. If a token is saved in this UI (SQLite), that value is used first; otherwise the API falls back to
                the env variable. Restart FastAPI after changing <span className="font-mono">.env</span>.
              </li>
            </ul>
          </section>

          <section>
            <p className="font-medium text-ink">If something fails (from INDmoney&apos;s troubleshooting themes)</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>Allow redirects and pop-ups for indmoney.com when using Claude in the browser.</li>
              <li>Session expired: reconnect from Claude and complete sign-in again.</li>
              <li>No holdings: you may be signed into a different INDmoney account than the one with your portfolio.</li>
              <li>401 in True Wealth: almost always missing or wrong Bearer for raw HTTP; try proxy or token from your bridge.</li>
            </ul>
            <p className="mt-2">
              Full detail, tool list, and FAQs:{" "}
              <a
                href="https://www.indmoney.com/mcp"
                className="font-medium text-ion underline underline-offset-2 hover:text-ion/80"
                target="_blank"
                rel="noreferrer"
              >
                indmoney.com/mcp
              </a>
              .
            </p>
          </section>
        </div>
      </details>

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href="https://www.indmoney.com/mcp"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center rounded-xl border border-ion/35 bg-ion/10 px-4 py-2.5 text-xs font-semibold text-ion transition hover:bg-ion/20"
        >
          Open INDmoney MCP
        </a>
        <button
          type="button"
          disabled={busy}
          onClick={() => void clearToken()}
          className="inline-flex items-center justify-center rounded-xl border border-line px-4 py-2.5 text-xs text-muted transition hover:border-ember/40 hover:text-ember disabled:opacity-40"
        >
          Clear saved token
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void disconnect()}
          className="inline-flex items-center justify-center rounded-xl border border-line px-4 py-2.5 text-xs text-muted transition hover:border-rose/40 hover:text-rose disabled:opacity-40"
        >
          Mock only
        </button>
      </div>

      <label className="mt-5 block text-[10px] font-medium uppercase tracking-[0.2em] text-muted">MCP URL</label>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={MCP_PUBLIC_ENDPOINT}
        autoComplete="off"
        className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 font-mono text-xs text-ink outline-none focus:ring-2 focus:ring-ion/35"
      />

      <label className="mt-4 block text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
        Bearer token (optional)
      </label>
      <input
        value={token}
        onChange={(e) => setToken(e.target.value)}
        type="password"
        autoComplete="off"
        placeholder="Paste token, then Save & connect"
        className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 font-mono text-xs text-ink outline-none focus:ring-2 focus:ring-ion/35"
      />
      <p className="mt-1 text-[11px] text-muted">
        Leave blank to keep an already saved token. Get a token from a proxy or tool that finishes OAuth for you (not
        from this page).
      </p>

      <form onSubmit={saveAndConnect} className="mt-4">
        <button
          type="submit"
          disabled={busy || !url.trim()}
          className="w-full rounded-xl bg-ion px-5 py-3 text-sm font-semibold text-twilight transition hover:bg-ion/90 disabled:opacity-40 md:w-auto"
        >
          {busy ? "Working…" : "Save token & connect"}
        </button>
      </form>

      <ol className="mt-6 grid gap-3 text-[11px] text-muted md:grid-cols-3">
        <li className="rounded-xl border border-line/60 bg-canvas/30 p-3">
          <span className="font-medium text-ink">1.</span> Open INDmoney link if you need the official flow in Claude
          or browser.
        </li>
        <li className="rounded-xl border border-line/60 bg-canvas/30 p-3">
          <span className="font-medium text-ink">2.</span> Paste token if you have one, or leave blank to reuse what
          is already saved.
        </li>
        <li className="rounded-xl border border-ion/25 bg-ion/5 p-3">
          <span className="font-medium text-ink">3.</span>{" "}
          {step3Active ? "Live: SSE updates are running." : "Save token & connect to refresh discovery and holdings."}
        </li>
      </ol>

      {msg && <p className="mt-3 text-xs text-muted">{msg}</p>}

      {meta.mode === "mock" && (
        <div className="mt-4 rounded-xl border border-ember/30 bg-ember/[0.06] p-3 text-xs leading-relaxed text-muted">
          <p className="font-medium text-ink">Still on sample data?</p>
          <p className="mt-1">
            A saved token or OAuth session is{" "}
            {meta.indmoney_oauth_connected || meta.mcp_bearer_configured
              ? "present on the server"
              : "not set (and no env bearer)"}
            . INDmoney often returns 401 until you complete browser OAuth or supply a valid Bearer.
          </p>
        </div>
      )}
    </section>
  );
}
