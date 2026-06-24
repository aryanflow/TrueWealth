"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { SettingsSheet } from "@/components/SettingsSheet";
import { TrueWealthLogo } from "@/components/TrueWealthLogo";
import { disclaimerPlainText } from "@/components/Disclaimer";
import { usePortfolio } from "@/components/PortfolioContext";
import { useDisplayPreferences } from "@/components/DisplayPreferences";
import { deriveConnectionDisplay } from "@/lib/connectionStatus";
import { formatSyncShort } from "@/lib/format";

const tabs = [
  { href: "/today", label: "Today", num: "01" },
  { href: "/map", label: "Map", num: "02" },
  { href: "/decide", label: "Decide", num: "03" },
] as const;

function routeTitle(pathname: string | null): string {
  if (pathname?.startsWith("/map")) return "Map";
  if (pathname?.startsWith("/decide")) return "Decide";
  return "Today";
}

const DOT_CLASS: Record<string, string> = {
  mint: "bg-mint text-mint",
  warn: "bg-warn text-warn",
  coral: "bg-coral text-coral",
  muted: "bg-muted-dim text-muted-dim",
};

const QUALITY_CLASS: Record<string, string> = {
  good: "border-mint/40 bg-mint/10 text-mint",
  degraded: "border-coral/40 bg-coral/10 text-coral",
  partial: "border-brass-dim bg-brass/10 text-brass-soft",
};

export function HeaderShell() {
  const pathname = usePathname();
  const { data } = usePortfolio();
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const open = () => setSettingsOpen(true);
    window.addEventListener("tw-open-settings", open);
    return () => window.removeEventListener("tw-open-settings", open);
  }, []);

  const conn = useMemo(() => deriveConnectionDisplay(data?.meta), [data?.meta]);
  const pageLabel = routeTitle(pathname ?? null);
  const { hideBalances, toggleHideBalances, displayCurrency, setDisplayCurrency } = useDisplayPreferences();

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-line bg-canvas/95 backdrop-blur-[14px]">
        <div className="mx-auto flex h-[74px] max-w-7xl items-center justify-between gap-5 px-4 md:px-7">
          <Link
            href="/today"
            className="group flex min-w-0 items-center gap-3"
            aria-label={`True Wealth, ${pageLabel}`}
          >
            <span className="flex h-11 w-10 shrink-0 items-center justify-center" aria-hidden>
              <TrueWealthLogo className="h-11 w-10" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-[18px] font-semibold uppercase tracking-[0.14em] leading-none text-ink">
                True Wealth
              </p>
              <p className="mt-1 truncate text-[11px] uppercase tracking-[0.32em] text-muted-dim">{pageLabel}</p>
            </div>
          </Link>

          <nav
            className="hidden items-center gap-0.5 rounded-full border border-line bg-panel p-1 sm:flex"
            aria-label="Primary"
          >
            {tabs.map((t) => {
              const active = pathname === t.href || (t.href === "/today" && pathname === "/");
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`relative rounded-full px-5 py-2 text-[13.5px] tracking-wide transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peri/60 ${
                    active
                      ? "bg-gradient-to-b from-[#20232E] to-[#191C26] text-brass-soft shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_2px_10px_rgba(0,0,0,0.4)]"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  <span className={`mr-1.5 font-mono text-[9.5px] ${active ? "text-brass" : "text-muted-dim"}`}>
                    {t.num}
                  </span>
                  {t.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-3 md:gap-4">
            <div className="hidden text-right leading-tight sm:block" title={conn.qualityNotes}>
              <div className="flex items-center justify-end gap-2 text-[12.5px]">
                <span
                  className={`h-[7px] w-[7px] rounded-full shadow-[0_0_10px_currentColor] ${DOT_CLASS[conn.feedTone]}`}
                  aria-hidden
                />
                <span className="text-ink">{conn.feedLabel}</span>
                <span
                  className={`rounded-md border px-2 py-0.5 font-mono text-[10px] tracking-wide ${QUALITY_CLASS[conn.quality]}`}
                >
                  {conn.qualityLabel}
                </span>
              </div>
              <p className="mt-0.5 font-mono text-[10.5px] text-muted-dim">
                Last sync {formatSyncShort(conn.lastSync)}
              </p>
            </div>
            <button
              type="button"
              onClick={toggleHideBalances}
              className="ibtn"
              aria-label={hideBalances ? "Show balances" : "Hide balances"}
              aria-pressed={hideBalances}
              title={hideBalances ? "Show balances" : "Hide balances (privacy)"}
            >
              <span aria-hidden>{hideBalances ? "◉" : "◎"}</span>
            </button>
            <button
              type="button"
              onClick={() => setDisplayCurrency(displayCurrency === "INR" ? "USD" : "INR")}
              className="hidden min-h-10 rounded-[11px] border border-line bg-panel px-2.5 font-mono text-[10px] text-muted transition hover:border-line2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peri/60 sm:grid sm:place-items-center"
              aria-label={`Display currency ${displayCurrency}`}
              title={`Display whole book in ${displayCurrency === "INR" ? "USD" : "INR"} (uses portfolio FX rate)`}
            >
              {displayCurrency}
            </button>
            <button type="button" onClick={() => setSettingsOpen(true)} className="ibtn" aria-label="Open settings">
              <span className="sr-only">Settings</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </button>
            <details className="relative hidden sm:block">
              <summary className="ibtn cursor-pointer list-none marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="sr-only">About this app</span>
                <span aria-hidden className="text-sm font-medium">
                  i
                </span>
              </summary>
              <div className="absolute right-0 z-[60] mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-line bg-panel p-4 text-left text-xs leading-relaxed text-muted shadow-2xl">
                {disclaimerPlainText()}
              </div>
            </details>
          </div>
        </div>

        <nav className="flex border-t border-line px-4 py-2 sm:hidden" aria-label="Primary mobile">
          <div className="flex w-full justify-center gap-0.5 rounded-full border border-line bg-panel p-1">
            {tabs.map((t) => {
              const active = pathname === t.href || (t.href === "/today" && pathname === "/");
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`min-h-10 flex-1 rounded-full px-2 py-2 text-center text-xs font-medium tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peri/60 ${
                    active ? "bg-gradient-to-b from-[#20232E] to-[#191C26] text-brass-soft" : "text-muted"
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
