"use server";

import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { requireAction } from "@/lib/tenant";
import { signInviteToken } from "@/lib/auth";

const VALID_ROLES: Role[] = ["OWNER", "FINANCE_MANAGER", "KITCHEN_MANAGER", "VIEWER"];

export async function createInviteAction(formData: FormData): Promise<void> {
  const session = await requireAction("team:manage");

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "") as Role;

  if (!email || !VALID_ROLES.includes(role)) {
    redirect(`/settings/team?error=${encodeURIComponent("A valid email and role are required.")}`);
  }

  const token = await signInviteToken({ email, workspaceId: session.workspaceId, role });
  redirect(`/settings/team?invite=${encodeURIComponent(token)}`);
}
