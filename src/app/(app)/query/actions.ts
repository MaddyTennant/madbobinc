"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/tenant";
import { answerQuery } from "@/lib/llm/query-agent";

export async function askQuestionAction(formData: FormData): Promise<void> {
  const session = await requireAction("query:use");
  const question = String(formData.get("question") || "").trim();
  if (!question) redirect("/query");

  const result = await answerQuery(session.workspaceId, question);

  await db.queryHistory.create({
    data: {
      workspaceId: session.workspaceId,
      question,
      answer: result.answer,
      toolCalls: JSON.parse(JSON.stringify(result.toolCalls)),
      askedById: session.userId,
    },
  });
  revalidatePath("/query");
  redirect("/query");
}

export async function rerunQueryAction(formData: FormData): Promise<void> {
  const session = await requireAction("query:use");
  const id = String(formData.get("id") || "");
  const original = await db.queryHistory.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (!original) redirect("/query");

  const result = await answerQuery(session.workspaceId, original!.question);
  await db.queryHistory.create({
    data: {
      workspaceId: session.workspaceId,
      question: original!.question,
      answer: result.answer,
      toolCalls: JSON.parse(JSON.stringify(result.toolCalls)),
      askedById: session.userId,
    },
  });
  revalidatePath("/query");
  redirect("/query");
}

export async function togglePinAction(formData: FormData): Promise<void> {
  const session = await requireAction("query:use");
  const id = String(formData.get("id") || "");
  const entry = await db.queryHistory.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (entry) await db.queryHistory.update({ where: { id }, data: { pinned: !entry.pinned } });
  revalidatePath("/query");
}
