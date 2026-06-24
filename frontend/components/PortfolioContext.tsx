"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { MCP_PUBLIC_ENDPOINT } from "@/lib/mcpDemoTools";
import type { NormalizedHolding, PortfolioResponse, PortfolioTotals } from "@/lib/types";
import { useSse } from "@/lib/useSse";

const OAUTH_REFRESH_FLAG = "tw_oauth_refresh";

export type PortfolioContextValue = {
  data: PortfolioResponse | null;
  err: string | null;
  loading: boolean;
  /** True during explicit reload / refresh while keeping last `data` for skeletons. */
  refreshing: boolean;
  rulesMsg: string | null;
  setRulesMsg: (m: string | null) => void;
  thr: string;
  setThr: (t: string) => void;
  mcpUrl: string;
  sseActive: boolean;
  sseGeneration: number;
  setSseActive: (v: boolean) => void;
  bumpSseGeneration: () => void;
  inspectorHolding: NormalizedHolding | null;
  setInspectorHolding: (h: NormalizedHolding | null) => void;
  openHoldingById: (id: string) => void;
  saveHoldingCost: (holdingId: string, avgCost: number, note?: string) => Promise<void>;
  reload: (opts?: { refresh?: boolean }) => Promise<void>;
  postRefresh: () => Promise<void>;
  saveRules: (e: FormEvent) => Promise<void>;
  stopStreamReloadReconnect: () => Promise<void>;
  stopLiveStreamOnly: () => void;
  reconnectStreamOnly: () => void;
  reloadPortfolioOnly: () => Promise<void>;
};

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

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

export function usePortfolio(): PortfolioContextValue {
  const v = useContext(PortfolioContext);
  if (!v) throw new Error("usePortfolio must be used within PortfolioProvider");
  return v;
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [thr, setThr] = useState("15");
  const [mcpUrl, setMcpUrl] = useState(MCP_PUBLIC_ENDPOINT);
  const [rulesMsg, setRulesMsg] = useState<string | null>(null);
  const [sseActive, setSseActive] = useState(true);
  const [sseGeneration, setSseGeneration] = useState(0);
  const [inspectorHolding, setInspectorHolding] = useState<NormalizedHolding | null>(null);

  const bumpSseGeneration = useCallback(() => {
    setSseGeneration((g) => g + 1);
  }, []);

  const reload = useCallback(async (opts?: { refresh?: boolean }) => {
    setErr(null);
    setRefreshing(true);
    const [pRes, rulesRes] = await Promise.allSettled([
      fetchPortfolio(opts?.refresh ? { refresh: true } : undefined),
      fetchRules(),
    ]);
    try {
      if (pRes.status === "rejected") {
        throw pRes.reason instanceof Error ? pRes.reason : new Error(String(pRes.reason));
      }
      const p = pRes.value;
      setData(p);
      if (rulesRes.status === "fulfilled") {
        const rules = rulesRes.value;
        setThr(String(rules.concentration_threshold_pct));
        setMcpUrl(
          rules.mcp_endpoint === null || rules.mcp_endpoint === undefined || rules.mcp_endpoint.trim() === ""
            ? MCP_PUBLIC_ENDPOINT
            : rules.mcp_endpoint.trim(),
        );
      } else {
        const msg = rulesRes.reason instanceof Error ? rulesRes.reason.message : "Rules request failed";
        setRulesMsg((prev) => prev ?? msg);
      }
      setLoading(false);
      if (opts?.refresh && typeof window !== "undefined") {
        sessionStorage.removeItem(OAUTH_REFRESH_FLAG);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  const postRefresh = useCallback(async () => {
    setErr(null);
    setRefreshing(true);
    try {
      const r = await fetch("/api/refresh", { method: "POST", cache: "no-store" });
      if (!r.ok) throw new Error(`Refresh ${r.status}`);
      const p = (await r.json()) as PortfolioResponse;
      setData(p);
      const rules = await fetchRules();
      setThr(String(rules.concentration_threshold_pct));
      setMcpUrl(
        rules.mcp_endpoint === null || rules.mcp_endpoint === undefined || rules.mcp_endpoint.trim() === ""
          ? MCP_PUBLIC_ENDPOINT
          : rules.mcp_endpoint.trim(),
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

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
          setRulesMsg("INDmoney connected. Refreshing portfolio.");
        } else if (st && st !== "ok") {
          const detail = params.get("detail");
          const msg = detail ? decodeURIComponent(detail.replace(/\+/g, " ")) : "unknown error";
          setRulesMsg(`OAuth did not complete: ${msg}`);
        } else if (pendingRefresh) {
          refreshPortfolio = true;
          setRulesMsg((prev) => prev ?? "Refreshing portfolio after INDmoney sign-in.");
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
        const [pRes, rulesRes] = await Promise.allSettled([
          fetchPortfolio(refreshPortfolio ? { refresh: true } : undefined),
          fetchRules(),
        ]);
        if (cancelled) return;
        if (pRes.status === "rejected") {
          const e = pRes.reason;
          throw e instanceof Error ? e : new Error(String(e));
        }
        setData(pRes.value);
        if (rulesRes.status === "fulfilled") {
          const rules = rulesRes.value;
          setThr(String(rules.concentration_threshold_pct));
          setMcpUrl(
            rules.mcp_endpoint === null || rules.mcp_endpoint === undefined || rules.mcp_endpoint.trim() === ""
              ? MCP_PUBLIC_ENDPOINT
              : rules.mcp_endpoint.trim(),
          );
        } else {
          const msg = rulesRes.reason instanceof Error ? rulesRes.reason.message : "Rules request failed";
          setRulesMsg((prev) => prev ?? msg);
        }
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

  const stopStreamReloadReconnect = useCallback(async () => {
    setRulesMsg("Stopping live stream.");
    setSseActive(false);
    await new Promise((r) => setTimeout(r, 120));
    setRulesMsg("Reloading portfolio from MCP.");
    try {
      await reload({ refresh: true });
    } catch (e: unknown) {
      setRulesMsg(e instanceof Error ? e.message : "Reload failed");
      setSseActive(true);
      bumpSseGeneration();
      return;
    }
    bumpSseGeneration();
    setSseActive(true);
    setRulesMsg("Live stream restarted. Portfolio refreshed.");
  }, [reload, bumpSseGeneration]);

  const stopLiveStreamOnly = useCallback(() => {
    setSseActive(false);
    setRulesMsg("Live stream stopped.");
  }, []);

  const reconnectStreamOnly = useCallback(() => {
    setSseActive(true);
    bumpSseGeneration();
    setRulesMsg("Live stream reconnected.");
  }, [bumpSseGeneration]);

  const reloadPortfolioOnly = useCallback(async () => {
    setRulesMsg("Reloading portfolio from MCP.");
    try {
      await reload({ refresh: true });
      setRulesMsg("Portfolio refreshed.");
    } catch (e: unknown) {
      setRulesMsg(e instanceof Error ? e.message : "Reload failed");
    }
  }, [reload]);

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
      onStatus: () => {},
    },
    sseActive,
    sseGeneration,
  );

  const saveRules = useCallback(
    async (e: FormEvent) => {
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
        setRulesMsg("Saved. Alerts pick this up on the next cycle.");
        fetchPortfolio().then(setData).catch(() => {});
      }
    },
    [thr],
  );

  const openHoldingById = useCallback(
    (id: string) => {
      const h = data?.holdings.find((x) => x.id === id);
      if (h) setInspectorHolding(h);
    },
    [data],
  );

  const saveHoldingCost = useCallback(async (holdingId: string, avgCost: number, note?: string) => {
    const r = await fetch(`/api/holdings/${encodeURIComponent(holdingId)}/cost`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avg_cost: avgCost, note: note ?? null }),
    });
    if (!r.ok) throw new Error(`Save failed (${r.status})`);
    const j = (await r.json()) as { portfolio?: PortfolioResponse; holding?: NormalizedHolding };
    if (j.portfolio) setData(j.portfolio);
    else await fetchPortfolio().then(setData);
    if (j.holding) setInspectorHolding(j.holding);
  }, []);

  const value = useMemo<PortfolioContextValue>(
    () => ({
      data,
      err,
      loading,
      refreshing,
      rulesMsg,
      setRulesMsg,
      thr,
      setThr,
      mcpUrl,
      sseActive,
      sseGeneration,
      setSseActive,
      bumpSseGeneration,
      inspectorHolding,
      setInspectorHolding,
      openHoldingById,
      saveHoldingCost,
      reload,
      postRefresh,
      saveRules,
      stopStreamReloadReconnect,
      stopLiveStreamOnly,
      reconnectStreamOnly,
      reloadPortfolioOnly,
    }),
    [
      data,
      err,
      loading,
      refreshing,
      rulesMsg,
      thr,
      mcpUrl,
      sseActive,
      sseGeneration,
      inspectorHolding,
      reload,
      postRefresh,
      saveRules,
      openHoldingById,
      saveHoldingCost,
      bumpSseGeneration,
      stopStreamReloadReconnect,
      stopLiveStreamOnly,
      reconnectStreamOnly,
      reloadPortfolioOnly,
    ],
  );

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}
