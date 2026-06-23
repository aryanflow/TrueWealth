"use client";

import Link from "next/link";

/**
 * Full-width empty state when the app is not on a live MCP book.
 * Parent should render this instead of dashboard routes when gated.
 */
export function OnboardingGate() {
  return (
    <main className="mx-auto max-w-lg px-4 py-20 text-center">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted">True Wealth</p>
      <h1 className="mt-3 font-display text-2xl text-ink">Connect to load your book</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        This dashboard is read-only and stays empty until INDmoney OAuth and MCP are connected. Open{" "}
        <strong className="text-ink">Settings</strong> in the header, then use <strong className="text-ink">Connect INDmoney</strong>{" "}
        and confirm your MCP endpoint.
      </p>
      <div className="mt-8">
        <Link
          href="/today"
          className="inline-flex justify-center rounded-xl border border-ion/40 bg-ion/15 px-5 py-3 text-sm font-medium text-ink hover:bg-ion/25"
        >
          Continue to Today
        </Link>
      </div>
    </main>
  );
}
