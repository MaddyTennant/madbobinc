import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveApiKey, requireScope } from "@/lib/apikeys";
import { answerQuery } from "@/lib/llm/query-agent";

const schema = z.object({ question: z.string().min(1).max(2000) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const key = await resolveApiKey(token);
  if (!key || !requireScope(key, "embed")) {
    return NextResponse.json({ error: "Invalid or revoked embed link" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A question is required" }, { status: 400 });

  const result = await answerQuery(key.workspaceId, parsed.data.question);
  return NextResponse.json({ answer: result.answer });
}
