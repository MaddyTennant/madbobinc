import "server-only";
import { db } from "@/lib/db";
import { getDashboardSummary, type DashboardSummary } from "@/lib/analytics/aggregate";
import { callClaudeForText, isLlmConfigured, OVERSIGHT_MODEL } from "@/lib/llm/client";
import { formatCurrency, formatPercent } from "@/lib/format";

export interface MonthlyReport {
  periodLabel: string;
  summary: DashboardSummary;
  narrative: string;
  topActions: { title: string; recommendation: string; estimatedImpact: number }[];
  generatedBy: "llm" | "mock";
}

function mockNarrative(summary: DashboardSummary): string {
  const topCategory = summary.byCategory[0];
  const topVendor = summary.byVendor[0];
  return [
    `${summary.periodLabel} spend summary.`,
    `Total spend month-to-date is ${formatCurrency(summary.totalSpendMTD, summary.currency)}, against ${formatCurrency(summary.revenueMTD, summary.currency)} in revenue so far.`,
    `${summary.primaryRatio.label} is running at ${formatPercent(summary.primaryRatio.value)} and ${summary.secondaryRatio.label} at ${formatPercent(summary.secondaryRatio.value)} (trailing 30 days).`,
    topCategory ? `The largest spend category is ${topCategory.label} at ${formatCurrency(topCategory.amount, summary.currency)}.` : "",
    topVendor ? `The largest vendor by spend is ${topVendor.name} at ${formatCurrency(topVendor.amount, summary.currency)}.` : "",
    `At the current daily burn rate of ${formatCurrency(summary.dailyBurnRate, summary.currency)}/day, projected 30-day cash-out is ${formatCurrency(summary.cashOutForecast30d, summary.currency)}.`,
    "(Generated in mock mode — set ANTHROPIC_API_KEY for a fully written AI narrative.)",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function generateMonthlyReport(workspaceId: string): Promise<MonthlyReport> {
  const summary = await getDashboardSummary(workspaceId);
  const openInsights = await db.insight.findMany({
    where: { workspaceId, status: "OPEN" },
    orderBy: [{ severity: "desc" }, { estimatedImpact: "desc" }],
    take: 5,
  });

  const topActions = openInsights.map((i) => ({ title: i.title, recommendation: i.recommendation, estimatedImpact: i.estimatedImpact }));

  let narrative: string;
  let generatedBy: "llm" | "mock" = "mock";
  if (isLlmConfigured()) {
    const prompt = `Write a short monthly spend summary for a restaurant owner, using ONLY the numbers below —
never invent figures. 3-4 short paragraphs: (1) headline spend/revenue/margin numbers, (2) what drove spend
this month (top categories/vendors), (3) notable risks or overruns, (4) a brief forward-looking note.

Dashboard summary:
${JSON.stringify(summary, null, 2)}

Top open AI insights this period:
${JSON.stringify(topActions, null, 2)}`;

    const text = await callClaudeForText({
      model: OVERSIGHT_MODEL,
      system: "You are a financial controller writing a concise, plain-English monthly summary for a busy restaurant owner.",
      prompt,
      maxTokens: 800,
    });
    if (text) {
      narrative = text;
      generatedBy = "llm";
    } else {
      narrative = mockNarrative(summary);
    }
  } else {
    narrative = mockNarrative(summary);
  }

  return { periodLabel: summary.periodLabel, summary, narrative, topActions, generatedBy };
}
