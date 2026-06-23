"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import { usePortfolio } from "@/components/PortfolioContext";

type CommandPaletteContextValue = {
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPaletteOptional(): CommandPaletteContextValue | null {
  return useContext(CommandPaletteContext);
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openPalette = useCallback(() => setOpen(true), []);
  const closePalette = useCallback(() => setOpen(false), []);
  const togglePalette = useCallback(() => setOpen((o) => !o), []);

  const value = useMemo(
    () => ({ openPalette, closePalette, togglePalette }),
    [openPalette, closePalette, togglePalette],
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPaletteDialog open={open} onOpenChange={setOpen} />
    </CommandPaletteContext.Provider>
  );
}

function CommandPaletteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, setInspectorHolding } = usePortfolio();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "k" && e.key !== "K") return;
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      onOpenChange(!open);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const holdings = data?.holdings;
  const filtered = useMemo(() => {
    const rows = holdings ?? [];
    const t = q.trim().toLowerCase();
    if (!t) return rows.slice(0, 12);
    return rows
      .filter((h) => {
        const n = h.name.toLowerCase();
        const sym = (h.symbol ?? "").toLowerCase();
        const isin = (h.isin ?? "").toLowerCase();
        return n.includes(t) || sym.includes(t) || isin.includes(t);
      })
      .slice(0, 12);
  }, [holdings, q]);

  const goHolding = (id: string) => {
    onOpenChange(false);
    const h = (holdings ?? []).find((x) => x.id === id);
    if (h) setInspectorHolding(h);
  };

  const handleContentKeyDown = (e: ReactKeyboardEvent) => {
    if (!open) return;
    if (e.key === "Escape") return;
    if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm" />
        <DialogPrimitive.Content
          onKeyDown={handleContentKeyDown}
          className="fixed left-1/2 top-[12vh] z-[210] w-[min(100vw-1.5rem,28rem)] -translate-x-1/2 rounded-2xl border border-white/[0.08] bg-canvas/95 p-0 shadow-[0_24px_80px_rgba(0,0,0,0.65)] outline-none"
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search holdings by name or jump to Today, Map, or Decide.
          </DialogPrimitive.Description>
          <div className="border-b border-hairline p-3">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search holdings or go to..."
              className="w-full rounded-xl border border-white/[0.06] bg-black/35 px-3 py-2.5 text-sm text-ink outline-none ring-0 placeholder:text-muted focus:border-ion/40"
              autoComplete="off"
              aria-label="Command palette search"
            />
          </div>
          <div className="max-h-[min(50vh,22rem)] overflow-y-auto p-2">
            <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted">Holdings</p>
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted">No matches.</p>
            ) : (
              <ul className="space-y-0.5">
                {filtered.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => goHolding(h.id)}
                      className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-ink/90 transition hover:bg-ion/10 hover:text-ink"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{h.name}</span>
                      {h.symbol ? (
                        <span className="ml-2 shrink-0 font-mono text-xs text-muted">{h.symbol}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted">Pages</p>
            <ul className="space-y-0.5">
              <li>
                <Link
                  href="/today"
                  onClick={() => onOpenChange(false)}
                  className="flex rounded-xl px-3 py-2 text-sm text-ink/90 transition hover:bg-ion/10 hover:text-ink"
                >
                  Today
                </Link>
              </li>
              <li>
                <Link
                  href="/map"
                  onClick={() => onOpenChange(false)}
                  className="flex rounded-xl px-3 py-2 text-sm text-ink/90 transition hover:bg-ion/10 hover:text-ink"
                >
                  Map
                </Link>
              </li>
              <li>
                <Link
                  href="/decide"
                  onClick={() => onOpenChange(false)}
                  className="flex rounded-xl px-3 py-2 text-sm text-ink/90 transition hover:bg-ion/10 hover:text-ink"
                >
                  Decide
                </Link>
              </li>
            </ul>
          </div>
          <p className="border-t border-hairline px-3 py-2 text-[11px] text-muted/80">
            <kbd className="rounded border border-hairline bg-black/30 px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd>{" "}
            to close
          </p>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
