import { NextResponse } from "next/server";
import { requireAction } from "@/lib/tenant";
import { toApiErrorResponse } from "@/lib/api-error";
import { QUERY_TOOLS } from "@/lib/llm/query-tools";

export async function GET() {
  try {
    const session = await requireAction("query:use");
    const priceTool = QUERY_TOOLS.find((t) => t.name === "get_vendor_price_trend")!;
    const budgetTool = QUERY_TOOLS.find((t) => t.name === "get_budget_vs_actual")!;
    const r1 = await priceTool.execute(session.workspaceId, { vendorName: "North Sea" });
    const r2 = await budgetTool.execute(session.workspaceId, {});
    return NextResponse.json({ r1, r2 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
