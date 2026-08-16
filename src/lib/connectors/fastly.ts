import "server-only";
import { db } from "@/lib/db";
import type { Category, Vertical } from "@prisma/client";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { categorizeByText } from "@/lib/categorize";

const API_BASE = "https://api.fastly.com";
const REQUEST_TIMEOUT_MS = 15_000;
const BACKFILL_MONTHS = 6;
const MAX_LIST_PAGES = 5;

interface FastlyLineItem {
  description?: string;
  amount?: number;
  product_name?: string;
  product_group?: string;
  region?: string;
}

interface FastlyInvoice {
  invoice_id?: string;
  billing_start_date: string;
  billing_end_date?: string;
  transaction_line_items?: FastlyLineItem[];
}

interface FastlyInvoiceList {
  data?: FastlyInvoice[];
  meta?: { next_cursor?: string | null };
}

/** Thin wrapper over Fastly's REST API. Never logs or throws the token itself. */
async function fetchFastly<T>(token: string, path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, API_BASE);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) url.searchParams.set(key, value);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json", "Fastly-Key": token },
      signal: controller.signal,
    });
  } catch {
    throw new Error("Could not reach the Fastly API. Check your network connection and try again.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    if (response.status === 401) throw new Error("Invalid Fastly API token.");
    if (response.status === 403) throw new Error("This Fastly API token doesn't have billing access.");
    throw new Error(`Fastly API error (status ${response.status}).`);
  }

  return response.json() as Promise<T>;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Imports one invoice's line items as Transactions. Returns the number created. */
async function importInvoiceLineItems(
  workspaceId: string,
  vendorId: string,
  vertical: Vertical,
  categoryByKey: Map<string, Category>,
  invoice: FastlyInvoice,
): Promise<number> {
  const date = new Date(invoice.billing_start_date);
  let created = 0;

  for (const item of invoice.transaction_line_items ?? []) {
    const amount = Number(item.amount);
    if (!Number.isFinite(amount)) continue;

    const descHint = item.description?.trim() || item.product_name || "Fastly usage";
    const { categoryKey, confidence } = categorizeByText(descHint, vertical);
    const category = categoryByKey.get(categoryKey) ?? categoryByKey.get("other");

    await db.transaction.create({
      data: {
        workspaceId,
        vendorId,
        categoryId: category?.id,
        date,
        description: `fastly — ${descHint}${item.region ? ` (${item.region})` : ""}`,
        amount,
        kind: "EXPENSE",
        source: "cdn",
        costCenter: "hq",
        categoryConfidence: confidence,
        categorizedBy: "rule",
      },
    });
    created++;
  }

  return created;
}

async function getOrCreateFastlyVendor(workspaceId: string) {
  return db.vendor.upsert({
    where: { workspaceId_name: { workspaceId, name: "fastly" } },
    update: {},
    create: { workspaceId, name: "fastly", defaultCategoryKey: "cdn_edge" },
  });
}

/**
 * Deletes this workspace's previously-synced Fastly transactions for the given
 * billing period onward. Because Fastly's month-to-date invoice is cumulative
 * (re-querying mid-month returns updated totals for the same line items, not
 * new ones), every sync replaces the open period's rows rather than appending —
 * this is also what makes month rollover work for free: once a new
 * month-to-date period starts, prior months' rows simply fall outside this
 * `date >= periodStart` window and are never touched again.
 */
async function replaceOpenPeriod(workspaceId: string, vendorId: string, periodStart: Date): Promise<number> {
  const { count } = await db.transaction.deleteMany({
    where: { workspaceId, vendorId, source: "cdn", date: { gte: periodStart } },
  });
  return count;
}

/**
 * Validates the token, connects the Fastly connector, backfills the last
 * `BACKFILL_MONTHS` of finalized invoices, then imports the current
 * month-to-date invoice. Throws (writing nothing to the DB) if the token is
 * invalid or the API is unreachable.
 */
export async function connectFastlyConnector(workspaceId: string, credentials: Record<string, string>) {
  const token = credentials["api_token"];
  if (!token) throw new Error("A Fastly API token is required.");

  // Validates the token and doubles as the initial month-to-date fetch.
  const mtd = await fetchFastly<FastlyInvoice>(token, "/billing/v3/invoices/month-to-date");

  const connector = await db.connector.upsert({
    where: { workspaceId_type_provider: { workspaceId, type: "CDN", provider: "fastly" } },
    update: { status: "CONNECTED", encryptedConfig: encryptSecret(JSON.stringify(credentials)), lastError: null },
    create: {
      workspaceId,
      type: "CDN",
      provider: "fastly",
      status: "CONNECTED",
      encryptedConfig: encryptSecret(JSON.stringify(credentials)),
    },
  });

  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  const vendor = await getOrCreateFastlyVendor(workspaceId);
  const categories = await db.category.findMany({ where: { workspaceId } });
  const categoryByKey = new Map(categories.map((c) => [c.key, c]));

  let created = 0;

  // Current, in-progress billing period — already fetched and validated above,
  // so this is guaranteed to work even if the backfill below can't.
  created += await importInvoiceLineItems(workspaceId, vendor.id, workspace.vertical, categoryByKey, mtd);

  // Backfill finalized invoices predating this connector, oldest data first.
  // Best-effort: some tokens/plans can read month-to-date but not the historical
  // invoice list, so a failure here must not undo the successful connection above.
  try {
    const now = new Date();
    const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const backfillStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - BACKFILL_MONTHS, 1));

    let cursor: string | undefined;
    for (let page = 0; page < MAX_LIST_PAGES; page++) {
      const list = await fetchFastly<FastlyInvoiceList>(token, "/billing/v3/invoices", {
        billing_start_date: isoDate(backfillStart),
        billing_end_date: isoDate(currentMonthStart),
        limit: "200",
        ...(cursor ? { cursor } : {}),
      });
      for (const invoice of list.data ?? []) {
        created += await importInvoiceLineItems(workspaceId, vendor.id, workspace.vertical, categoryByKey, invoice);
      }
      if (!list.meta?.next_cursor) break;
      cursor = list.meta.next_cursor;
    }
  } catch (err) {
    console.warn("Fastly historical invoice backfill skipped:", err instanceof Error ? err.message : err);
  }

  return db.connector.update({
    where: { id: connector.id },
    data: { status: "CONNECTED", lastSyncAt: new Date(), recordCount: { increment: created }, lastError: null },
  });
}

/** Re-syncs the current month-to-date invoice. See `replaceOpenPeriod` for why this is safe to re-run. */
export async function runFastlySync(connectorId: string) {
  const connector = await db.connector.findUniqueOrThrow({ where: { id: connectorId } });

  try {
    if (!connector.encryptedConfig) throw new Error("Fastly isn't connected.");
    const { api_token: token } = JSON.parse(decryptSecret(connector.encryptedConfig)) as { api_token?: string };
    if (!token) throw new Error("Fastly isn't connected.");

    const mtd = await fetchFastly<FastlyInvoice>(token, "/billing/v3/invoices/month-to-date");
    const workspace = await db.workspace.findUniqueOrThrow({ where: { id: connector.workspaceId } });
    const vendor = await getOrCreateFastlyVendor(connector.workspaceId);
    const categories = await db.category.findMany({ where: { workspaceId: connector.workspaceId } });
    const categoryByKey = new Map(categories.map((c) => [c.key, c]));

    const deleted = await replaceOpenPeriod(connector.workspaceId, vendor.id, new Date(mtd.billing_start_date));
    const created = await importInvoiceLineItems(connector.workspaceId, vendor.id, workspace.vertical, categoryByKey, mtd);

    return await db.connector.update({
      where: { id: connectorId },
      data: {
        status: "CONNECTED",
        lastSyncAt: new Date(),
        recordCount: { increment: created - deleted },
        lastError: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fastly sync failed.";
    return db.connector.update({ where: { id: connectorId }, data: { status: "ERROR", lastError: message } });
  }
}
