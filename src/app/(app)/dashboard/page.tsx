import { requireCurrentMembership } from "@/lib/tenant";
import { getDashboardSummary } from "@/lib/analytics/aggregate";
import { formatCurrency, formatDelta, formatPercent } from "@/lib/format";
import { StatTile } from "@/components/StatTile";
import { CategoryBarChart } from "@/components/charts/CategoryBarChart";
import { VendorBarChart } from "@/components/charts/VendorBarChart";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { BudgetVsActualChart } from "@/components/charts/BudgetVsActualChart";

export default async function DashboardPage() {
  const session = await requireCurrentMembership();
  const summary = await getDashboardSummary(session.workspaceId);
  const spendDelta = formatDelta(summary.totalSpendMTD, summary.totalSpendSamePointLastMonth);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <div>
        <h1 className="text-xl font-normal tracking-tight text-stone-700">Spend analyst dashboard</h1>
        <p className="text-sm text-stone-500">{summary.periodLabel} — month to date, all figures in {summary.currency}.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile
          label="Total spend (MTD)"
          value={formatCurrency(summary.totalSpendMTD, summary.currency)}
          deltaText={`${spendDelta.text} vs. same point last month`}
          deltaGood={spendDelta.positive}
        />
        <StatTile label="Revenue (MTD)" value={formatCurrency(summary.revenueMTD, summary.currency)} />
        <StatTile
          label={summary.primaryRatio.label}
          value={formatPercent(summary.primaryRatio.value)}
          sublabel={summary.primaryRatio.sublabel}
        />
        <StatTile
          label={summary.secondaryRatio.label}
          value={formatPercent(summary.secondaryRatio.value)}
          sublabel={summary.secondaryRatio.sublabel}
        />
        <StatTile
          label="30-day cash-out forecast"
          value={formatCurrency(summary.cashOutForecast30d, summary.currency)}
          sublabel={`${formatCurrency(summary.dailyBurnRate, summary.currency)}/day trailing average`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-medium text-stone-900">Spend by category</h2>
          <CategoryBarChart data={summary.byCategory} currency={summary.currency} />
        </div>
        <div className="card">
          <h2 className="mb-3 font-medium text-stone-900">Top vendors</h2>
          <VendorBarChart data={summary.byVendor} currency={summary.currency} />
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 font-medium text-stone-900">Spend vs. revenue — last 6 months</h2>
        <TrendLineChart data={summary.monthlyTrend} currency={summary.currency} />
      </div>

      <div className="card">
        <h2 className="mb-3 font-medium text-stone-900">Budget vs. actual — this month</h2>
        <BudgetVsActualChart data={summary.budgetVsActual} currency={summary.currency} />
      </div>
    </div>
  );
}
