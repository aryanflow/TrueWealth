"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

import { McpConnectionStepper } from "@/components/McpConnectionStepper";
import { Disclaimer } from "@/components/Disclaimer";
import { usePortfolio } from "@/components/PortfolioContext";
import { ViewSettingsPanel } from "@/components/ViewSettingsPanel";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

function fmt(iso: string | null | undefined): string {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  } catch {
    return "-";
  }
}

export function SettingsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const pathname = usePathname();
  const {
    data,
    reload,
    postRefresh,
    mcpUrl,
    thr,
    setThr,
    saveRules,
    rulesMsg,
    setRulesMsg,
    stopStreamReloadReconnect,
    reconnectStreamOnly,
    reloadPortfolioOnly,
  } = usePortfolio();
  const [busy, setBusy] = useState<string | null>(null);

  const meta = data?.meta;
  const oauthOn = Boolean(meta?.indmoney_oauth_connected);
  const tools = meta?.tool_inventory ?? [];
  const mcpCatalog = meta?.mcp_tools ?? [];
  const lastErr = meta?.last_error ?? "";

  function startOAuth() {
    const scope = encodeURIComponent("portfolio:read market:read");
    const basePath = pathname && pathname !== "/" ? pathname : "/today";
    const rb = encodeURIComponent(`${window.location.origin}${basePath}`);
    window.location.assign(`/api/indmoney/auth/start?scope=${scope}&return_base=${rb}`);
  }

  async function disconnect() {
    setBusy("disconnect");
    setRulesMsg(null);
    try {
      const r = await fetch("/api/indmoney/auth/disconnect", { method: "POST" });
      if (!r.ok) throw new Error(`Disconnect failed (${r.status})`);
      setRulesMsg("Disconnected. Portfolio cleared.");
      await reload();
    } catch (e: unknown) {
      setRulesMsg(e instanceof Error ? e.message : "Disconnect failed");
    } finally {
      setBusy(null);
    }
  }

  async function onRefreshNow() {
    setBusy("refresh");
    setRulesMsg(null);
    try {
      await postRefresh();
      setRulesMsg("Refresh complete.");
    } catch (e: unknown) {
      setRulesMsg(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setBusy(null);
    }
  }

  function clearLocalCache() {
    if (typeof window === "undefined") return;
    const keys = Object.keys(window.localStorage).filter((k) => k.startsWith("tw_"));
    keys.forEach((k) => window.localStorage.removeItem(k));
    setRulesMsg("Cleared on-device notes and flags for this app.");
  }

  const tokenHint =
    lastErr && /token_exchange|401|invalid_grant/i.test(lastErr)
      ? "Token expired. Reconnect."
      : lastErr
        ? lastErr.slice(0, 220)
        : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-lg">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <p className="text-left text-sm font-normal text-muted">
            Connection, portfolio views, guardrails, and advanced MCP controls. Most changes apply on the next refresh
            cycle.
          </p>
        </SheetHeader>
        <div className="flex-1 space-y-8 overflow-y-auto px-5 pb-8 pt-2">
          {rulesMsg ? <p className="rounded-lg border border-ion/25 bg-ion/10 px-3 py-2 text-xs text-ink">{rulesMsg}</p> : null}

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Connection</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {oauthOn ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void disconnect()}
                  className="rounded-lg bg-ion px-4 py-2 text-sm font-medium text-twilight hover:bg-ion/90 disabled:opacity-50"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={startOAuth}
                  className="rounded-lg bg-ion px-4 py-2 text-sm font-medium text-twilight hover:bg-ion/90 disabled:opacity-50"
                >
                  Connect INDmoney
                </button>
              )}
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void onRefreshNow()}
                className="rounded-lg border border-hairline px-4 py-2 text-sm text-ink hover:border-ion/40"
              >
                Refresh now
              </button>
            </div>
            <p className="mt-3 text-[11px] text-muted">Scope: portfolio:read, market:read</p>
            <p className="mt-2 font-mono text-[11px] text-muted">
              Last holdings sync: {fmt(meta?.last_holdings_sync)}
              <br />
              Last price sync: {fmt(meta?.last_price_sync)}
            </p>
            {tokenHint ? <p className="mt-2 text-xs text-loss-muted">{tokenHint}</p> : null}
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">INDmoney MCP tools</h3>
            <p className="mt-2 text-[11px] text-muted">
              Catalog from the server&apos;s <span className="font-mono">tools/list</span> after discovery. True Wealth
              picks holdings and transaction tools by name keywords.
            </p>
            <div className="mt-2 space-y-1 rounded-lg border border-hairline bg-canvas/40 px-3 py-2 text-[11px]">
              <p className="font-mono text-ink/90">
                <span className="text-muted">Holdings tool:</span> {meta?.mcp_holdings_tool ?? "—"}
              </p>
              <p className="font-mono text-ink/90">
                <span className="text-muted">Transactions tool:</span> {meta?.mcp_transactions_tool ?? "—"}
              </p>
            </div>
            {mcpCatalog.length > 0 ? (
              <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto rounded-lg border border-hairline bg-surface/50 p-3 text-left">
                {mcpCatalog.map((t) => (
                  <li key={t.name} className="border-b border-hairline/80 pb-2 last:border-0 last:pb-0">
                    <p className="font-mono text-xs font-medium text-ion">{t.name}</p>
                    {t.description ? (
                      <p className="mt-0.5 text-[11px] leading-snug text-muted">{t.description}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[11px] text-muted">
                {meta?.mcp_connected
                  ? "No tool descriptions yet. Open Advanced to see raw name list, or refresh after reconnect."
                  : "Connect MCP (OAuth or bearer in Advanced) and refresh — then the tool catalog appears here."}
              </p>
            )}
            {tools.length > 0 && mcpCatalog.length === 0 ? (
              <p className="mt-2 font-mono text-[10px] text-muted/90">Names only: {tools.join(", ")}</p>
            ) : null}
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Views</h3>
            <div className="mt-3">
              <ViewSettingsPanel onSaved={() => void reload().catch(() => {})} />
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Guardrails</h3>
            <p className="mt-2 text-[11px] text-muted">Concentration threshold used on Today, Map, and Decide.</p>
            <form onSubmit={saveRules} className="mt-3 flex flex-wrap items-end gap-2">
              <label className="text-xs text-muted">
                Concentration limit (%)
                <input
                  value={thr}
                  onChange={(e) => setThr(e.target.value)}
                  className="mt-1 block w-24 rounded border border-hairline bg-canvas px-2 py-1 font-mono text-sm text-ink"
                />
              </label>
              <button type="submit" className="rounded-md bg-ion/20 px-3 py-2 text-xs font-medium text-ion hover:bg-ion/30">
                Save rule
              </button>
            </form>
          </section>

          <Accordion type="single" collapsible defaultValue="">
            <AccordionItem value="adv">
              <AccordionTrigger className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                Advanced
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted">MCP endpoint (read-only)</p>
                  <p className="mt-1 break-all font-mono text-xs text-ink/90">{meta?.mcp_endpoint ?? "Not set"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted">Discovered MCP tool names (compact)</p>
                  <p className="mt-1 font-mono text-xs text-muted/90">{tools.length ? tools.join(", ") : "None"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted">Raw last error</p>
                  <p className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] text-muted/90">
                    {lastErr || "None logged"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void reloadPortfolioOnly()}
                    className="rounded-md border border-hairline px-2 py-1 text-[11px] text-ink"
                  >
                    Reload from MCP
                  </button>
                  <button type="button" onClick={reconnectStreamOnly} className="rounded-md border border-hairline px-2 py-1 text-[11px] text-ink">
                    Reconnect live stream
                  </button>
                  <button
                    type="button"
                    onClick={() => void stopStreamReloadReconnect()}
                    className="rounded-md border border-hairline px-2 py-1 text-[11px] text-ink"
                  >
                    Stop stream, reload, reconnect
                  </button>
                </div>
                <button type="button" onClick={clearLocalCache} className="rounded-md border border-hairline px-2 py-1 text-[11px] text-ink">
                  Clear on-device cache
                </button>
                <div className="border-t border-hairline pt-4">
                  <p className="mb-2 text-[10px] uppercase tracking-wide text-muted">Manual MCP URL and bearer</p>
                  {data ? <McpConnectionStepper initialUrl={mcpUrl} meta={data.meta} onDone={() => void reload()} /> : null}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          <Disclaimer variant="settings" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
