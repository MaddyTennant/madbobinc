"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/tenant";

function currentMonthStart(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export async function setBudgetAction(formData: FormData): Promise<void> {
  const session = await requireAction("budgets:manage");
  const categoryId = String(formData.get("categoryId") || "");
  const amount = Number(formData.get("amount"));
  if (!categoryId || !Number.isFinite(amount) || amount < 0) redirect("/budgets");

  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: session.workspaceId } });
  const category = await db.category.findFirst({ where: { id: categoryId, workspaceId: session.workspaceId } });
  if (!category) redirect("/budgets");

  await db.budget.upsert({
    where: { workspaceId_categoryId_location_month: { workspaceId: session.workspaceId, categoryId, location: workspace.location, month: currentMonthStart() } },
    update: { amount },
    create: { workspaceId: session.workspaceId, categoryId, location: workspace.location, month: currentMonthStart(), amount },
  });
  revalidatePath("/budgets");
}

export async function setApprovalThresholdAction(formData: FormData): Promise<void> {
  const session = await requireAction("budgets:manage");
  const amount = Number(formData.get("approvalThreshold"));
  if (!Number.isFinite(amount) || amount < 0) redirect("/budgets");

  await db.workspace.update({ where: { id: session.workspaceId }, data: { approvalThreshold: amount } });
  revalidatePath("/budgets");
}

export async function submitApprovalRequestAction(formData: FormData): Promise<void> {
  const session = await requireAction("approvals:request");
  const description = String(formData.get("description") || "").trim();
  const amount = Number(formData.get("amount"));
  if (!description || !Number.isFinite(amount) || amount <= 0) redirect("/budgets");

  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: session.workspaceId } });
  const needsApproval = amount > workspace.approvalThreshold;

  await db.approvalRequest.create({
    data: {
      workspaceId: session.workspaceId,
      description,
      amount,
      status: needsApproval ? "PENDING" : "APPROVED",
      requestedById: session.userId,
      approverId: needsApproval ? null : session.userId,
      decidedAt: needsApproval ? null : new Date(),
    },
  });
  revalidatePath("/budgets");
}

export async function decideApprovalAction(formData: FormData): Promise<void> {
  const session = await requireAction("approvals:decide");
  const id = String(formData.get("id") || "");
  const decision = String(formData.get("decision") || "");
  if (decision !== "APPROVED" && decision !== "REJECTED") redirect("/budgets");

  await db.approvalRequest.updateMany({
    where: { id, workspaceId: session.workspaceId, status: "PENDING" },
    data: { status: decision, approverId: session.userId, decidedAt: new Date() },
  });
  revalidatePath("/budgets");
}

const RENEWAL_TYPES = ["INSURANCE", "LICENSE", "SUBSCRIPTION"] as const;

export async function createRenewalAction(formData: FormData): Promise<void> {
  const session = await requireAction("budgets:manage");
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const type = String(formData.get("type") || "");
  const amount = Number(formData.get("amount"));
  const renewalDate = new Date(String(formData.get("renewalDate") || ""));
  const cadenceMonths = Number(formData.get("cadenceMonths"));
  if (!name || !RENEWAL_TYPES.includes(type as (typeof RENEWAL_TYPES)[number]) || !Number.isFinite(amount) || amount < 0 || Number.isNaN(renewalDate.getTime())) {
    redirect("/budgets");
  }

  await db.renewal.create({
    data: {
      workspaceId: session.workspaceId,
      name,
      description: description || null,
      type: type as (typeof RENEWAL_TYPES)[number],
      amount,
      renewalDate,
      cadenceMonths: Number.isFinite(cadenceMonths) && cadenceMonths > 0 ? cadenceMonths : null,
    },
  });
  revalidatePath("/budgets");
}

export async function renewRenewalAction(formData: FormData): Promise<void> {
  const session = await requireAction("approvals:decide");
  const id = String(formData.get("id") || "");
  const renewal = await db.renewal.findFirst({ where: { id, workspaceId: session.workspaceId, status: "ACTIVE" } });
  if (!renewal) redirect("/budgets");

  const nextDate = renewal!.cadenceMonths
    ? new Date(Date.UTC(renewal!.renewalDate.getUTCFullYear(), renewal!.renewalDate.getUTCMonth() + renewal!.cadenceMonths, renewal!.renewalDate.getUTCDate()))
    : renewal!.renewalDate;

  await db.renewal.update({
    where: { id },
    data: {
      renewalDate: nextDate,
      renewedAt: new Date(),
      status: renewal!.cadenceMonths ? "ACTIVE" : "CANCELLED",
    },
  });
  revalidatePath("/budgets");
}

export async function cancelRenewalAction(formData: FormData): Promise<void> {
  const session = await requireAction("approvals:decide");
  const id = String(formData.get("id") || "");
  await db.renewal.updateMany({
    where: { id, workspaceId: session.workspaceId, status: "ACTIVE" },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/budgets");
}
