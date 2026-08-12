"use server";

import { revalidatePath } from "next/cache";
import { requireAction } from "@/lib/tenant";
import { db } from "@/lib/db";
import { generateNegotiationBrief } from "@/lib/llm/vendor-brief";

export async function generateBriefAction(formData: FormData): Promise<void> {
  // Generating a brief calls the LLM and overwrites the shared brief, so it's
  // gated behind budgets:manage (owner/finance) even though viewing vendors is open to all roles.
  const session = await requireAction("budgets:manage");
  const vendorId = String(formData.get("vendorId") || "");
  const vendor = await db.vendor.findFirst({ where: { id: vendorId, workspaceId: session.workspaceId } });
  if (vendor) await generateNegotiationBrief(session.workspaceId, vendorId);
  revalidatePath(`/vendors/${vendorId}`);
}
