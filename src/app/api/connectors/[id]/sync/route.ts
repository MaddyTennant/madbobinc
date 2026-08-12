import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/tenant";
import { toApiErrorResponse } from "@/lib/api-error";
import { runMockSync, toPublicConnector } from "@/lib/connectors";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAction("integrations:manage");
    const { id } = await params;

    const connector = await db.connector.findFirst({ where: { id, workspaceId: session.workspaceId } });
    if (!connector) return NextResponse.json({ error: "Connector not found" }, { status: 404 });

    const updated = await runMockSync(connector.id);
    return NextResponse.json({ connector: toPublicConnector(updated) });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
