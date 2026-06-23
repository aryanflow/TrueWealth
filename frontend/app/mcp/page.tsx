"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  McpQuickstartBlock,
  McpSignaturePanel,
  McpToolCatalog,
} from "@/components/mcp/McpBlocks";
import { MCP_PUBLIC_ENDPOINT } from "@/lib/mcpDemoTools";

function OauthReturnBanner() {
  const sp = useSearchParams();
  const st = sp.get("indmoney_oauth");
  if (!st) return null;
  const detail = sp.get("detail");
  const ok = st === "ok";
  return (
    <div
      className={`mx-auto mb-6 max-w-6xl rounded-2xl border px-4 py-3 text-sm ${
        ok ? "border-mintglass/40 bg-mintglass/10 text-ink" : "border-ember/40 bg-ember/[0.08] text-ink"
      }`}
      role="status"
    >
      {ok ? (
        <p>
          <strong>INDmoney connected.</strong> The API stored tokens and ran discovery.{" "}
          <Link href="/today" className="font-medium text-ion underline underline-offset-2 hover:text-ion/80">
            Open dashboard
          </Link>{" "}
          to see live holdings (use <span className="font-mono text-xs">Save token & connect</span> if the MCP URL was cleared).
        </p>
      ) : (
        <p>
          <strong>OAuth did not complete.</strong> {detail ? <span className="font-mono text-xs">{detail}</span> : "See API logs."}
        </p>
      )}
    </div>
  );
}

type Persona = "builders" | "analysts" | "power";

const PERSONA_STORIES: Record<
  Persona,
  { title: string; stories: { title: string; body: string }[] }
> = {
  builders: {
    title: "Builders",
    stories: [
      {
        title: "Holdings API without maintaining scrapers",
        body: "Your Next.js app calls tools/list once, caches names, then tools/call for holdings. You render the same schema in web + mobile without reverse-engineering INDmoney.",
      },
      {
        title: "Feature flags from real allocation",
        body: "Ship a “tax harvest” module only when MCP reports long-term gains in a slice you care about, with no manual CSV uploads from the user.",
      },
    ],
  },
  analysts: {
    title: "Analysts",
    stories: [
      {
        title: "One workbook, always fresh",
        body: "Python pulls holdings every morning, writes Parquet, and refreshes a Streamlit dashboard. Stale timestamps are visible so you trust the number or know to retry.",
      },
      {
        title: "MF vs MF in seconds",
        body: "Wire compare tools into a notebook cell. You get overlap and fee deltas as structured JSON, then paste into a memo instead of retyping from five tabs.",
      },
    ],
  },
  power: {
    title: "Power users",
    stories: [
      {
        title: "Slack alert when concentration drifts",
        body: "Cron hits your small FastAPI bridge, runs a concentration check on MCP output, posts a thread with the top three names over threshold, with no broker login in the script.",
      },
      {
        title: "Personal “portfolio diff” after payday",
        body: "After each SIP, a local script diffs holdings JSON and emails you only what changed: allocation drift, not another generic market newsletter.",
      },
    ],
  },
};

export default function McpLandingPage() {
  const [persona, setPersona] = useState<Persona>("builders");
  const [endpointCopied, setEndpointCopied] = useState(false);

  async function copyEndpoint() {
    try {
      await navigator.clipboard.writeText(MCP_PUBLIC_ENDPOINT);
      setEndpointCopied(true);
      window.setTimeout(() => setEndpointCopied(false), 1100);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = MCP_PUBLIC_ENDPOINT;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      setEndpointCopied(true);
      window.setTimeout(() => setEndpointCopied(false), 1100);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="depth-field animate-drift" aria-hidden />

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-20 pt-8 md:pt-10">
        <Suspense fallback={null}>
          <OauthReturnBanner />
        </Suspense>
        <nav className="mb-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] shadow-card">
              <span
                className="h-3.5 w-3.5 rounded-full bg-gradient-to-br from-ion to-mintglass"
                aria-hidden
              />
            </div>
            <div className="leading-tight">
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">True Wealth</p>
              <p className="text-xs text-muted/80">INDmoney MCP</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <a href="#mcp-how" className="rounded-xl border border-white/10 px-3 py-2 text-muted transition hover:bg-white/[0.05] hover:text-ink">
              How it works
            </a>
            <a href="#mcp-tools" className="rounded-xl border border-white/10 px-3 py-2 text-muted transition hover:bg-white/[0.05] hover:text-ink">
              Tool catalog
            </a>
            <a href="#mcp-security" className="rounded-xl border border-white/10 px-3 py-2 text-muted transition hover:bg-white/[0.05] hover:text-ink">
              Security
            </a>
            <a
              href="#mcp-quickstart"
              className="rounded-xl bg-ion px-3 py-2 font-medium text-twilight transition hover:bg-ion/90"
            >
              Quickstart
            </a>
          </div>
        </nav>

        {/* Hero */}
        <section className="grid gap-10 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-6">
            <div className="mb-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-muted">
                <span className="h-2 w-2 rounded-full bg-mintglass" aria-hidden />
                Read-only by default
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-muted">
                <span className="h-2 w-2 rounded-full bg-ion" aria-hidden />
                JSON-RPC over MCP
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-muted">
                <span className="h-2 w-2 rounded-full bg-ember" aria-hidden />
                Tool discovery
              </span>
            </div>

            <p className="font-display text-2xl text-ink/95 md:text-3xl">
              Your INDmoney portfolio, <span className="text-ion">programmable.</span>
            </p>
            <h1 className="mt-3 font-display text-4xl leading-[0.98] tracking-tight text-ink md:text-5xl">
              A programmable interface to your portfolio.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              Connect once. Query holdings, allocation, and comparisons from any MCP client, or call tools directly
              from your backend without an LLM.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.08] bg-black/25 px-3 py-2 font-mono text-[11px] text-ink/85">
              <span className="text-muted">Endpoint</span>
              <span className="break-all">{MCP_PUBLIC_ENDPOINT}</span>
              <button
                type="button"
                onClick={() => void copyEndpoint()}
                className="ml-auto shrink-0 rounded-lg bg-ion px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-twilight hover:bg-ion/90"
              >
                {endpointCopied ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => void copyEndpoint()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-ion/35 bg-ion/15 px-5 py-3 text-sm font-semibold text-ink shadow-card transition hover:bg-ion/25"
              >
                <span className="font-mono text-xs">Copy endpoint</span>
              </button>
              <button
                type="button"
                onClick={() => document.getElementById("mcp-tools")?.scrollIntoView({ behavior: "smooth" })}
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm text-ink transition hover:bg-white/[0.07]"
              >
                View tool catalog
              </button>
              <Link
                href="/today"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 px-5 py-3 text-sm text-muted transition hover:border-ion/30 hover:text-ink"
              >
                Open dashboard
              </Link>
            </div>

            <p className="mt-6 max-w-xl text-xs leading-relaxed text-muted">
              <strong className="text-ink">No trades. No order placement.</strong> You can revoke access from INDmoney
              when your client allows it. This app stores only what you configure locally (e.g. SQLite rules + cached
              snapshots); treat tokens like production secrets.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                {
                  k: "Portfolio truth",
                  v: "Holdings, cost basis where available, allocation: one normalized book.",
                },
                {
                  k: "Comparisons",
                  v: "MF vs MF, stock vs sector: structured outputs, not screenshots.",
                },
                {
                  k: "Automation",
                  v: "Scheduled checks, alerts, exports: your agent or cron owns the rhythm.",
                },
              ].map((o) => (
                <div key={o.k} className="glass-soft rounded-2xl p-4">
                  <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">Outcome</p>
                  <p className="mt-2 text-sm font-medium text-ink">{o.k}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{o.v}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6">
            <McpSignaturePanel />
          </div>
        </section>

        {/* How it works */}
        <section id="mcp-how" className="py-16 md:py-20">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted">How it works</p>
              <h2 className="mt-3 font-display text-3xl text-ink md:text-4xl">Connect → ask → structured output → act.</h2>
            </div>
            <p className="max-w-md text-sm text-muted">
              MCP is a tool protocol. Your service can POST JSON-RPC like any API. Claude is optional. Discovery plus
              typed tools are the payoff.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Connect INDmoney",
                body: "Point your client at the endpoint. Authenticate the way your stack expects (browser session, proxy token, etc.).",
                details: `Endpoint: ${MCP_PUBLIC_ENDPOINT}\nAuth: client-specific (token / session / proxy)\nStance: read-only recommended`,
              },
              {
                step: "02",
                title: "Call tools",
                body: "Always run tools/list first, then tools/call with arguments that match the live schema.",
                details: `{\n  "jsonrpc": "2.0",\n  "id": 1,\n  "method": "tools/list",\n  "params": {}\n}`,
              },
              {
                step: "03",
                title: "Use results",
                body: "Normalize into your own schema, show last sync, stream deltas to dashboards or agents.",
                details: `Prices: ~10s lane (example)\nHoldings: ~2m lane (example)\nNews / macro: slower lane\nAlways show last refresh time in UI`,
              },
            ].map((c) => (
              <div key={c.step} className="glass rounded-3xl p-6">
                <span className="inline-flex rounded-full border border-white/10 px-2.5 py-1 font-mono text-[11px] text-muted">
                  {c.step}
                </span>
                <h3 className="mt-4 text-lg text-ink">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{c.body}</p>
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-ion hover:text-ion/80">Show me</summary>
                  <pre className="mt-3 whitespace-pre-wrap rounded-2xl border border-white/[0.06] bg-black/35 p-3 font-mono text-[11px] text-ink/75">
                    {c.details}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        </section>

        <McpToolCatalog />

        {/* Security */}
        <section id="mcp-security" className="py-16 md:py-20">
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted">Security & data</p>
          <h2 className="mt-3 font-display text-3xl text-ink md:text-4xl">Trust is a feature, not a footer.</h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
            Finance UX fails when data flow is vague. Below is how True Wealth thinks about INDmoney MCP. Adapt the
            bullets if your deployment differs (e.g. self-hosted proxy).
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="glass rounded-3xl p-6">
              <h3 className="text-sm font-medium text-ink">What is accessed</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                <li>• Whatever tools you invoke (typically holdings, transactions, comparisons; depends on server inventory).</li>
                <li>• No placement of orders through this MCP surface in True Wealth.</li>
              </ul>
            </div>
            <div className="glass rounded-3xl p-6">
              <h3 className="text-sm font-medium text-ink">What we store (this app)</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                <li>• SQLite: rules (e.g. concentration threshold), optional saved MCP URL, cached portfolio snapshots from successful pulls.</li>
                <li>• Tokens / MPIN never belong in git; use env + your proxy if you bridge authenticated MCP.</li>
              </ul>
            </div>
            <div className="glass rounded-3xl p-6">
              <h3 className="text-sm font-medium text-ink">Permissions & revocation</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                <li>• Revoke or rotate access from INDmoney / your IdP when a laptop is lost or a key leaks.</li>
                <li>• Prefer read-only scopes where the platform exposes them.</li>
              </ul>
            </div>
            <div className="glass rounded-3xl p-6">
              <h3 className="text-sm font-medium text-ink">Rate limits & reliability</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                <li>• Back off on 429/5xx; surface degraded mode instead of silent stale numbers.</li>
                <li>• Log discovery + tool errors; retry holdings on a slower cadence than prices.</li>
              </ul>
            </div>
          </div>

          <p className="mt-8 text-center text-sm text-ink">
            <strong>We never place orders.</strong>{" "}
            <span className="text-muted">True Wealth is decision support only, not investment advice.</span>
          </p>
        </section>

        {/* Personas */}
        <section id="mcp-personas" className="py-16 md:py-20">
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted">Use cases</p>
          <h2 className="mt-3 font-display text-3xl text-ink md:text-4xl">Same tools, different rhythms.</h2>

          <div className="mt-6 flex flex-wrap gap-2 border-b border-white/[0.06] pb-4">
            {(Object.keys(PERSONA_STORIES) as Persona[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setPersona(key)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  persona === key
                    ? "border border-ion/40 bg-ion/15 text-ink"
                    : "border border-white/10 text-muted hover:border-white/20 hover:text-ink"
                }`}
              >
                {PERSONA_STORIES[key].title}
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {PERSONA_STORIES[persona].stories.map((s) => (
              <div key={s.title} className="glass-soft rounded-2xl p-5">
                <h3 className="font-medium text-ink">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <McpQuickstartBlock />

        <footer className="border-t border-white/[0.06] py-10 text-xs text-muted">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <p>True Wealth · INDmoney MCP reference UI. Endpoint is documented by INDmoney; tool names are discovered at runtime.</p>
            <div className="flex flex-wrap gap-4">
              <a href="#mcp-quickstart" className="hover:text-ink">
                Quickstart
              </a>
              <a href="#mcp-tools" className="hover:text-ink">
                Tool reference
              </a>
              <Link href="/today" className="hover:text-ink">
                Dashboard
              </Link>
              <a href="https://www.indmoney.com/mcp" className="hover:text-ink" target="_blank" rel="noreferrer">
                INDmoney MCP
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
