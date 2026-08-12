import "server-only";
import type { ConnectorType } from "@prisma/client";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { categorizeByText } from "@/lib/categorize";

export const PROVIDER_CATALOG: Record<ConnectorType, { provider: string; label: string; credentialFields: string[] }[]> = {
  POS: [
    { provider: "toast", label: "Toast", credentialFields: ["API key", "Location ID"] },
    { provider: "square", label: "Square", credentialFields: ["Access token", "Location ID"] },
  ],
  ACCOUNTING: [
    { provider: "quickbooks", label: "QuickBooks", credentialFields: ["Client ID", "Client secret"] },
    { provider: "xero", label: "Xero", credentialFields: ["Client ID", "Client secret"] },
  ],
  SUPPLIER: [
    { provider: "restaurant-depot", label: "Restaurant Depot", credentialFields: ["API key"] },
    { provider: "sysco", label: "Sysco", credentialFields: ["API key", "Account number"] },
  ],
  BANK: [{ provider: "plaid", label: "Plaid (bank & card feeds)", credentialFields: ["Client ID", "Secret"] }],
  PAYROLL: [
    { provider: "gusto", label: "Gusto", credentialFields: ["API key"] },
    { provider: "adp", label: "ADP", credentialFields: ["Client ID", "Client secret"] },
  ],
  DELIVERY: [
    { provider: "doordash", label: "DoorDash", credentialFields: ["API key"] },
    { provider: "ubereats", label: "Uber Eats", credentialFields: ["API key"] },
  ],
};

const SYNC_DESCRIPTIONS: Record<ConnectorType, string[]> = {
  POS: ["dine-in sales batch", "bar tab settlement"],
  ACCOUNTING: ["software subscription charge", "recurring accounting fee"],
  SUPPLIER: ["seafood delivery", "produce delivery", "wine and spirits order"],
  BANK: ["card feed transaction", "bank debit"],
  PAYROLL: ["payroll wages", "staffing"],
  DELIVERY: ["doordash delivery commission", "ubereats delivery commission"],
};

/** Strips the encrypted credential blob before a connector is ever serialized to a client. */
export function toPublicConnector<T extends { encryptedConfig: string | null }>(
  connector: T,
): Omit<T, "encryptedConfig"> {
  const { encryptedConfig: _encryptedConfig, ...rest } = connector;
  return rest;
}

export function credentialFieldName(label: string): string {
  return `cred_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
}

function rand(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

export async function connectMockConnector(
  workspaceId: string,
  type: ConnectorType,
  provider: string,
  credentials: Record<string, string>,
) {
  const connector = await db.connector.upsert({
    where: { workspaceId_type_provider: { workspaceId, type, provider } },
    update: { status: "CONNECTED", encryptedConfig: encryptSecret(JSON.stringify(credentials)), lastError: null },
    create: {
      workspaceId,
      type,
      provider,
      status: "CONNECTED",
      encryptedConfig: encryptSecret(JSON.stringify(credentials)),
    },
  });
  // Run an initial sync immediately so the connector isn't empty on first connect.
  return runMockSync(connector.id);
}

export async function disconnectConnector(connectorId: string, workspaceId: string) {
  await db.connector.updateMany({
    where: { id: connectorId, workspaceId },
    data: { status: "DISCONNECTED", encryptedConfig: null },
  });
}

/**
 * Simulates a provider sync by generating a batch of realistic transactions for
 * the last 30 days. Stands in for the real provider API call a production
 * connector would make.
 */
export async function runMockSync(connectorId: string) {
  const connector = await db.connector.findUniqueOrThrow({ where: { id: connectorId } });
  const descriptions = SYNC_DESCRIPTIONS[connector.type];
  const batchSize = Math.floor(rand(3, 9));

  const categories = await db.category.findMany({ where: { workspaceId: connector.workspaceId } });
  const categoryByKey = new Map(categories.map((c) => [c.key, c]));

  // A real POS connector syncs the restaurant's own sales (revenue), not vendor
  // spend — unlike every other connector type, which syncs money going out.
  const isRevenue = connector.type === "POS";

  let created = 0;
  for (let i = 0; i < batchSize; i++) {
    const descHint = descriptions[Math.floor(Math.random() * descriptions.length)];
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - Math.floor(rand(0, 29)));

    if (isRevenue) {
      await db.transaction.create({
        data: {
          workspaceId: connector.workspaceId,
          date,
          description: `${connector.provider} — ${descHint}`,
          amount: rand(300, 1800),
          kind: "REVENUE",
          source: connector.type.toLowerCase(),
          costCenter: "front-of-house",
          categoryConfidence: 1,
          categorizedBy: "rule",
        },
      });
      created++;
      continue;
    }

    const { categoryKey, confidence } = categorizeByText(descHint);
    const category = categoryByKey.get(categoryKey) ?? categoryByKey.get("other");

    const vendor = await db.vendor.upsert({
      where: { workspaceId_name: { workspaceId: connector.workspaceId, name: connector.provider } },
      update: {},
      create: { workspaceId: connector.workspaceId, name: connector.provider, defaultCategoryKey: categoryKey },
    });

    await db.transaction.create({
      data: {
        workspaceId: connector.workspaceId,
        vendorId: vendor.id,
        categoryId: category?.id,
        date,
        description: `${connector.provider} — ${descHint}`,
        amount: rand(15, 650),
        kind: "EXPENSE",
        source: connector.type.toLowerCase(),
        costCenter: categoryKey === "food_cost" || categoryKey === "beverage" ? "kitchen" : "hq",
        categoryConfidence: confidence,
        categorizedBy: "rule",
      },
    });
    created++;
  }

  return db.connector.update({
    where: { id: connectorId },
    data: {
      status: "CONNECTED",
      lastSyncAt: new Date(),
      recordCount: { increment: created },
      lastError: null,
    },
  });
}
