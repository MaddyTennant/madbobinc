import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/apikeys";
import { toApiErrorResponse } from "@/lib/api-error";
import { db } from "@/lib/db";

// GET /api/v1/insights
// Auth: header `X-API-Key: <key>` (or `Authorization: Bearer <key>`) with the "read" scope.
export async function GET(req: NextRequest) {
  try {
    const key = await requireApiKey(req, "read");
    const insights = await db.insight.findMany({
      where: { workspaceId: key.workspaceId, status: "OPEN" },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ insights });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
