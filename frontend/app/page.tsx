"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { AllocationCharts } from "@/components/AllocationCharts";
import { AlertsPanel } from "@/components/AlertsPanel";
import { Disclaimer } from "@/components/Disclaimer";
import { HeroCards } from "@/components/HeroCards";
import { HoldingsTable } from "@/components/HoldingsTable";
import { McpConnectionStepper } from "@/components/McpConnectionStepper";
import { StatusBar } from "@/components/StatusBar";
import { WealthHero } from "@/components/WealthHero";
import { formatValue } from "@/lib/format";
import { MCP_PUBLIC_ENDPOINT } from "@/lib/mcpDemoTools";
import type { PortfolioResponse, PortfolioTotals } from "@/lib/types";
import { useSse } from "@/lib/useSse";

const OAUTH_REFRESH_FLAG = "tw_oauth_refresh";

async function fetchPortfolio(opts?: { refresh?: boolean }): Promise<PortfolioResponse> {
  const q = opts?.refresh ? "?refresh=1" : "";
  const r = await fetch(`/api/portfolio${q}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Portfolio ${r.status}`);
  return r.json() as Promise<PortfolioResponse>;
}

async function fetchRules(): Promise<{
  concentration_threshold_pct: number;
  price_refresh_sec: number;
  holdings_refresh_sec: number;
  mcp_endpoint: string | null;
}> {
  const r = await fetch("/api/rules", { cache: "no-store" });
  if (!r.ok) throw new Error(`Rules ${r.status}`);
  return r.json();
}

export default function DashboardPage() {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [thr, setThr] = useState("15");
  const [mcpUrl, setMcpUrl] = useState(MCP_PUBLIC_ENDPOINT);
  const [rulesMsg, setRulesMsg] = useState<string | null>(null);
  const [sseActive, setSseActive] = useState(true);
  const [sseGeneration, setSseGeneration] = useState(0);

  const reload = useCallback(async (opts?: { refresh?: boolean }) => {
    setErr(null);
    const [p, rules] = await Promise.all([
      fetchPortfolio(opts?.refresh ? { refresh: true } : undefined),
      fetchRules(),
    ]);
    setData(p);
    setThr(String(rules.concentration_threshold_pct));
    setMcpUrl(
      rules.mcp_endpoint === null || rules.mcp_endpoint === undefined || rules.mcp_endpoint.trim() === ""
        ? MCP_PUBLIC_ENDPOINT
        : rules.mcp_endpoint.trim(),
    );
    setLoading(false);
    if (opts?.refresh && typeof window !== "undefined") {
      sessionStorage.removeItem(OAUTH_REFRESH_FLAG);
    }
  }, []);

  /** One mount path: OAuth query handling + portfolio load (avoids Strict Mode / double-effect races). */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      let refreshPortfolio = false;

      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const st = params.get("indmoney_oauth");
        const pendingRefresh = sessionStorage.getItem(OAUTH_REFRESH_FLAG) === "1";

        if (st === "ok") {
          sessionStorage.setItem(OAUTH_REFRESH_FLAG, "1");
          refreshPortfolio = true;
          setRulesMsg("INDmoney OAuth connected. Refreshing portfolio…");
        } else if (st && st !== "ok") {
          const detail = params.get("detail");
          const msg = detail ? decodeURIComponent(detail.replace(/\+/g, " ")) : "unknown error";
          setRulesMsg(`OAuth did not complete: ${msg}`);
        } else if (pendingRefresh) {
          refreshPortfolio = true;
          setRulesMsg((prev) => prev ?? "Refreshing portfolio after INDmoney sign-in…");
        }

        if (st) {
          const clean = new URL(window.location.href);
          clean.searchParams.delete("indmoney_oauth");
          clean.searchParams.delete("detail");
          const next =
            clean.pathname + (clean.searchParams.toString() ? `?${clean.searchParams.toString()}` : "");
          window.history.replaceState({}, "", next);
        }
      }

      try {
        const [p, rules] = await Promise.all([
          fetchPortfolio(refreshPortfolio ? { refresh: true } : undefined),
          fetchRules(),
        ]);
        if (cancelled) return;
        setData(p);
        setThr(String(rules.concentration_threshold_pct));
        setMcpUrl(
          rules.mcp_endpoint === null || rules.mcp_endpoint === undefined || rules.mcp_endpoint.trim() === ""
            ? MCP_PUBLIC_ENDPOINT
            : rules.mcp_endpoint.trim(),
        );
        if (refreshPortfolio && typeof window !== "undefined") {
          sessionStorage.removeItem(OAUTH_REFRESH_FLAG);
        }
      } catch (e: unknown) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function stopStreamReloadReconnect() {
    setRulesMsg("Stopping live stream…");
    setSseActive(false);
    await new Promise((r) => setTimeout(r, 120));
    setRulesMsg("Reloading portfolio from MCP…");
    try {
      await reload({ refresh: true });
    } catch (e: unknown) {
      setRulesMsg(e instanceof Error ? e.message : "Reload failed");
      setSseActive(true);
      setSseGeneration((g) => g + 1);
      return;
    }
    setSseGeneration((g) => g + 1);
    setSseActive(true);
    setRulesMsg("Live stream restarted; portfolio refreshed from MCP.");
  }

  function stopLiveStreamOnly() {
    setSseActive(false);
    setRulesMsg("Live stream stopped (SSE closed). Use “Reconnect stream” or the full reset to resume.");
  }

  function reconnectStreamOnly() {
    setSseActive(true);
    setSseGeneration((g) => g + 1);
    setRulesMsg("Live stream reconnected.");
  }

  async function reloadPortfolioOnly() {
    setRulesMsg("Reloading portfolio from MCP…");
    try {
      await reload({ refresh: true });
      setRulesMsg("Portfolio refreshed from MCP (no stream change).");
    } catch (e: unknown) {
      setRulesMsg(e instanceof Error ? e.message : "Reload failed");
    }
  }

  useSse(
    {
      onPrices: (totals: PortfolioTotals, lastPriceSync) => {
        setData((prev) =>
          prev
            ? {
                ...prev,
                totals,
                meta: { ...prev.meta, last_price_sync: lastPriceSync },
              }
            : prev,
        );
      },
      onHoldings: () => {
        fetchPortfolio()
          .then(setData)
          .catch(() => {
            /* keep last good */
          });
      },
      onAlerts: (alerts) => {
        setData((prev) => (prev ? { ...prev, alerts } : prev));
      },
      onStatus: () => {
        /* heartbeat: optional future connection indicator */
      },
    },
    sseActive,
    sseGeneration,
  );

  async function saveRules(e: FormEvent) {
    e.preventDefault();
    setRulesMsg(null);
    const v = parseFloat(thr);
    if (Number.isNaN(v)) {
      setRulesMsg("Enter a number.");
      return;
    }
    const r = await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concentration_threshold_pct: v }),
    });
    if (!r.ok) setRulesMsg(`Save failed (${r.status})`);
    else {
      setRulesMsg("Saved. Alerts will pick this up on the next cycle.");
      fetchPortfolio().then(setData).catch(() => {});
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        {rulesMsg ? (
          <p className="mb-4 rounded-lg border border-ion/30 bg-ion/[0.08] px-4 py-3 text-sm text-ink">{rulesMsg}</p>
        ) : null}
        <div className="h-10 w-48 animate-pulse rounded bg-line" />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-lg bg-line/60" />
          ))}
        </div>
        <p className="mt-6 text-sm text-muted">Loading portfolio…</p>
      </main>
    );
  }

  if (err || !data) {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="font-display text-2xl text-ink">Could not load portfolio</h1>
        <p className="mt-2 text-muted">{err ?? "Unknown error"}</p>
        <p className="mt-4 text-sm text-muted">
          Start the API on port 8000, then run <code className="font-mono text-accent">npm run dev</code>{" "}
          for this UI (Next rewrites <code className="font-mono">/api</code> to the backend).
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-muted">True Wealth · Single investor · Read-only</p>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Total wealth first, then allocation, holdings, and alerts. Status shows live vs empty book and last sync.
          </p>
        </div>
        <div className="flex max-w-xl flex-col gap-2 rounded-lg border border-line bg-surface/50 p-3">
          <form onSubmit={saveRules} className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-muted">
              Concentration limit (%)
              <input
                value={thr}
                onChange={(e) => setThr(e.target.value)}
                className="mt-1 block w-24 rounded border border-line bg-canvas px-2 py-1 font-mono text-sm text-ink"
              />
            </label>
            <button
              type="submit"
              className="rounded-md bg-accent/90 px-3 py-2 text-xs font-medium text-twilight hover:bg-accent"
            >
              Update rules
            </button>
            {rulesMsg && <span className="text-xs text-muted">{rulesMsg}</span>}
          </form>
          <div className="border-t border-line/70 pt-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Stream &amp; data</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void stopStreamReloadReconnect()}
                className="rounded-md border border-ion/40 bg-ion/[0.12] px-2.5 py-1.5 text-[11px] font-semibold text-ink hover:bg-ion/20"
              >
                Stop stream → reload MCP → reconnect
              </button>
              <button
                type="button"
                onClick={stopLiveStreamOnly}
                className="rounded-md border border-line px-2.5 py-1.5 text-[11px] text-ink hover:border-ember/40"
              >
                Stop stream
              </button>
              <button
                type="button"
                onClick={() => void reloadPortfolioOnly()}
                className="rounded-md border border-line px-2.5 py-1.5 text-[11px] text-ink hover:border-ion/35"
              >
                Reload from MCP
              </button>
              <button
                type="button"
                onClick={reconnectStreamOnly}
                className="rounded-md border border-line px-2.5 py-1.5 text-[11px] text-ink hover:border-mintglass/40"
              >
                Reconnect stream
              </button>
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
              Dev servers: stop existing <span className="font-mono">uvicorn</span> /{" "}
              <span className="font-mono">npm run dev</span> before starting again (avoid duplicate ports). SSE here is
              the browser live feed only.
            </p>
          </div>
        </div>
      </header>

      <WealthHero totals={data.totals} meta={data.meta} />
      <div className="mt-6">
        <McpConnectionStepper initialUrl={mcpUrl} meta={data.meta} onDone={() => void reload()} />
      </div>

      <StatusBar meta={data.meta} />

      <div className="mt-8 space-y-10">
        <HeroCards totals={data.totals} />
        <AllocationCharts
          by_asset_type={data.allocation.by_asset_type}
          by_currency={data.allocation.by_currency}
          by_country={data.allocation.by_country}
        />
        <section>
          <h2 className="mb-3 font-display text-xl text-ink">Top holdings</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {data.top_holdings.map((h) => (
              <div
                key={h.id}
                className="min-w-[200px] rounded-lg border border-line bg-surface/60 p-4 shadow-card transition hover:border-accent/30"
              >
                <p className="truncate text-sm font-medium text-ink">{h.name}</p>
                <p className="font-mono text-xs text-muted">{h.symbol ?? "-"}</p>
                <p className="mt-2 font-mono text-sm numeric text-ink">
                  {formatValue(h.market_value, h.currency)}
                </p>
                <p className="text-xs text-muted">{h.weight.toFixed(2)}% of book</p>
              </div>
            ))}
          </div>
        </section>
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <HoldingsTable holdings={data.holdings} />
          <AlertsPanel alerts={data.alerts} />
        </div>
      </div>

      <Disclaimer />
    </main>
  );
}
