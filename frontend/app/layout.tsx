import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";

import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TRUE WEALTH",
  description: "Unified portfolio dashboard. Decision support, not advice.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="font-sans">
        <header className="sticky top-0 z-50 border-b border-line/80 bg-canvas/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="group flex items-center gap-2">
              <span
                className="h-8 w-8 rounded-lg border border-line bg-gradient-to-br from-ion/35 to-mintglass/25 shadow-card"
                aria-hidden
              />
              <span className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted group-hover:text-ink">
                True Wealth
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/"
                className="rounded-lg px-3 py-2 text-muted transition hover:bg-surface hover:text-ink"
              >
                Dashboard
              </Link>
              <Link
                href="/mcp"
                className="rounded-lg px-3 py-2 text-muted transition hover:bg-surface hover:text-ink"
              >
                INDmoney MCP
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
