import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/tenant";
import { toApiErrorResponse } from "@/lib/api-error";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAction("apikeys:manage");
    const { id } = await params;
    await db.apiKey.updateMany({
      where: { id, workspaceId: session.workspaceId },
      data: { revokedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
