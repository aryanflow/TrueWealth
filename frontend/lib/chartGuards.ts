import type { HistoryPoint } from "@/lib/types";

export function drawdownSeries(history: HistoryPoint[]): { date: string; dd: number; value: number }[] {
  if (history.length === 0) return [];
  let peak = history[0].inr_market_value;
  return history.map((h) => {
    const v = h.inr_market_value;
    if (v > peak) peak = v;
    const dd = peak > 0 ? ((v - peak) / peak) * 100 : 0;
    return { date: h.snapshot_date, dd, value: v };
  });
}

export function wealthChartReady(history: HistoryPoint[]): { ok: boolean; message?: string } {
  if (history.length === 0) {
    return {
      ok: false,
      message: "No daily values yet. Run a data refresh in Settings — the line appears after the next snapshot.",
    };
  }
  if (history.length < 3) {
    return { ok: true }; // show sparse points honestly
  }
  const vals = history.map((h) => h.inr_market_value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (mean > 0 && (max - min) / mean < 0.0018) {
    return {
      ok: false,
      message:
        "Daily values barely moved between snapshots — the line would read as flat noise. Check back after more divergence.",
    };
  }
  return { ok: true };
}

export function drawdownChartReady(history: HistoryPoint[]): { ok: boolean; message?: string } {
  if (history.length < 3) {
    return {
      ok: false,
      message:
        "Drawdown needs at least three daily snapshots before peak-to-trough is meaningful. The tile above shows the latest reading when available.",
    };
  }

  const dd = drawdownSeries(history);
  const minDd = Math.min(...dd.map((d) => d.dd));
  const maxDd = Math.max(...dd.map((d) => d.dd));
  const swing = maxDd - minDd;

  if (minDd <= -50) {
    return {
      ok: false,
      message:
        "Drawdown chart hidden — too few snapshots produced an unreliable line (e.g. near −100%). Check back after more daily values build.",
    };
  }

  if (swing < 0.05) {
    return {
      ok: false,
      message:
        "Drawdown range is smaller than snapshot noise — chart hidden until swings are larger.",
    };
  }

  const vals = history.map((h) => h.inr_market_value);
  if (Math.min(...vals) <= 0) {
    return {
      ok: false,
      message: "Drawdown chart hidden — a snapshot recorded zero book value, which distorts peak-to-trough.",
    };
  }

  return { ok: true };
}
