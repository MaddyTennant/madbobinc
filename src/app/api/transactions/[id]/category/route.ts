import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/tenant";
import { toApiErrorResponse } from "@/lib/api-error";

const schema = z.object({ categoryKey: z.string().min(1) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAction("transactions:manage");
    const { id } = await params;
    const { categoryKey } = schema.parse(await req.json());

    const transaction = await db.transaction.findFirst({ where: { id, workspaceId: session.workspaceId } });
    if (!transaction) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    const category = await db.category.findFirst({ where: { workspaceId: session.workspaceId, key: categoryKey } });
    if (!category) return NextResponse.json({ error: "Unknown category" }, { status: 400 });

    const updated = await db.transaction.update({
      where: { id },
      data: { categoryId: category.id, categoryConfidence: 1, categorizedBy: "manual" },
    });
    return NextResponse.json({ transaction: updated });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
