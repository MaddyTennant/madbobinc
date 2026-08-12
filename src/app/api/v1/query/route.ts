import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiKey } from "@/lib/apikeys";
import { toApiErrorResponse } from "@/lib/api-error";
import { answerQuery } from "@/lib/llm/query-agent";

const schema = z.object({ question: z.string().min(1).max(2000) });

// POST /api/v1/query { "question": "..." }
// Auth: header `X-API-Key: <key>` (or `Authorization: Bearer <key>`) with the "read" scope.
export async function POST(req: NextRequest) {
  try {
    const key = await requireApiKey(req, "read");
    const { question } = schema.parse(await req.json());
    const result = await answerQuery(key.workspaceId, question);
    return NextResponse.json({ answer: result.answer, toolCalls: result.toolCalls, mode: result.mode });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
