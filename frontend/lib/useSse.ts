"use client";

import { useEffect, useRef } from "react";

import type { PortfolioResponse, PortfolioTotals } from "./types";

type Handlers = {
  onPrices?: (totals: PortfolioTotals, lastPriceSync: string | null) => void;
  onHoldings?: (info: { holdings_count: number; last_holdings_sync: string | null; mode: string }) => void;
  onAlerts?: (alerts: PortfolioResponse["alerts"]) => void;
  onStatus?: (payload: Record<string, unknown>) => void;
};

export type SseConnectionOpts = {
  /** When false, EventSource is closed and no events are received. */
  active: boolean;
  /** Bump to drop the current connection and open a new one (while active). */
  generation: number;
};

/**
 * Subscribes to `/api/stream` (SSE). Pass `active: false` to stop; bump `generation` to reconnect
 * without toggling active.
 */
export function useSse(handlers: Handlers, active: boolean, generation: number) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!active) {
      return undefined;
    }

    const es = new EventSource("/api/stream");

    const onPrices = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as {
          payload: { totals: PortfolioTotals; last_price_sync: string | null };
        };
        handlersRef.current.onPrices?.(data.payload.totals, data.payload.last_price_sync ?? null);
      } catch {
        /* ignore */
      }
    };

    const onHoldings = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as {
          payload: { holdings_count: number; last_holdings_sync: string | null; mode: string };
        };
        handlersRef.current.onHoldings?.(data.payload);
      } catch {
        /* ignore */
      }
    };

    const onAlerts = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { payload: { alerts: PortfolioResponse["alerts"] } };
        handlersRef.current.onAlerts?.(data.payload.alerts);
      } catch {
        /* ignore */
      }
    };

    const onStatus = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { payload: Record<string, unknown> };
        handlersRef.current.onStatus?.(data.payload);
      } catch {
        /* ignore */
      }
    };

    es.addEventListener("prices", onPrices);
    es.addEventListener("holdings", onHoldings);
    es.addEventListener("alerts", onAlerts);
    es.addEventListener("status", onStatus);

    es.onerror = () => {
      /* browser auto-reconnects EventSource */
    };

    return () => {
      es.removeEventListener("prices", onPrices);
      es.removeEventListener("holdings", onHoldings);
      es.removeEventListener("alerts", onAlerts);
      es.removeEventListener("status", onStatus);
      es.close();
    };
  }, [active, generation]);
}
