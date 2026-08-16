import Link from "next/link";
import type { ConnectorType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireCurrentMembership } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { credentialFieldName, PROVIDER_CATALOG, VERTICAL_CONNECTOR_TYPES } from "@/lib/connectors";
import { connectConnectorAction, disconnectConnectorAction, syncConnectorAction } from "./actions";

const TYPE_LABELS: Record<string, string> = {
  POS: "Point of Sale",
  ACCOUNTING: "Accounting",
  SUPPLIER: "Supplier / Ordering",
  BANK: "Bank & Card Feeds",
  PAYROLL: "Payroll",
  DELIVERY: "Delivery Marketplace",
  OBSERVABILITY: "Observability",
  CDN: "CDN / Edge",
  CLOUD: "Cloud Infrastructure",
};

const STATUS_STYLES: Record<string, string> = {
  CONNECTED: "bg-emerald-100 text-emerald-700",
  SYNCING: "bg-amber-100 text-amber-700",
  ERROR: "bg-red-100 text-red-700",
  DISCONNECTED: "bg-stone-100 text-stone-500",
};

function timeAgo(date: Date | null): string {
  if (!date) return "never";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireCurrentMembership();
  const { error } = await searchParams;
  const canManage = can(session.role, "integrations:manage");

  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: session.workspaceId } });
  const allowedTypes = new Set(VERTICAL_CONNECTOR_TYPES[workspace.vertical]);

  const connectors = (
    await db.connector.findMany({ where: { workspaceId: session.workspaceId }, orderBy: { type: "asc" } })
  ).filter((c) => allowedTypes.has(c.type));

  const connectedKeys = new Set(connectors.filter((c) => c.status === "CONNECTED").map((c) => `${c.type}:${c.provider}`));

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <div>
        <h1 className="text-xl font-normal tracking-tight text-stone-700">Integration hub</h1>
        <p className="text-sm text-stone-500">
          Connect the tools you already use. Credentials are encrypted at rest and never leave your workspace.
        </p>
      </div>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="card">
        <h2 className="mb-3 font-medium text-stone-900">Connected</h2>
        {connectors.length === 0 ? (
          <p className="text-sm text-stone-500">Nothing connected yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-stone-500">
                <th className="pb-2 text-center font-medium">Type</th>
                <th className="pb-2 text-center font-medium">Provider</th>
                <th className="pb-2 text-center font-medium">Status</th>
                <th className="pb-2 text-center font-medium">Last sync</th>
                <th className="pb-2 text-center font-medium">Records</th>
                {canManage ? <th className="pb-2 text-center font-medium">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {connectors.map((c) => (
                <tr key={c.id} className="border-b border-stone-100 last:border-0">
                  <td className="py-2 text-center">{TYPE_LABELS[c.type]}</td>
                  <td className="py-2 text-center capitalize">{c.provider}</td>
                  <td className="py-2 text-center">
                    <span className={`badge ${STATUS_STYLES[c.status]}`}>{c.status}</span>
                  </td>
                  <td className="py-2 text-center text-stone-500">{timeAgo(c.lastSyncAt)}</td>
                  <td className="py-2 text-center text-stone-500">{c.recordCount.toLocaleString()}</td>
                  {canManage ? (
                    <td className="py-2 text-center">
                      <div className="flex justify-center gap-2">
                        {c.status === "CONNECTED" ? (
                          <>
                            <form action={syncConnectorAction}>
                              <input type="hidden" name="connectorId" value={c.id} />
                              <button
                                className="rounded-md border border-stone-300 px-2 py-1 text-xs font-medium text-brand-600 hover:bg-stone-900/5"
                                type="submit"
                              >
                                Sync now
                              </button>
                            </form>
                            <form action={disconnectConnectorAction}>
                              <input type="hidden" name="connectorId" value={c.id} />
                              <button
                                className="rounded-md border border-stone-300 px-2 py-1 text-xs font-medium text-stone-500 hover:bg-stone-900/5"
                                type="submit"
                              >
                                Disconnect
                              </button>
                            </form>
                          </>
                        ) : (
                          <span className="text-xs text-stone-400">Disconnected</span>
                        )}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canManage ? (
        <div className="card">
          <h2 className="mb-3 font-medium text-stone-900">Available connectors</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Object.entries(PROVIDER_CATALOG)
              .filter(([type]) => allowedTypes.has(type as ConnectorType))
              .flatMap(([type, providers]) =>
                providers
                  .filter((p) => !connectedKeys.has(`${type}:${p.provider}`))
                  .map((p) => (
                  <details key={`${type}-${p.provider}`} className="rounded-lg border border-stone-200 p-3">
                    <summary className="cursor-pointer text-sm font-medium text-stone-800">
                      {p.label} <span className="text-xs font-normal text-stone-400">({TYPE_LABELS[type]})</span>
                    </summary>
                    <form action={connectConnectorAction} className="mt-3 space-y-2">
                      <input type="hidden" name="type" value={type} />
                      <input type="hidden" name="provider" value={p.provider} />
                      {p.credentialFields.map((field) => (
                        <input
                          key={field}
                          className="input"
                          name={credentialFieldName(field)}
                          placeholder={field}
                          required
                        />
                      ))}
                      <button className="btn-primary w-full" type="submit">
                        Connect {p.label}
                      </button>
                    </form>
                  </details>
                )),
            )}
          </div>
        </div>
      ) : null}

      <div className="card">
        <h2 className="mb-1 font-medium text-stone-900">CSV / spreadsheet import</h2>
        <p className="mb-3 text-sm text-stone-500">For any tool not listed above, upload a CSV export directly.</p>
        <Link href="/integrations/csv-import" className="btn-secondary">
          Import CSV
        </Link>
      </div>
    </div>
  );
}
