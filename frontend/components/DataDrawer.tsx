"use client";

import { type ReactNode, useState } from "react";

export function DataDrawer({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-line bg-surface/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-ink hover:bg-canvas/30"
      >
        <span>{title}</span>
        <span className="font-mono text-xs text-muted">{open ? "▾" : "▸"}</span>
      </button>
      {open ? <div className="border-t border-line/70 px-4 py-4">{children}</div> : null}
    </div>
  );
}
