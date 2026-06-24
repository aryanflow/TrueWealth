"use client";

import { CommandPaletteProvider } from "@/components/CommandPalette";
import { DataQualityBanner } from "@/components/DataQualityBanner";
import { DisplayPreferencesProvider } from "@/components/DisplayPreferences";
import { HeaderShell } from "@/components/HeaderShell";
import { HoldingInspectorSheet } from "@/components/HoldingInspectorSheet";
import { OnboardingGate } from "@/components/OnboardingGate";
import { PortfolioProvider, usePortfolio } from "@/components/PortfolioContext";
import { PortfolioRefreshBar } from "@/components/PortfolioRefreshBar";

function DashboardBody({ children }: { children: React.ReactNode }) {
  const { refreshing, data, loading } = usePortfolio();
  const gated =
    !loading &&
    data != null &&
    data.totals.market_value < 1 &&
    (!data.meta.indmoney_oauth_connected || data.meta.mode === "empty" || !data.meta.mcp_connected);

  if (gated) {
    return (
      <>
        <PortfolioRefreshBar />
        <OnboardingGate />
      </>
    );
  }

  return (
    <>
      <PortfolioRefreshBar />
      <DataQualityBanner />
      <div
        className={`relative transition-opacity duration-200 motion-reduce:transition-none ${
          refreshing && data ? "opacity-[0.94]" : ""
        }`}
      >
        {children}
      </div>
      <HoldingInspectorSheet />
    </>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <PortfolioProvider>
      <DisplayPreferencesProvider>
        <CommandPaletteProvider>
          <div className="relative min-h-screen overflow-x-hidden bg-canvas">
            <div
              className="pointer-events-none depth-field opacity-40 motion-safe:animate-drift motion-reduce:animate-none"
              aria-hidden
            />
            <HeaderShell />
            <DashboardBody>{children}</DashboardBody>
          </div>
        </CommandPaletteProvider>
      </DisplayPreferencesProvider>
    </PortfolioProvider>
  );
}
