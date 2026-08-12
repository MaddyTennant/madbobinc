import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/apikeys";
import { toApiErrorResponse } from "@/lib/api-error";
import { getDashboardSummary } from "@/lib/analytics/aggregate";

// GET /api/v1/summary
// Auth: header `X-API-Key: <key>` (or `Authorization: Bearer <key>`) with the "read" scope.
export async function GET(req: NextRequest) {
  try {
    const key = await requireApiKey(req, "read");
    const summary = await getDashboardSummary(key.workspaceId);
    return NextResponse.json({ summary });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
