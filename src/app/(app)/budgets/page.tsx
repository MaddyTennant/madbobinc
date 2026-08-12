import Link from "next/link";
import { db } from "@/lib/db";
import { requireCurrentMembership } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { formatCurrency } from "@/lib/format";
import {
  decideApprovalAction,
  setApprovalThresholdAction,
  setBudgetAction,
  submitApprovalRequestAction,
} from "./actions";

function currentMonthStart(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export default async function BudgetsPage() {
  const session = await requireCurrentMembership();
  const canManageBudgets = can(session.role, "budgets:manage");
  const canDecide = can(session.role, "approvals:decide");
  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: session.workspaceId } });
  const monthStart = currentMonthStart();

  const [categories, budgets, actuals, approvals] = await Promise.all([
    db.category.findMany({ where: { workspaceId: session.workspaceId }, orderBy: { label: "asc" } }),
    db.budget.findMany({ where: { workspaceId: session.workspaceId, month: monthStart } }),
    db.transaction.groupBy({
      by: ["categoryId"],
      where: { workspaceId: session.workspaceId, kind: "EXPENSE", date: { gte: monthStart, lte: new Date() } },
      _sum: { amount: true },
    }),
    db.approvalRequest.findMany({ where: { workspaceId: session.workspaceId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  const budgetByCategory = new Map(budgets.map((b) => [b.categoryId, b]));
  const actualByCategory = new Map(actuals.map((a) => [a.categoryId, a._sum.amount ?? 0]));

  return (
    <div className="max-w-4xl space-y-8 p-8">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Budgets &amp; Approvals</h1>
        <p className="text-sm text-stone-500">{workspace.location} — {monthStart.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</p>
      </div>

      <div className="card">
        <h2 className="mb-3 font-medium text-stone-900">Monthly budget by category</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-stone-500">
              <th className="pb-2 font-medium">Category</th>
              <th className="pb-2 font-medium">Budget</th>
              <th className="pb-2 font-medium">Actual</th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => {
              const budget = budgetByCategory.get(c.id);
              const actual = actualByCategory.get(c.id) ?? 0;
              const overBudget = budget && actual > budget.amount;
              return (
                <tr key={c.id} className="border-b border-stone-100 last:border-0">
                  <td className="py-2">{c.label}</td>
                  <td className="py-2">
                    {canManageBudgets ? (
                      <form action={setBudgetAction} className="flex items-center gap-2">
                        <input type="hidden" name="categoryId" value={c.id} />
                        <input
                          className="input w-28"
                          type="number"
                          name="amount"
                          min={0}
                          step="1"
                          defaultValue={budget?.amount ?? 0}
                        />
                        <button className="text-xs font-medium text-brand-600 hover:underline" type="submit">
                          Save
                        </button>
                      </form>
                    ) : (
                      formatCurrency(budget?.amount ?? 0, workspace.currency)
                    )}
                  </td>
                  <td className="py-2">{formatCurrency(actual, workspace.currency)}</td>
                  <td className="py-2">
                    {!budget ? (
                      <span className="text-xs text-stone-400">No budget set</span>
                    ) : overBudget ? (
                      <span className="badge bg-red-100 text-red-700">
                        Over by {formatCurrency(actual - budget.amount, workspace.currency)}
                      </span>
                    ) : (
                      <span className="badge bg-emerald-100 text-emerald-700">On track</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-stone-400">
          See the <Link href="/insights" className="text-brand-600 hover:underline">Insights &amp; Alerts</Link> feed for
          AI-generated recommendations on categories trending over budget.
        </p>
      </div>

      <div className="card max-w-sm">
        <h2 className="mb-2 font-medium text-stone-900">Approval threshold</h2>
        <p className="mb-3 text-sm text-stone-500">Purchase requests above this amount require an approver's decision.</p>
        {canManageBudgets ? (
          <form action={setApprovalThresholdAction} className="flex items-center gap-2">
            <input className="input w-32" type="number" name="approvalThreshold" min={0} step="1" defaultValue={workspace.approvalThreshold} />
            <button className="btn-secondary text-sm" type="submit">
              Save
            </button>
          </form>
        ) : (
          <p className="text-sm text-stone-700">{formatCurrency(workspace.approvalThreshold, workspace.currency)}</p>
        )}
      </div>

      <div className="card">
        <h2 className="mb-3 font-medium text-stone-900">Submit a purchase request</h2>
        <form action={submitApprovalRequestAction} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
          <input className="input" name="description" placeholder="What is this for?" required />
          <input className="input w-32" type="number" name="amount" placeholder="Amount" min={0.01} step="0.01" required />
          <button className="btn-primary" type="submit">
            Submit
          </button>
        </form>
      </div>

      <div className="card">
        <h2 className="mb-3 font-medium text-stone-900">Purchase requests</h2>
        {approvals.length === 0 ? (
          <p className="text-sm text-stone-500">None yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-stone-500">
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 font-medium">Amount</th>
                <th className="pb-2 font-medium">Status</th>
                {canDecide ? <th className="pb-2 font-medium">Decide</th> : null}
              </tr>
            </thead>
            <tbody>
              {approvals.map((a) => (
                <tr key={a.id} className="border-b border-stone-100 last:border-0">
                  <td className="py-2">{a.description}</td>
                  <td className="py-2">{formatCurrency(a.amount, workspace.currency)}</td>
                  <td className="py-2">
                    <span
                      className={`badge ${
                        a.status === "APPROVED"
                          ? "bg-emerald-100 text-emerald-700"
                          : a.status === "REJECTED"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  {canDecide ? (
                    <td className="py-2">
                      {a.status === "PENDING" ? (
                        <div className="flex gap-2">
                          <form action={decideApprovalAction}>
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="decision" value="APPROVED" />
                            <button className="text-xs font-medium text-brand-600 hover:underline" type="submit">
                              Approve
                            </button>
                          </form>
                          <form action={decideApprovalAction}>
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="decision" value="REJECTED" />
                            <button className="text-xs font-medium text-stone-500 hover:underline" type="submit">
                              Reject
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
