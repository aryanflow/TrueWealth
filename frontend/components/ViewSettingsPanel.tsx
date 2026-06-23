"use client";

import { useCallback, useEffect, useState } from "react";

export interface PortfolioViewRow {
  id: string;
  name: string;
  include_asset_groups: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

const GROUP_ORDER: { key: string; label: string }[] = [
  { key: "mf", label: "MF" },
  { key: "in_stocks", label: "IN stocks" },
  { key: "us_stocks", label: "US stocks" },
  { key: "etfs", label: "ETFs" },
  { key: "cash", label: "Cash" },
  { key: "fd", label: "FD" },
  { key: "epf", label: "EPF" },
  { key: "crypto", label: "Crypto" },
  { key: "gold", label: "Gold" },
  { key: "other", label: "Other" },
];

function allTrue(): Record<string, boolean> {
  return Object.fromEntries(GROUP_ORDER.map(({ key }) => [key, true]));
}

function presetInvestable(): Record<string, boolean> {
  const m = allTrue();
  for (const k of ["fd", "epf", "gold", "other"]) m[k] = false;
  return m;
}

function presetLocked(): Record<string, boolean> {
  const m = Object.fromEntries(GROUP_ORDER.map(({ key }) => [key, false]));
  for (const k of ["fd", "epf", "gold", "other"]) m[k] = true;
  return m;
}

async function fetchViews(): Promise<{ views: PortfolioViewRow[]; active_id: string | null }> {
  const r = await fetch("/api/views", { cache: "no-store" });
  if (!r.ok) throw new Error(`views ${r.status}`);
  return r.json() as Promise<{ views: PortfolioViewRow[]; active_id: string | null }>;
}

export function ViewSettingsPanel({ onSaved }: { onSaved: () => void }) {
  const [views, setViews] = useState<PortfolioViewRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [inc, setInc] = useState<Record<string, boolean>>(allTrue);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const active = views.find((v) => v.id === activeId) ?? views[0];

  const reload = useCallback(async () => {
    setErr(null);
    const data = await fetchViews();
    setViews(data.views);
    setActiveId(data.active_id);
    const row = data.views.find((v) => v.id === data.active_id) ?? data.views[0];
    if (row) {
      setName(row.name);
      setInc({ ...allTrue(), ...row.include_asset_groups });
    }
  }, []);

  useEffect(() => {
    void reload().catch((e: unknown) => setErr(e instanceof Error ? e.message : "Failed to load views"));
  }, [reload]);

  async function setActiveView(id: string) {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/views/active/${id}`, { method: "POST" });
      if (!r.ok) throw new Error(`active ${r.status}`);
      onSaved();
      await reload();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveInclude(next: Record<string, boolean>) {
    if (!activeId) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/views/${activeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ include_asset_groups: next }),
      });
      if (!r.ok) throw new Error(`save ${r.status}`);
      setInc(next);
      onSaved();
      await reload();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveName() {
    if (!activeId) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === active?.name) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/views/${activeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!r.ok) throw new Error(`save ${r.status}`);
      onSaved();
      await reload();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  async function applyPreset(p: Record<string, boolean>) {
    await saveInclude(p);
  }

  async function resetView() {
    if (!activeId) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/views/${activeId}/reset`, { method: "POST" });
      if (!r.ok) throw new Error(`reset ${r.status}`);
      const row = (await r.json()) as PortfolioViewRow;
      setName(row.name);
      setInc({ ...allTrue(), ...row.include_asset_groups });
      onSaved();
      await reload();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  function toggle(key: string) {
    const next = { ...inc, [key]: !inc[key] };
    void saveInclude(next);
  }

  return (
    <div className="space-y-4">
      {err ? <p className="text-sm text-loss-muted">{err}</p> : null}
      <label className="block text-xs text-muted">
        Active view
        <select
          value={activeId ?? ""}
          onChange={(e) => void setActiveView(e.target.value)}
          disabled={loading || !views.length}
          className="mt-1 block w-full rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm text-ink"
        >
          {views.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-muted">
        View name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void saveName()}
          className="mt-1 w-full rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm text-ink"
        />
      </label>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted">Asset groups</p>
      <ul className="space-y-2">
        {GROUP_ORDER.map(({ key, label: lb }) => (
          <li key={key} className="flex items-center justify-between rounded-lg border border-hairline bg-surface-elevated/40 px-3 py-2">
            <span className="text-sm text-ink">{lb}</span>
            <button
              type="button"
              disabled={loading}
              onClick={() => toggle(key)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                inc[key] ? "bg-mintglass/15 text-mintglass" : "bg-line/50 text-muted"
              }`}
            >
              {inc[key] ? "On" : "Off"}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => void applyPreset(allTrue())}
          className="rounded-md border border-hairline px-2 py-1 text-xs text-ink"
        >
          All assets
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void applyPreset(presetInvestable())}
          className="rounded-md border border-hairline px-2 py-1 text-xs text-ink"
        >
          Investable only
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void applyPreset(presetLocked())}
          className="rounded-md border border-hairline px-2 py-1 text-xs text-ink"
        >
          Locked long-term
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void resetView()}
          className="rounded-md border border-ember/35 px-2 py-1 text-xs text-ember"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
