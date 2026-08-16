import { db } from "@/lib/db";
import { requireCurrentMembership } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { formatCurrency } from "@/lib/format";
import { cancelRenewalAction, createRenewalAction, renewRenewalAction } from "./actions";

const RENEWAL_TYPE_LABELS: Record<string, string> = {
  INSURANCE: "Insurance",
  LICENSE: "License",
  SUBSCRIPTION: "Subscription",
};

function currentMonthStart(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export default async function BudgetsPage() {
  const session = await requireCurrentMembership();
  const canManageBudgets = can(session.role, "budgets:manage");
  const canDecide = can(session.role, "approvals:decide");
  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: session.workspaceId } });
  const monthStart = currentMonthStart();

  const renewals = await db.renewal.findMany({
    where: { workspaceId: session.workspaceId, status: "ACTIVE" },
    orderBy: { renewalDate: "asc" },
    take: 20,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <div>
        <h1 className="text-xl font-normal tracking-tight text-stone-700">Budgets &amp; Approvals</h1>
        <p className="text-sm text-stone-500">{workspace.location} — {monthStart.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</p>
      </div>

      <div className="card">
        <h2 className="font-medium text-stone-900">Upcoming renewals &amp; subscriptions</h2>
        <p className="mb-3 text-sm text-stone-500">Licenses, insurance, and subscriptions coming due.</p>

        {renewals.length === 0 ? (
          <p className="text-sm text-stone-500">None tracked yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-stone-500">
                <th className="pb-2 text-center font-medium">Name</th>
                <th className="pb-2 text-center font-medium">Type</th>
                <th className="pb-2 text-center font-medium">Renewal date</th>
                <th className="pb-2 text-center font-medium">Amount</th>
                {canDecide ? <th className="pb-2 text-center font-medium">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {renewals.map((r) => {
                const days = daysUntil(r.renewalDate);
                return (
                  <tr key={r.id} className="border-b border-stone-100 last:border-0">
                    <td className="py-2 text-center">
                      <p className="font-medium text-stone-900">{r.name}</p>
                      {r.description ? <p className="text-xs text-stone-500">{r.description}</p> : null}
                    </td>
                    <td className="py-2 text-center">
                      <span className="badge bg-sky-100 text-sky-700">{RENEWAL_TYPE_LABELS[r.type]}</span>
                    </td>
                    <td className="py-2 text-center">
                      <p>{r.renewalDate.toLocaleDateString("en-US", { timeZone: "UTC" })}</p>
                      <p className="text-xs text-stone-400">{days < 0 ? "overdue" : `${days} days`}</p>
                    </td>
                    <td className="py-2 text-center">{formatCurrency(r.amount, workspace.currency)}</td>
                    {canDecide ? (
                      <td className="py-2 text-center">
                        <div className="flex justify-center gap-2">
                          <form action={renewRenewalAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <button
                              className="rounded-md border border-stone-300 px-2 py-1 text-xs font-medium text-brand-600 hover:bg-stone-900/5"
                              type="submit"
                            >
                              Renew
                            </button>
                          </form>
                          <form action={cancelRenewalAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <button
                              className="rounded-md border border-stone-300 px-2 py-1 text-xs font-medium text-stone-500 hover:bg-stone-900/5"
                              type="submit"
                            >
                              Cancel
                            </button>
                          </form>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {canManageBudgets ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-brand-600">Add a renewal</summary>
            <form action={createRenewalAction} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input className="input" name="name" placeholder="Name (e.g. Liability Insurance)" required />
              <select className="input" name="type" defaultValue="SUBSCRIPTION" required>
                {Object.entries(RENEWAL_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input className="input sm:col-span-2" name="description" placeholder="Description (optional)" />
              <input className="input" type="number" name="amount" placeholder="Amount" min={0} step="0.01" required />
              <input className="input" type="date" name="renewalDate" required />
              <input className="input" type="number" name="cadenceMonths" placeholder="Renews every N months (blank = one-off)" min={1} />
              <button className="btn-primary sm:col-span-2" type="submit">
                Add renewal
              </button>
            </form>
          </details>
        ) : null}
      </div>
    </div>
  );
}
