"use server";

import { redirect } from "next/navigation";
import type { Vertical } from "@prisma/client";
import { db } from "@/lib/db";
import { createSession, requireValidSession } from "@/lib/auth";
import { defaultCategoryCreateInputs } from "@/lib/categorize";
import { techOnlyMode } from "@/lib/flags";

const VERTICALS: Vertical[] = ["HOSPITALITY", "HEALTHCARE", "TECH"];

export async function createWorkspaceAction(formData: FormData): Promise<void> {
  const session = await requireValidSession();

  const name = String(formData.get("name") || "").trim();
  const location = String(formData.get("location") || "").trim();
  const currency = String(formData.get("currency") || "USD").trim();
  const fiscalMonthStart = Number(formData.get("fiscalMonthStart") || 1);
  const verticalInput = String(formData.get("vertical") || "HOSPITALITY");
  // In Tech-only mode there's no selector to bypass, but enforce it server-side too.
  const vertical = techOnlyMode()
    ? "TECH"
    : VERTICALS.includes(verticalInput as Vertical)
      ? (verticalInput as Vertical)
      : "HOSPITALITY";

  if (!name || !location) {
    redirect(`/workspace/new?error=${encodeURIComponent("Name and location are required.")}`);
  }

  // The workspace's first site is created automatically from the same name/location —
  // this is what keeps a single-location workspace (e.g. "Ruth's") working exactly as
  // before multi-site support existed. Additional sites are added later from Settings.
  const workspace = await db.workspace.create({
    data: {
      name,
      location,
      currency: currency || "USD",
      fiscalMonthStart: Number.isFinite(fiscalMonthStart) ? fiscalMonthStart : 1,
      vertical,
      memberships: { create: { userId: session.userId, role: "OWNER" } },
      categories: { create: defaultCategoryCreateInputs(vertical) },
      sites: { create: { name, location, isDefault: true } },
    },
  });

  await createSession({ ...session, workspaceId: workspace.id, role: "OWNER" });
  redirect("/query");
}
