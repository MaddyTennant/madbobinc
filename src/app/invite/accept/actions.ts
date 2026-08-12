"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, hashPassword, verifyInviteToken, verifyPassword } from "@/lib/auth";

export async function acceptInviteAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") || "");
  const invite = await verifyInviteToken(token);
  if (!invite) {
    redirect(`/invite/accept?error=${encodeURIComponent("This invite link is invalid or has expired.")}`);
  }

  const workspace = await db.workspace.findUnique({ where: { id: invite!.workspaceId } });
  if (!workspace) {
    redirect(`/invite/accept?error=${encodeURIComponent("This workspace no longer exists.")}`);
  }

  let user = await db.user.findUnique({ where: { email: invite!.email } });

  if (user) {
    const password = String(formData.get("password") || "");
    if (!password || !(await verifyPassword(password, user.passwordHash))) {
      redirect(
        `/invite/accept?token=${encodeURIComponent(token)}&error=${encodeURIComponent(
          "An account already exists for this email. Enter your existing password to join.",
        )}`,
      );
    }
  } else {
    const name = String(formData.get("name") || "").trim();
    const password = String(formData.get("password") || "");
    if (!name || password.length < 8) {
      redirect(
        `/invite/accept?token=${encodeURIComponent(token)}&error=${encodeURIComponent(
          "Name is required and password must be at least 8 characters.",
        )}`,
      );
    }
    user = await db.user.create({
      data: { email: invite!.email, name, passwordHash: await hashPassword(password) },
    });
  }

  await db.membership.upsert({
    where: { userId_workspaceId: { userId: user!.id, workspaceId: invite!.workspaceId } },
    update: { role: invite!.role },
    create: { userId: user!.id, workspaceId: invite!.workspaceId, role: invite!.role },
  });

  await createSession({
    userId: user!.id,
    email: user!.email,
    name: user!.name,
    workspaceId: invite!.workspaceId,
    role: invite!.role,
  });

  redirect("/query");
}
