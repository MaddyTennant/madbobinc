import "server-only";
import { z } from "zod";
import type { Vertical } from "@prisma/client";
import { db } from "@/lib/db";
import { gatherEvidence, type EvidenceItem } from "@/lib/llm/evidence";
import { callClaudeForJson, isLlmConfigured, OVERSIGHT_MODEL } from "@/lib/llm/client";

const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const InsightCandidateSchema = z.object({
  type: z.enum(["duplicate_invoice", "price_creep", "vendor_spike", "budget_overrun", "subscription_waste", "off_contract"]),
  title: z.string(),
  summary: z.string(),
  severity: z.enum(SEVERITIES),
  estimatedImpact: z.number(),
  evidenceIds: z.array(z.string()),
  recommendation: z.string(),
});
const InsightsResponseSchema = z.object({ insights: z.array(InsightCandidateSchema).max(8) });
type InsightCandidate = z.infer<typeof InsightCandidateSchema>;

const INSIGHTS_JSON_SCHEMA = {
  type: "object",
  properties: {
    insights: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["duplicate_invoice", "price_creep", "vendor_spike", "budget_overrun", "subscription_waste", "off_contract"],
          },
          title: { type: "string", description: "Short, specific headline naming the vendor/category involved." },
          summary: { type: "string", description: "1-2 sentence explanation a restaurant manager can act on." },
          severity: { type: "string", enum: SEVERITIES },
          estimatedImpact: { type: "number", description: "Dollar impact. Must come directly from the evidence provided — never invented." },
          evidenceIds: { type: "array", items: { type: "string" }, description: "IDs of the evidence items this insight is based on." },
          recommendation: { type: "string", description: "One concrete recommended action the manager can accept or dismiss." },
        },
        required: ["type", "title", "summary", "severity", "estimatedImpact", "evidenceIds", "recommendation"],
      },
    },
  },
  required: ["insights"],
};

function severityFromImpact(impact: number): (typeof SEVERITIES)[number] {
  if (impact >= 1000) return "CRITICAL";
  if (impact >= 400) return "HIGH";
  if (impact >= 100) return "MEDIUM";
  return "LOW";
}

const RECOMMENDATION_TEMPLATES: Record<EvidenceItem["type"], (e: EvidenceItem) => string> = {
  duplicate_invoice: () => "Contact the vendor to confirm and request a credit for the duplicate charge.",
  price_creep: () => "Ask the vendor to justify the increase, or get a comparison quote from another supplier.",
  vendor_spike: () => "Review this month's orders with the vendor to confirm they're all legitimate.",
  budget_overrun: () => "Reduce discretionary purchases in this category for the rest of the month.",
  subscription_waste: () => "Confirm whether all of these subscriptions are still in active use; cancel any redundant one.",
};

function mockInsightsFromEvidence(evidence: EvidenceItem[]): InsightCandidate[] {
  return evidence.slice(0, 8).map((e) => ({
    type: e.type,
    title: e.headline,
    summary: e.detail,
    severity: severityFromImpact(e.dollarImpact),
    estimatedImpact: Math.round(e.dollarImpact * 100) / 100,
    evidenceIds: [e.id],
    recommendation: RECOMMENDATION_TEMPLATES[e.type](e),
  }));
}

async function llmInsightsFromEvidence(evidence: EvidenceItem[], vertical: Vertical): Promise<InsightCandidate[] | null> {
  const isTech = vertical === "TECH";
  const subject = isTech ? "a technology company" : "a restaurant";
  const subjectPossessive = isTech ? "the company's" : "the restaurant's";

  const prompt = `You are reviewing spend evidence for ${subject}. Each item below was computed by
plain code from ${subjectPossessive} real transaction data — treat the numbers as ground truth, do not
recompute or invent different dollar figures. Your job is judgment and communication: decide which
items are genuinely worth flagging to the owner, merge related items into one insight where it makes
sense, assign a severity, and write a short, specific title/summary/recommendation for each.

Evidence:
${JSON.stringify(evidence, null, 2)}

Return at most 8 insights, most important first. Every evidenceIds entry must reference an "id" from
the evidence above.`;

  const result = await callClaudeForJson({
    model: OVERSIGHT_MODEL,
    system: isTech
      ? "You are an expert technology company financial controller. You are precise, conservative with dollar figures, and never invent numbers that weren't given to you."
      : "You are an expert restaurant financial controller. You are precise, conservative with dollar figures, and never invent numbers that weren't given to you.",
    prompt,
    schema: InsightsResponseSchema,
    jsonSchema: INSIGHTS_JSON_SCHEMA,
    maxTokens: 3072,
  });

  return result?.insights ?? null;
}

export interface GeneratedInsight {
  id: string;
  type: string;
  title: string;
  summary: string;
  severity: (typeof SEVERITIES)[number];
  estimatedImpact: number;
  recommendation: string;
  generatedBy: string;
}

export async function generateInsights(workspaceId: string): Promise<GeneratedInsight[]> {
  const evidence = await gatherEvidence(workspaceId);
  if (evidence.length === 0) return [];

  const evidenceById = new Map(evidence.map((e) => [e.id, e]));
  const usingLlm = isLlmConfigured();
  let candidates: InsightCandidate[];
  if (usingLlm) {
    const workspace = await db.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { vertical: true } });
    candidates = (await llmInsightsFromEvidence(evidence, workspace.vertical)) ?? mockInsightsFromEvidence(evidence);
  } else {
    candidates = mockInsightsFromEvidence(evidence);
  }
  const generatedBy = usingLlm ? "llm" : "mock";

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const created: GeneratedInsight[] = [];

  for (const c of candidates) {
    const duplicate = await db.insight.findFirst({
      where: { workspaceId, type: c.type, title: c.title, status: "OPEN", createdAt: { gte: cutoff } },
    });
    if (duplicate) continue;

    const evidenceRows = c.evidenceIds
      .map((id) => evidenceById.get(id))
      .filter((e): e is EvidenceItem => Boolean(e))
      .flatMap((e) => e.refs);

    const insight = await db.insight.create({
      data: {
        workspaceId,
        type: c.type,
        title: c.title,
        summary: c.summary,
        severity: c.severity,
        estimatedImpact: c.estimatedImpact,
        evidence: evidenceRows.length > 0 ? evidenceRows : c.evidenceIds.map((id) => ({ note: id })),
        recommendation: c.recommendation,
        generatedBy,
      },
    });
    created.push({
      id: insight.id,
      type: insight.type,
      title: insight.title,
      summary: insight.summary,
      severity: insight.severity,
      estimatedImpact: insight.estimatedImpact,
      recommendation: insight.recommendation,
      generatedBy: insight.generatedBy,
    });
  }

  return created;
}
