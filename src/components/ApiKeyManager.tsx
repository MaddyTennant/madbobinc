"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface ApiKeyRow {
  id: string;
  label: string;
  keyPrefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export function ApiKeyManager({ initialKeys }: { initialKeys: ApiKeyRow[] }) {
  const router = useRouter();
  const [keys, setKeys] = useState(initialKeys);
  const [label, setLabel] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read"]);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, scopes }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create key");
      }
      const created = await res.json();
      setRevealedKey(created.key);
      setLabel("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k)));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function toggleScope(scope: string) {
    setScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  }

  return (
    <div className="space-y-4">
      {revealedKey ? (
        <div className="card border-brand-200 bg-brand-50">
          <p className="text-sm font-medium text-brand-800">Copy this key now — it will not be shown again:</p>
          <p className="mt-2 break-all rounded-md bg-white px-3 py-2 font-mono text-xs text-stone-700">{revealedKey}</p>
        </div>
      ) : null}

      <form onSubmit={handleCreate} className="card space-y-3">
        <div>
          <label className="label" htmlFor="label">
            Label
          </label>
          <input
            className="input"
            id="label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Internal portal widget"
            required
          />
        </div>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={scopes.includes("read")} onChange={() => toggleScope("read")} />
            read (data API)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={scopes.includes("embed")} onChange={() => toggleScope("embed")} />
            embed (widget)
          </label>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button className="btn-primary" type="submit" disabled={busy || scopes.length === 0}>
          Create key
        </button>
      </form>

      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-stone-500">
              <th className="pb-2 font-medium">Label</th>
              <th className="pb-2 font-medium">Key</th>
              <th className="pb-2 font-medium">Scopes</th>
              <th className="pb-2 font-medium">Status</th>
              <th className="pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} className="border-b border-stone-100 last:border-0">
                <td className="py-2">{k.label}</td>
                <td className="py-2 font-mono text-xs text-stone-500">{k.keyPrefix}…</td>
                <td className="py-2 text-stone-500">{k.scopes.join(", ")}</td>
                <td className="py-2">
                  {k.revokedAt ? (
                    <span className="badge bg-stone-100 text-stone-400">Revoked</span>
                  ) : (
                    <span className="badge bg-emerald-100 text-emerald-700">Active</span>
                  )}
                </td>
                <td className="py-2">
                  {!k.revokedAt ? (
                    <button
                      className="text-xs font-medium text-stone-500 hover:underline"
                      onClick={() => handleRevoke(k.id)}
                      disabled={busy}
                    >
                      Revoke
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
