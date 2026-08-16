import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { categorizeByText } from "@/lib/categorize";

// Public, unauthenticated endpoint: the unguessable `token` path segment *is*
// the tenant-scoped credential, matching how most webhook providers work
// (e.g. Stripe/GitHub webhook URLs). No further auth header is required.
const webhookSchema = z.object({
  vendor: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  amount: z.number().finite(),
  date: z.string().datetime().optional(),
  category: z.string().max(50).optional(),
  costCenter: z.string().max(50).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const endpoint = await db.webhookEndpoint.findUnique({ where: { token } });
  if (!endpoint) return NextResponse.json({ error: "Unknown webhook endpoint" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON" }, { status: 400 });
  }

  const parsed = webhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: endpoint.workspaceId } });
  const categories = await db.category.findMany({ where: { workspaceId: endpoint.workspaceId } });
  const requestedCategory = data.category ? categories.find((c) => c.key === data.category) : undefined;
  const auto = categorizeByText(data.description ?? data.vendor, workspace.vertical);
  const category = requestedCategory ?? categories.find((c) => c.key === auto.categoryKey);

  const vendor = await db.vendor.upsert({
    where: { workspaceId_name: { workspaceId: endpoint.workspaceId, name: data.vendor } },
    update: {},
    create: { workspaceId: endpoint.workspaceId, name: data.vendor },
  });

  const transaction = await db.transaction.create({
    data: {
      workspaceId: endpoint.workspaceId,
      vendorId: vendor.id,
      categoryId: category?.id,
      date: data.date ? new Date(data.date) : new Date(),
      description: data.description ?? data.vendor,
      amount: data.amount,
      source: "webhook",
      costCenter: data.costCenter,
      categoryConfidence: requestedCategory ? 1 : auto.confidence,
      categorizedBy: requestedCategory ? "manual" : "rule",
    },
  });

  await db.webhookEndpoint.update({
    where: { id: endpoint.id },
    data: { eventCount: { increment: 1 }, lastEventAt: new Date() },
  });

  return NextResponse.json({ transaction }, { status: 201 });
}
