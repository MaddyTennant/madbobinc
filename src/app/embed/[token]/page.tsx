import { db } from "@/lib/db";
import { resolveApiKey, requireScope } from "@/lib/apikeys";
import { getDashboardSummary } from "@/lib/analytics/aggregate";
import { formatCurrency, formatPercent } from "@/lib/format";
import { StatTile } from "@/components/StatTile";
import { CategoryBarChart } from "@/components/charts/CategoryBarChart";
import { EmbedQueryBox } from "@/components/EmbedQueryBox";

export default async function EmbedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const key = await resolveApiKey(token);

  if (!key || !requireScope(key, "embed")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
        <p className="text-sm text-slate-500">This embed link is invalid or has been revoked.</p>
      </div>
    );
  }

  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: key.workspaceId } });
  const summary = await getDashboardSummary(key.workspaceId);

  return (
    <div className="min-h-screen space-y-6 bg-slate-50 p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{workspace.name}</p>
        <h1 className="text-lg font-semibold text-slate-900">Spend overview — {summary.periodLabel}</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Total spend (MTD)" value={formatCurrency(summary.totalSpendMTD, summary.currency)} />
        <StatTile label="Revenue (MTD)" value={formatCurrency(summary.revenueMTD, summary.currency)} />
        <StatTile label="Food cost %" value={formatPercent(summary.foodCostPct)} />
        <StatTile label="Prime cost %" value={formatPercent(summary.primeCostPct)} />
      </div>

      <div className="card">
        <h2 className="mb-3 font-medium text-slate-900">Spend by category</h2>
        <CategoryBarChart data={summary.byCategory} currency={summary.currency} />
      </div>

      <EmbedQueryBox token={token} />

      <p className="text-center text-xs text-slate-300">Powered by Madbob Spend — read-only view</p>
    </div>
  );
}
