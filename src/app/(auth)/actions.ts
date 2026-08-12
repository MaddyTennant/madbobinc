"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";

export async function signupAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const name = String(formData.get("name") || "").trim();

  if (!email || !password || !name) {
    redirect(`/signup?error=${encodeURIComponent("All fields are required.")}`);
  }
  if (password.length < 8) {
    redirect(`/signup?error=${encodeURIComponent("Password must be at least 8 characters.")}`);
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    redirect(`/signup?error=${encodeURIComponent("An account with that email already exists.")}`);
  }

  const user = await db.user.create({
    data: { email, name, passwordHash: await hashPassword(password) },
  });

  await createSession({ userId: user.id, email: user.email, name: user.name, workspaceId: "", role: "OWNER" });
  redirect("/workspace/new");
}

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    redirect(`/login?error=${encodeURIComponent("Invalid email or password.")}`);
  }

  const membership = await db.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    workspaceId: membership?.workspaceId ?? "",
    role: membership?.role ?? "OWNER",
  });

  redirect(membership ? "/query" : "/workspace/new");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
