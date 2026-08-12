import { NextResponse } from "next/server";
import { requireAction } from "@/lib/tenant";
import { toApiErrorResponse } from "@/lib/api-error";
import { generateInsights } from "@/lib/llm/oversight";

// Hook point for a real scheduler (Vercel Cron, an external cron hitting this
// with a service API key, etc.) — this thin slice triggers it from the UI's
// "Run analysis now" button instead of on a timer.
export async function POST() {
  try {
    const session = await requireAction("insights:manage");
    const insights = await generateInsights(session.workspaceId);
    return NextResponse.json({ insights });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
