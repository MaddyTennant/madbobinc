"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, requireValidSession } from "@/lib/auth";
import { defaultCategoryCreateInputs } from "@/lib/categorize";

export async function createWorkspaceAction(formData: FormData): Promise<void> {
  const session = await requireValidSession();

  const name = String(formData.get("name") || "").trim();
  const location = String(formData.get("location") || "").trim();
  const currency = String(formData.get("currency") || "USD").trim();
  const fiscalMonthStart = Number(formData.get("fiscalMonthStart") || 1);

  if (!name || !location) {
    redirect(`/workspace/new?error=${encodeURIComponent("Name and location are required.")}`);
  }

  const workspace = await db.workspace.create({
    data: {
      name,
      location,
      currency: currency || "USD",
      fiscalMonthStart: Number.isFinite(fiscalMonthStart) ? fiscalMonthStart : 1,
      memberships: { create: { userId: session.userId, role: "OWNER" } },
      categories: { create: defaultCategoryCreateInputs() },
    },
  });

  await createSession({ ...session, workspaceId: workspace.id, role: "OWNER" });
  redirect("/query");
}
