"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/tenant";
import { generateInsights } from "@/lib/llm/oversight";

export async function runAnalysisAction(): Promise<void> {
  const session = await requireAction("insights:manage");
  await generateInsights(session.workspaceId);
  revalidatePath("/insights");
}

export async function acceptInsightAction(formData: FormData): Promise<void> {
  const session = await requireAction("insights:manage");
  const id = String(formData.get("id") || "");
  await db.insight.updateMany({ where: { id, workspaceId: session.workspaceId }, data: { status: "ACCEPTED" } });
  revalidatePath("/insights");
}

export async function dismissInsightAction(formData: FormData): Promise<void> {
  const session = await requireAction("insights:manage");
  const id = String(formData.get("id") || "");
  await db.insight.updateMany({ where: { id, workspaceId: session.workspaceId }, data: { status: "DISMISSED" } });
  revalidatePath("/insights");
}
