import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireCurrentMembership } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { ApiKeyManager } from "@/components/ApiKeyManager";

export default async function ApiKeysPage() {
  const session = await requireCurrentMembership();
  if (!can(session.role, "apikeys:manage")) {
    return <p className="p-8 text-sm text-stone-500">Ask an owner or finance manager for API access.</p>;
  }

  const keys = await db.apiKey.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, keyPrefix: true, scopes: true, createdAt: true, lastUsedAt: true, revokedAt: true },
  });

  const h = await headers();
  const origin = `${h.get("host")?.startsWith("localhost") ? "http" : "https"}://${h.get("host")}`;
  const embedKey = keys.find((k) => k.scopes.includes("embed") && !k.revokedAt);

  return (
    <div className="max-w-3xl space-y-8 p-8">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">API &amp; Embed</h1>
        <p className="text-sm text-stone-500">
          Surface spend data inside your own internal portal via the REST API, or embed a read-only widget.
        </p>
      </div>

      <ApiKeyManager
        initialKeys={keys.map((k) => ({
          ...k,
          createdAt: k.createdAt.toISOString(),
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          revokedAt: k.revokedAt?.toISOString() ?? null,
        }))}
      />

      <div className="card">
        <h2 className="mb-2 font-medium text-stone-900">Embeddable widget</h2>
        <p className="mb-2 text-sm text-stone-500">
          Create a key with the <code>embed</code> scope above, then embed the read-only dashboard/query widget
          anywhere with:
        </p>
        <pre className="overflow-x-auto rounded-md bg-stone-900 px-3 py-2 text-xs text-stone-100">
          {`<iframe src="${origin}/embed/${embedKey ? "YOUR_EMBED_KEY" : "YOUR_EMBED_KEY"}" width="100%" height="700" frameborder="0"></iframe>`}
        </pre>
      </div>

      <div className="card">
        <h2 className="mb-2 font-medium text-stone-900">REST API</h2>
        <p className="mb-2 text-sm text-stone-500">
          Send a key with the <code>read</code> scope as <code>X-API-Key</code> (or <code>Authorization: Bearer</code>
          ).
        </p>
        <pre className="overflow-x-auto rounded-md bg-stone-900 px-3 py-2 text-xs text-stone-100">{`GET  ${origin}/api/v1/summary
GET  ${origin}/api/v1/insights
POST ${origin}/api/v1/query   { "question": "..." }

curl -H "X-API-Key: YOUR_KEY" ${origin}/api/v1/summary`}</pre>
      </div>
    </div>
  );
}
