"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { SettingsSheet } from "@/components/SettingsSheet";
import { TrueWealthLogo } from "@/components/TrueWealthLogo";
import { disclaimerPlainText } from "@/components/Disclaimer";
import { usePortfolio } from "@/components/PortfolioContext";

function fmtSync(iso: string | null | undefined): string {
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
    return "-";
  }
}

const tabs = [
  { href: "/today", label: "Today" },
  { href: "/map", label: "Map" },
  { href: "/decide", label: "Decide" },
] as const;

function routeTitle(pathname: string | null): string {
  if (pathname?.startsWith("/map")) return "Map";
  if (pathname?.startsWith("/decide")) return "Decide";
  return "Today";
}

export function HeaderShell() {
  const pathname = usePathname();
  const { data } = usePortfolio();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const connected = useMemo(() => {
    if (!data) return false;
    const m = data.meta;
    return Boolean(m.indmoney_oauth_connected && m.mcp_connected && !m.mcp_degraded && m.mode === "live");
  }, [data]);

  const lastSync = data?.meta.last_holdings_sync ?? data?.meta.last_price_sync;
  const pageLabel = routeTitle(pathname ?? null);
  const conf = data?.meta.confidence ?? "partial";
  const confNotes = data?.meta.confidence_notes?.join(" · ");

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-hairline bg-canvas/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link
            href="/today"
            className="group flex min-w-0 items-center gap-2.5"
            aria-label={`True Wealth, ${pageLabel}`}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/[0.09] bg-gradient-to-br from-ion/20 to-mintglass/15 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
              aria-hidden
            >
              <TrueWealthLogo className="h-[22px] w-[22px]" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-muted">True Wealth</p>
              <p className="truncate text-[11px] font-normal text-muted">{pageLabel}</p>
            </div>
          </Link>

          <nav
            className="hidden items-center gap-0.5 rounded-2xl border border-white/[0.06] bg-black/25 p-1 sm:flex"
            aria-label="Primary"
          >
            {tabs.map((t) => {
              const active = pathname === t.href || (t.href === "/today" && pathname === "/");
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`relative rounded-md px-3 py-1.5 font-display text-xs font-medium tracking-wide transition-colors duration-200 motion-reduce:transition-none ${
                    active
                      ? "bg-white/10 text-white"
                      : "text-ink/40 hover:bg-white/[0.04] hover:text-ink/80"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden text-right text-[11px] leading-tight text-muted sm:block">
              <div className="flex items-center justify-end gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${connected ? "bg-gain-muted" : "bg-warn-muted"}`}
                  title={connected ? "Connected" : "Not connected"}
                  aria-hidden
                />
                <span className="text-ink/90">{connected ? "Connected" : "Disconnected"}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide ${
                    conf === "good"
                      ? "border-gain-muted/40 text-gain-muted"
                      : conf === "degraded"
                        ? "border-loss-muted/40 text-loss-muted"
                        : "border-amber-400/50 text-amber-200/95"
                  }`}
                  title={confNotes || (conf === "good" ? "Data quality: good" : "Hover for quality notes")}
                >
                  {conf === "partial" ? "Partial data" : conf === "degraded" ? "Degraded" : "Good data"}
                </span>
              </div>
              <p className="mt-0.5 font-mono text-[10px] text-muted/90">Last sync {fmtSync(lastSync)}</p>
            </div>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-hairline p-2 text-muted transition-colors duration-200 hover:border-ion/40 hover:text-ion motion-reduce:transition-none"
              aria-label="Settings"
            >
              <span className="hidden text-xs font-medium text-ink/80 md:inline">Settings</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </button>
            <details className="relative hidden sm:block">
              <summary className="cursor-pointer list-none rounded-lg border border-hairline px-2 py-1.5 text-xs font-medium text-muted marker:content-none hover:border-ion/40 hover:text-ion [&::-webkit-details-marker]:hidden">
                (i)
              </summary>
              <div className="absolute right-0 z-[60] mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-line bg-canvas p-3 text-left text-xs leading-relaxed text-muted shadow-2xl">
                {disclaimerPlainText()}
              </div>
            </details>
          </div>
        </div>
        <nav className="flex border-t border-hairline/60 px-4 py-2 sm:hidden" aria-label="Primary mobile">
          <div className="flex w-full justify-center gap-1 rounded-2xl border border-white/[0.06] bg-black/25 p-1">
            {tabs.map((t) => {
              const active = pathname === t.href;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`flex-1 rounded-md px-2 py-1.5 text-center font-display text-xs font-medium tracking-wide transition ${
                    active ? "bg-white/10 text-white" : "text-ink/40 hover:bg-white/[0.04] hover:text-ink/75"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
