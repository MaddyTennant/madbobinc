"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Vertical } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/tenant";
import { techOnlyMode } from "@/lib/flags";

const VERTICALS: Vertical[] = ["HOSPITALITY", "HEALTHCARE", "TECH"];

export async function addSiteAction(formData: FormData): Promise<void> {
  const session = await requireAction("workspace:manage");

  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: session.workspaceId } });
  if (workspace.vertical === "TECH") {
    redirect(`/settings/workspace?error=${encodeURIComponent("Additional sites aren't available for Tech yet.")}`);
  }

  const name = String(formData.get("name") || "").trim();
  const location = String(formData.get("location") || "").trim();
  if (!name || !location) {
    redirect(`/settings/workspace?error=${encodeURIComponent("Site name and location are required.")}`);
  }

  const existing = await db.site.findUnique({ where: { workspaceId_name: { workspaceId: session.workspaceId, name } } });
  if (existing) {
    redirect(`/settings/workspace?error=${encodeURIComponent("A site with that name already exists.")}`);
  }

  // Placeholder site: no connectors or spend data are tied to it yet — that scoping
  // (Connector/Transaction/Vendor/Budget siteId) is a separate migration not yet done.
  await db.site.create({
    data: { workspaceId: session.workspaceId, name, location, isDefault: false },
  });

  revalidatePath("/settings/workspace");
}

export async function setVerticalAction(formData: FormData): Promise<void> {
  const session = await requireAction("workspace:manage");

  if (techOnlyMode()) {
    redirect(`/settings/workspace?error=${encodeURIComponent("Vertical is locked to Tech for this demo.")}`);
  }

  const verticalInput = String(formData.get("vertical") || "");
  if (!VERTICALS.includes(verticalInput as Vertical)) {
    redirect(`/settings/workspace?error=${encodeURIComponent("Invalid vertical.")}`);
  }

  await db.workspace.update({
    where: { id: session.workspaceId },
    data: { vertical: verticalInput as Vertical },
  });

  revalidatePath("/settings/workspace");
}
