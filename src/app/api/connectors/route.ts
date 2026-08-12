import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { ConnectorType } from "@prisma/client";
import { requireAction } from "@/lib/tenant";
import { toApiErrorResponse } from "@/lib/api-error";
import { connectMockConnector, PROVIDER_CATALOG, toPublicConnector } from "@/lib/connectors";

const connectSchema = z.object({
  type: z.enum(["POS", "ACCOUNTING", "SUPPLIER", "BANK", "PAYROLL", "DELIVERY"]),
  provider: z.string().min(1),
  credentials: z.record(z.string(), z.string()).default({}),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAction("integrations:manage");
    const body = connectSchema.parse(await req.json());

    const type = body.type as ConnectorType;
    const known = PROVIDER_CATALOG[type].some((p) => p.provider === body.provider);
    if (!known) return NextResponse.json({ error: "Unknown provider for this connector type" }, { status: 400 });

    const connector = await connectMockConnector(session.workspaceId, type, body.provider, body.credentials);
    return NextResponse.json({ connector: toPublicConnector(connector) });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
