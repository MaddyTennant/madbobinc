import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/tenant";
import { toApiErrorResponse } from "@/lib/api-error";
import { createApiKey } from "@/lib/apikeys";

const createSchema = z.object({
  label: z.string().min(1).max(100),
  scopes: z.array(z.enum(["read", "embed"])).min(1),
});

export async function GET() {
  try {
    const session = await requireAction("apikeys:manage");
    const keys = await db.apiKey.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: { createdAt: "desc" },
      select: { id: true, label: true, keyPrefix: true, scopes: true, createdAt: true, lastUsedAt: true, revokedAt: true },
    });
    return NextResponse.json({ keys });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAction("apikeys:manage");
    const { label, scopes } = createSchema.parse(await req.json());
    const created = await createApiKey(session.workspaceId, label, scopes);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
