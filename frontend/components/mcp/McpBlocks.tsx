"use client";

import { useEffect, useState } from "react";

import { DEMO_TOOLS, QUICKSTART_SNIPPET } from "@/lib/mcpDemoTools";

const REQ_DEMO = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools/list",
  params: {},
};

function pretty(o: object) {
  return JSON.stringify(o, null, 2);
}

export function McpSignaturePanel() {
  const [text, setText] = useState("");
  const [replay, setReplay] = useState(0);
  /** Avoid hydration mismatch: never branch on `window` until after first client paint. */
  const [clientReady, setClientReady] = useState(false);
  const full = pretty(REQ_DEMO);

  useEffect(() => {
    setClientReady(true);
  }, []);

  useEffect(() => {
    if (!clientReady || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setText(full);
      return;
    }
    setText("");
    let i = 0;
    const id = window.setInterval(() => {
      i += Math.max(1, Math.floor(full.length / 120));
      setText(full.slice(0, Math.min(i, full.length)));
      if (i >= full.length) window.clearInterval(id);
    }, 14);
    return () => window.clearInterval(id);
  }, [full, replay, clientReady]);

  const showCaret =
    clientReady &&
    typeof window !== "undefined" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
    text.length < full.length;

  return (
    <div className="glass rounded-3xl p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] text-ion">
            POST /mcp
          </span>
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-muted">
            Example JSON-RPC
          </span>
        </div>
        <span className="text-[11px] text-muted">
          Press <kbd className="rounded border border-white/15 bg-white/[0.06] px-1.5 py-0.5 font-mono">G</kbd> for
          tools
        </span>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.06] bg-black/35 p-4">
          <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">Request</div>
          <pre className="mt-3 whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-ink/85">
            {text}
            {showCaret && (
              <span className="ml-1 inline-block h-[1.1em] w-2 translate-y-[0.15em] animate-caret rounded-sm bg-white/55" />
            )}
          </pre>
          <p className="mt-3 text-[11px] text-muted">
            Always list tools first: names are discovered, not hardcoded.
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-black/35 p-4">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">Snapshot</div>
            <span className="rounded-full border border-mintglass/30 bg-mintglass/10 px-2 py-0.5 text-[10px] text-mintglass">
              Demo card
            </span>
          </div>
          <div className="glass-soft mt-3 rounded-2xl p-4">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted">Total wealth</div>
            <div className="mt-2 font-mono text-2xl text-ink">₹3,25,086.71</div>
            <div className="mt-1 text-[11px] text-muted">Mock snapshot. Your dashboard replaces this with live data.</div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="glass-soft rounded-2xl p-3">
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted">Day move</div>
              <div className="mt-1 font-mono text-sm text-mintglass">+₹653.80</div>
            </div>
            <div className="glass-soft rounded-2xl p-3">
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted">Flag</div>
              <div className="mt-1 font-mono text-sm text-ember">Concentration</div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 border-t border-white/[0.06] pt-4 md:flex-row md:items-center md:justify-between">
        <p className="text-[11px] text-muted">Teaches the loop: request → normalized portfolio card.</p>
        <button
          type="button"
          onClick={() => setReplay((x) => x + 1)}
          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-xs text-ink transition hover:bg-white/[0.07]"
        >
          Replay typing
        </button>
      </div>
    </div>
  );
}

export function McpToolCatalog() {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(DEMO_TOOLS[0]);
  const [live, setLive] = useState<string[]>([]);
  const [liveDetail, setLiveDetail] = useState<{ name: string; description?: string | null }[]>([]);

  useEffect(() => {
    fetch("/api/portfolio", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const inv = d?.meta?.tool_inventory as string[] | undefined;
        if (Array.isArray(inv)) setLive(inv);
        const tools = d?.meta?.mcp_tools as { name: string; description?: string | null }[] | undefined;
        if (Array.isArray(tools) && tools.length) setLiveDetail(tools);
      })
      .catch(() => {});
  }, []);

  const list = DEMO_TOOLS.filter((t) => (t.name + t.desc).toLowerCase().includes(q.trim().toLowerCase()));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/") {
        e.preventDefault();
        document.getElementById("mcp-tool-search")?.focus();
      }
      if (e.key.toLowerCase() === "g") {
        document.getElementById("mcp-tools")?.scrollIntoView({ behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <section id="mcp-tools" className="py-14 md:py-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted">Tool catalog</div>
          <h2 className="mt-2 font-display text-3xl text-ink md:text-4xl">Discoverable by design.</h2>
        </div>
        <p className="max-w-md text-sm text-muted">
          Demo schemas below. Live catalog from your last MCP discovery:{" "}
          {liveDetail.length ? (
            <span className="block pt-1 font-mono text-[11px] leading-relaxed text-mintglass/95">
              {liveDetail.map((t) => (
                <span key={t.name} className="mr-2 inline-block">
                  {t.name}
                  {t.description ? ` — ${t.description.slice(0, 80)}${t.description.length > 80 ? "…" : ""}` : ""}
                  <br />
                </span>
              ))}
            </span>
          ) : live.length ? (
            <span className="font-mono text-xs text-mintglass">{live.join(", ")}</span>
          ) : (
            <span className="text-muted">open the dashboard once with MCP connected to populate.</span>
          )}
        </p>
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-12">
        <div className="glass rounded-3xl p-5 lg:col-span-5">
          <div className="flex items-center justify-between text-sm text-muted">
            <span>Search tools</span>
            <kbd className="rounded border border-white/10 px-1.5 font-mono text-[10px]">/</kbd>
          </div>
          <input
            id="mcp-tool-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-ink outline-none focus:ring-2 focus:ring-ion/40"
            placeholder="holdings, compare, transactions…"
          />
          <div className="mt-4 max-h-[360px] space-y-2 overflow-auto">
            {list.length === 0 ? (
              <p className="rounded-2xl border border-white/[0.06] p-4 text-sm text-muted">No matches.</p>
            ) : (
              list.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => setSel(t)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    sel.name === t.name ? "border-ion/40 bg-ion/10" : "border-white/[0.06] bg-black/25 hover:border-white/15"
                  }`}
                >
                  <div className="font-mono text-sm text-ink">{t.name}</div>
                  <div className="mt-1 text-xs text-muted">{t.desc}</div>
                </button>
              ))
            )}
          </div>
        </div>
        <div className="glass rounded-3xl p-6 lg:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted">Selected</div>
              <div className="mt-2 font-mono text-xl text-ink">{sel.name}</div>
              <p className="mt-2 text-sm text-muted">{sel.desc}</p>
            </div>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(pretty(sel.req))}
              className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 font-mono text-xs text-ink hover:bg-white/[0.08]"
            >
              Copy request
            </button>
          </div>
          <div className="mt-6 grid gap-4 border-t border-white/[0.06] pt-6 md:grid-cols-2">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted">Example request</div>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl border border-white/[0.06] bg-black/35 p-4 font-mono text-[11px] text-ink/80">
                {pretty(sel.req)}
              </pre>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted">Example response</div>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl border border-white/[0.06] bg-black/35 p-4 font-mono text-[11px] text-ink/80">
                {pretty(sel.res)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function McpQuickstartBlock() {
  return (
    <section id="mcp-quickstart" className="py-14 md:py-20">
      <div className="glass rounded-3xl p-7 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-muted">Quickstart</div>
            <h2 className="mt-2 font-display text-3xl text-ink md:text-4xl">Ship an integration in an afternoon.</h2>
            <p className="mt-4 max-w-2xl text-sm text-muted">
              Discover tools, normalize holdings, stream deltas. LLM optional.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(QUICKSTART_SNIPPET)}
            className="rounded-xl bg-ion px-4 py-2.5 font-mono text-xs font-semibold text-twilight hover:bg-ion/90"
          >
            Copy snippet
          </button>
        </div>
        <pre className="mt-6 max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl border border-white/[0.06] bg-black/35 p-5 font-mono text-[11px] text-ink/80">
          {QUICKSTART_SNIPPET}
        </pre>
        <p className="mt-4 text-center text-xs text-muted">
          Decision support only. <strong className="text-ink">Not investment advice.</strong>
        </p>
      </div>
    </section>
  );
}
