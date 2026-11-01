"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ConnectorType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/tenant";
import {
  connectMockConnector,
  disconnectConnector,
  PROVIDER_CATALOG,
  runMockSync,
  VERTICAL_CONNECTOR_TYPES,
} from "@/lib/connectors";
import { connectFastlyConnector, runFastlySync } from "@/lib/connectors/fastly";
import { connectRenovateConnector, runRenovateSync } from "@/lib/connectors/renovate";
import { importTransactionsFromCsv } from "@/lib/csv-import";

export async function connectConnectorAction(formData: FormData): Promise<void> {
  const session = await requireAction("integrations:manage");

  const type = String(formData.get("type") || "") as ConnectorType;
  const provider = String(formData.get("provider") || "");
  const known = PROVIDER_CATALOG[type]?.some((p) => p.provider === provider);
  if (!known) redirect(`/integrations?error=${encodeURIComponent("Unknown provider selected.")}`);

  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: session.workspaceId } });
  if (!VERTICAL_CONNECTOR_TYPES[workspace.vertical].includes(type)) {
    redirect(`/integrations?error=${encodeURIComponent("That connector isn't available for this workspace's vertical.")}`);
  }

  const credentials: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("cred_") && typeof value === "string") credentials[key.slice(5)] = value;
  }

  if (provider === "fastly") {
    try {
      await connectFastlyConnector(session.workspaceId, credentials);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not connect to Fastly.";
      redirect(`/integrations?error=${encodeURIComponent(message)}`);
    }
  } else if (provider === "renovate") {
    try {
      await connectRenovateConnector(session.workspaceId, credentials);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not connect to Renovate.";
      redirect(`/integrations?error=${encodeURIComponent(message)}`);
    }
  } else {
    await connectMockConnector(session.workspaceId, type, provider, credentials);
  }
  revalidatePath("/integrations");
}

export async function syncConnectorAction(formData: FormData): Promise<void> {
  const session = await requireAction("integrations:manage");
  const connectorId = String(formData.get("connectorId") || "");

  const connector = await db.connector.findFirst({ where: { id: connectorId, workspaceId: session.workspaceId } });
  if (connector) {
    if (connector.provider === "fastly") await runFastlySync(connector.id);
    else if (connector.provider === "renovate") await runRenovateSync(connector.id);
    else await runMockSync(connector.id);
  }
  revalidatePath("/integrations");
}

export async function disconnectConnectorAction(formData: FormData): Promise<void> {
  const session = await requireAction("integrations:manage");
  const connectorId = String(formData.get("connectorId") || "");

  const connector = await db.connector.findFirst({ where: { id: connectorId, workspaceId: session.workspaceId } });
  if (connector) await disconnectConnector(connector.id, session.workspaceId);
  revalidatePath("/integrations");
}

export async function importCsvAction(formData: FormData): Promise<void> {
  const session = await requireAction("integrations:manage");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/integrations/csv-import?error=${encodeURIComponent("Choose a CSV file to upload.")}`);
  }

  const text = await (file as File).text();
  const result = await importTransactionsFromCsv(session.workspaceId, text);

  const params = new URLSearchParams({
    imported: String(result.imported),
    skipped: String(result.skipped),
  });
  if (result.errors.length) params.set("errors", result.errors.slice(0, 5).join(" | "));
  redirect(`/integrations/csv-import?${params.toString()}`);
}
