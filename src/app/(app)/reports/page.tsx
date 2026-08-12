import { requireCurrentMembership } from "@/lib/tenant";
import { isLlmConfigured } from "@/lib/llm/client";
import { generateMonthlyReport } from "@/lib/llm/report";
import { formatCurrency } from "@/lib/format";

export default async function ReportsPage() {
  const session = await requireCurrentMembership();
  const report = await generateMonthlyReport(session.workspaceId);

  return (
    <div className="max-w-3xl space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Reports</h1>
          <p className="text-sm text-stone-500">AI-written monthly summary, plus raw data export.</p>
          {!isLlmConfigured() ? (
            <p className="mt-1 text-xs text-amber-600">
              ANTHROPIC_API_KEY is not set — the narrative below is a templated summary, not an AI-written one.
            </p>
          ) : null}
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <a className="btn-secondary" href="/api/reports/export">
            Export CSV
          </a>
          <a className="btn-primary" href="/api/reports/pdf">
            Download PDF
          </a>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-2 font-medium text-stone-900">{report.periodLabel}</h2>
        <p className="whitespace-pre-wrap text-sm text-stone-700">{report.narrative}</p>
      </div>

      <div className="card">
        <h2 className="mb-3 font-medium text-stone-900">Top recommended actions</h2>
        {report.topActions.length === 0 ? (
          <p className="text-sm text-stone-500">No open AI insights this period.</p>
        ) : (
          <ul className="space-y-2 text-sm text-stone-700">
            {report.topActions.map((a, i) => (
              <li key={i}>
                <span className="font-medium">{a.title}</span> — {a.recommendation}{" "}
                <span className="text-stone-400">(est. {formatCurrency(a.estimatedImpact, report.summary.currency)})</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
