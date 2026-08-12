import { db } from "@/lib/db";
import { requireCurrentMembership } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { isLlmConfigured } from "@/lib/llm/client";
import { formatCurrency } from "@/lib/format";
import { acceptInsightAction, dismissInsightAction, runAnalysisAction } from "./actions";

const SEVERITY_STYLES: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-amber-100 text-amber-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-emerald-100 text-emerald-700",
  DISMISSED: "bg-slate-100 text-slate-400",
};

export default async function InsightsPage() {
  const session = await requireCurrentMembership();
  const canManage = can(session.role, "insights:manage");
  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: session.workspaceId } });

  const insights = await db.insight.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: [{ status: "asc" }, { severity: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Insights &amp; Alerts</h1>
          <p className="text-sm text-slate-500">
            An LLM reviews your connected spend data for price creep, duplicate invoices, vendor spikes,
            subscription waste, and budget overruns.
          </p>
          {!isLlmConfigured() ? (
            <p className="mt-1 text-xs text-amber-600">
              ANTHROPIC_API_KEY is not set — running in deterministic mock mode so this feature stays
              demoable; findings are still based on real data.
            </p>
          ) : null}
        </div>
        {canManage ? (
          <form action={runAnalysisAction}>
            <button className="btn-primary whitespace-nowrap" type="submit">
              Run analysis now
            </button>
          </form>
        ) : null}
      </div>

      {insights.length === 0 ? (
        <div className="card">
          <p className="text-sm text-slate-500">
            No insights yet. {canManage ? 'Click "Run analysis now" to scan your connected data.' : "Ask an owner or finance manager to run an analysis."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {insights.map((insight) => (
            <div key={insight.id} className="card">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`badge ${SEVERITY_STYLES[insight.severity]}`}>{insight.severity}</span>
                <span className={`badge ${STATUS_STYLES[insight.status]}`}>{insight.status}</span>
                <span className="text-xs text-slate-400">{insight.generatedBy === "llm" ? "AI-generated" : "Mock mode"}</span>
              </div>
              <h3 className="mt-2 font-medium text-slate-900">{insight.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{insight.summary}</p>
              <p className="mt-2 text-sm font-medium text-slate-900">
                Estimated impact: {formatCurrency(insight.estimatedImpact, workspace.currency)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                <span className="font-medium text-slate-700">Recommended: </span>
                {insight.recommendation}
              </p>
              {Array.isArray(insight.evidence) && insight.evidence.length > 0 ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-slate-400">Evidence</summary>
                  <ul className="mt-1 space-y-1 text-xs text-slate-500">
                    {(insight.evidence as { model?: string; id?: string; note?: string }[]).map((e, i) => (
                      <li key={i}>
                        {e.model ? `${e.model} — ` : ""}
                        {e.note ?? e.id}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {canManage && insight.status === "OPEN" ? (
                <div className="mt-3 flex gap-2">
                  <form action={acceptInsightAction}>
                    <input type="hidden" name="id" value={insight.id} />
                    <button className="btn-secondary text-xs" type="submit">
                      Accept
                    </button>
                  </form>
                  <form action={dismissInsightAction}>
                    <input type="hidden" name="id" value={insight.id} />
                    <button className="text-xs font-medium text-slate-400 hover:underline" type="submit">
                      Dismiss
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
