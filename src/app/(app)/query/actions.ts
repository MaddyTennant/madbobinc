"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/tenant";
import { answerQuery, type ConversationTurn } from "@/lib/llm/query-agent";

function titleFromQuestion(question: string): string {
  return question.length > 80 ? `${question.slice(0, 80)}…` : question;
}

export async function askQuestionAction(formData: FormData): Promise<void> {
  const session = await requireAction("query:use");
  const question = String(formData.get("question") || "").trim();
  const conversationId = String(formData.get("conversationId") || "");
  if (!question) redirect(conversationId ? `/query/${conversationId}` : "/query");

  let conversation = conversationId
    ? await db.conversation.findFirst({ where: { id: conversationId, workspaceId: session.workspaceId } })
    : null;

  let priorTurns: ConversationTurn[] = [];
  if (conversation) {
    const turns = await db.queryHistory.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      select: { question: true, answer: true },
    });
    priorTurns = turns;
  } else {
    conversation = await db.conversation.create({
      data: { workspaceId: session.workspaceId, title: titleFromQuestion(question) },
    });
  }

  const result = await answerQuery(session.workspaceId, question, priorTurns);

  await db.queryHistory.create({
    data: {
      workspaceId: session.workspaceId,
      conversationId: conversation.id,
      question,
      answer: result.answer,
      toolCalls: JSON.parse(JSON.stringify(result.toolCalls)),
      askedById: session.userId,
    },
  });
  await db.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });

  revalidatePath("/query", "layout");
  redirect(`/query/${conversation.id}`);
}

export async function rerunQueryAction(formData: FormData): Promise<void> {
  const session = await requireAction("query:use");
  const id = String(formData.get("id") || "");
  const original = await db.queryHistory.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (!original) redirect("/query");

  const priorTurns = await db.queryHistory.findMany({
    where: { conversationId: original!.conversationId, createdAt: { lt: original!.createdAt } },
    orderBy: { createdAt: "asc" },
    select: { question: true, answer: true },
  });

  const result = await answerQuery(session.workspaceId, original!.question, priorTurns);
  await db.queryHistory.create({
    data: {
      workspaceId: session.workspaceId,
      conversationId: original!.conversationId,
      question: original!.question,
      answer: result.answer,
      toolCalls: JSON.parse(JSON.stringify(result.toolCalls)),
      askedById: session.userId,
    },
  });
  revalidatePath("/query", "layout");
  redirect(`/query/${original!.conversationId}`);
}

export async function togglePinAction(formData: FormData): Promise<void> {
  const session = await requireAction("query:use");
  const id = String(formData.get("id") || "");
  const entry = await db.queryHistory.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (entry) await db.queryHistory.update({ where: { id }, data: { pinned: !entry.pinned } });
  revalidatePath("/query", "layout");
}

export async function deleteConversationAction(formData: FormData): Promise<void> {
  const session = await requireAction("query:use");
  const id = String(formData.get("id") || "");
  const currentPath = String(formData.get("currentPath") || "");

  const conversation = await db.conversation.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (conversation) {
    await db.$transaction([
      db.queryHistory.deleteMany({ where: { conversationId: id } }),
      db.conversation.delete({ where: { id } }),
    ]);
  }

  revalidatePath("/query", "layout");
  if (currentPath === `/query/${id}`) redirect("/query");
}
