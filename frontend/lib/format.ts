export function formatInr(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatValue(n: number, ccy: string): string {
  if (ccy === "USD") return formatUsd(n);
  if (ccy === "INR") return formatInr(n);
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function formatPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

/** Single-decimal percent for weights and allocation (avoids float noise). */
export function formatPct1(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(1)}%`;
}

/** Short IST sync stamp for header chips. */
export function formatSyncShort(iso: string | null | undefined): string {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

/** Chart axis / snapshot dates. */
export function formatChartDate(iso: string): string {
  try {
    const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return iso;
  }
}

/** Hero total: Fraunces-friendly parts (currency symbol + integer + decimals). */
export function formatInrHero(n: number): { symbol: string; main: string; dec: string } {
  const abs = Math.abs(n);
  const main = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.floor(abs));
  const frac = Math.round((abs % 1) * 100);
  const dec = frac > 0 ? `.${String(frac).padStart(2, "0")}` : "";
  return { symbol: "₹", main, dec };
}
