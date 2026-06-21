"use client";

import { useId, useState } from "react";

export function MetricTip({
  label,
  value,
  definition,
  source,
  children,
}: {
  label: string;
  value: React.ReactNode;
  definition: string;
  source: string;
  children?: React.ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        className="w-full text-left rounded-lg border border-line bg-surface/80 p-5 shadow-card transition hover:border-accent/40 hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        aria-describedby={id}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <p className="text-xs uppercase tracking-[0.2em] text-muted font-sans">{label}</p>
        <div className="mt-2 font-display text-3xl md:text-4xl text-ink">{value}</div>
        {children}
      </button>
      <div
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute left-0 top-full z-20 mt-2 max-w-sm rounded-md border border-line bg-canvas/95 px-3 py-2 text-xs text-muted shadow-card transition-opacity ${
          open ? "opacity-100" : "opacity-0"
        }`}
      >
        <p className="text-ink/90">{definition}</p>
        <p className="mt-1 text-[11px] text-muted">
          <span className="text-accent">Source:</span> {source}
        </p>
      </div>
    </div>
  );
}
