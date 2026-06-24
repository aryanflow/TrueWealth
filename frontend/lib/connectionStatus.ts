import type { PortfolioMeta } from "@/lib/types";

export type DataQuality = "good" | "partial" | "degraded";

export interface ConnectionDisplay {
  /** User-facing feed label */
  feedLabel: string;
  /** Dot + label color token */
  feedTone: "mint" | "warn" | "coral" | "muted";
  /** Data-quality pill (separate from feed) */
  quality: DataQuality;
  qualityLabel: string;
  qualityNotes?: string;
  lastSync: string | null;
}

/** Single source of truth for header connection + quality — same on every tab. */
export function deriveConnectionDisplay(meta: PortfolioMeta | null | undefined): ConnectionDisplay {
  if (!meta) {
    return {
      feedLabel: "Checking feed…",
      feedTone: "muted",
      quality: "partial",
      qualityLabel: "Loading",
      lastSync: null,
    };
  }

  const lastSync = meta.last_holdings_sync ?? meta.last_price_sync;
  const quality = (meta.confidence ?? "partial") as DataQuality;
  const qualityLabel =
    quality === "good" ? "Good data" : quality === "degraded" ? "Degraded data" : "Partial data";
  const qualityNotes = meta.confidence_notes?.filter(Boolean).join(" · ");

  const liveBook = meta.mode === "live";
  const feedUp = meta.mcp_connected;

  if (!feedUp) {
    return {
      feedLabel: "Disconnected",
      feedTone: "coral",
      quality,
      qualityLabel,
      qualityNotes,
      lastSync,
    };
  }

  if (!liveBook) {
    return {
      feedLabel: "Disconnected",
      feedTone: "coral",
      quality,
      qualityLabel,
      qualityNotes: qualityNotes || "Book is not on the live data path.",
      lastSync,
    };
  }

  if (meta.mcp_degraded) {
    return {
      feedLabel: "Connected · degraded feed",
      feedTone: "warn",
      quality,
      qualityLabel,
      qualityNotes,
      lastSync,
    };
  }

  return {
    feedLabel: "Connected",
    feedTone: "mint",
    quality,
    qualityLabel,
    qualityNotes,
    lastSync,
  };
}
