import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/tenant";
import { toApiErrorResponse } from "@/lib/api-error";
import { answerQuery } from "@/lib/llm/query-agent";

const schema = z.object({ question: z.string().min(1).max(2000) });

export async function POST(req: NextRequest) {
  try {
    const session = await requireAction("query:use");
    const { question } = schema.parse(await req.json());

    const result = await answerQuery(session.workspaceId, question);
    const saved = await db.queryHistory.create({
      data: {
        workspaceId: session.workspaceId,
        question,
        answer: result.answer,
        toolCalls: JSON.parse(JSON.stringify(result.toolCalls)),
        askedById: session.userId,
      },
    });

    return NextResponse.json({ id: saved.id, answer: result.answer, toolCalls: result.toolCalls, mode: result.mode });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
