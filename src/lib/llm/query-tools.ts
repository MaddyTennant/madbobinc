import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";

/**
 * Whitelisted, tenant-scoped query functions the NL console's LLM can call via
 * tool-use. This is the safety boundary: the model never sees or emits SQL —
 * it can only invoke one of these fixed, parameterized functions, each of
 * which hard-codes `workspaceId` into its Prisma query. There is no code path
 * from a user question to an arbitrary database query.
 */

const dateRangeShape = {
  startDate: z.string().datetime().optional().describe("ISO date, inclusive. Defaults to 90 days ago."),
  endDate: z.string().datetime().optional().describe("ISO date, inclusive. Defaults to now."),
};

function resolveRange(startDate?: string, endDate?: string): { start: Date; end: Date } {
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate ? new Date(startDate) : new Date(end.getTime() - 90 * 86_400_000);
  return { start, end };
}

const GetSpendByCategoryArgs = z.object(dateRangeShape);
const GetSpendByVendorArgs = z.object({ ...dateRangeShape, vendorName: z.string().optional().describe("Filter to vendors whose name contains this (case-insensitive).") });
const GetMonthlyTrendArgs = z.object({ months: z.number().int().min(1).max(24).default(6) });
const GetVendorPriceTrendArgs = z.object({ vendorName: z.string().describe("Vendor name or partial name.") });
const GetBudgetVsActualArgs = z.object({});
const SearchTransactionsArgs = z.object({
  ...dateRangeShape,
  vendorName: z.string().optional(),
  categoryKey: z.string().optional().describe("e.g. food_cost, beverage, labor, utilities, rent, marketing, repairs, delivery_fees, software, other"),
  limit: z.number().int().min(1).max(50).default(20),
});

export interface QueryTool {
  name: string;
  description: string;
  jsonSchema: Record<string, unknown>;
  /** Accepts unknown and validates internally via zodSchema.parse — the type-erasure here is
   * intentional and safe, since every execute() re-validates its own args before using them. */
  execute: (workspaceId: string, args: unknown) => Promise<unknown>;
}

function tool<A>(def: {
  name: string;
  description: string;
  zodSchema: z.ZodType<A>;
  jsonSchema: Record<string, unknown>;
  execute: (workspaceId: string, args: A) => Promise<unknown>;
}): QueryTool {
  return { name: def.name, description: def.description, jsonSchema: def.jsonSchema, execute: def.execute as (workspaceId: string, args: unknown) => Promise<unknown> };
}

export const QUERY_TOOLS: QueryTool[] = [
  tool({
    name: "get_spend_by_category",
    description: "Total spend per category over a date range (defaults to the last 90 days).",
    zodSchema: GetSpendByCategoryArgs,
    jsonSchema: {
      type: "object",
      properties: { startDate: { type: "string", format: "date-time" }, endDate: { type: "string", format: "date-time" } },
    },
    execute: async (workspaceId, args) => {
      const { startDate, endDate } = GetSpendByCategoryArgs.parse(args);
      const { start, end } = resolveRange(startDate, endDate);
      const totals = await db.transaction.groupBy({
        by: ["categoryId"],
        where: { workspaceId, kind: "EXPENSE", date: { gte: start, lte: end } },
        _sum: { amount: true },
      });
      const categories = await db.category.findMany({ where: { workspaceId } });
      const byId = new Map(categories.map((c) => [c.id, c]));
      return totals
        .map((t) => ({ category: t.categoryId ? byId.get(t.categoryId)?.label ?? "Uncategorized" : "Uncategorized", total: t._sum.amount ?? 0 }))
        .sort((a, b) => b.total - a.total);
    },
  }),
  tool({
    name: "get_spend_by_vendor",
    description: "Total spend per vendor over a date range, optionally filtered by vendor name.",
    zodSchema: GetSpendByVendorArgs,
    jsonSchema: {
      type: "object",
      properties: {
        startDate: { type: "string", format: "date-time" },
        endDate: { type: "string", format: "date-time" },
        vendorName: { type: "string" },
      },
    },
    execute: async (workspaceId, args) => {
      const { startDate, endDate, vendorName } = GetSpendByVendorArgs.parse(args);
      const { start, end } = resolveRange(startDate, endDate);
      const vendors = vendorName
        ? await db.vendor.findMany({ where: { workspaceId, name: { contains: vendorName, mode: "insensitive" } } })
        : null;
      const totals = await db.transaction.groupBy({
        by: ["vendorId"],
        where: {
          workspaceId,
          kind: "EXPENSE",
          date: { gte: start, lte: end },
          vendorId: vendors ? { in: vendors.map((v) => v.id) } : { not: null },
        },
        _sum: { amount: true },
      });
      const vendorIds = totals.map((t) => t.vendorId).filter((id): id is string => Boolean(id));
      const allVendors = await db.vendor.findMany({ where: { id: { in: vendorIds } } });
      const byId = new Map(allVendors.map((v) => [v.id, v]));
      return totals
        .map((t) => ({ vendor: t.vendorId ? byId.get(t.vendorId)?.name ?? "Unknown" : "Unknown", total: t._sum.amount ?? 0 }))
        .sort((a, b) => b.total - a.total);
    },
  }),
  tool({
    name: "get_monthly_trend",
    description: "Total spend and revenue per calendar month for the trailing N months (default 6).",
    zodSchema: GetMonthlyTrendArgs,
    jsonSchema: { type: "object", properties: { months: { type: "integer", minimum: 1, maximum: 24 } } },
    execute: async (workspaceId, args) => {
      const { months } = GetMonthlyTrendArgs.parse(args);
      const now = new Date();
      const points: { month: string; spend: number; revenue: number }[] = [];
      for (let m = months - 1; m >= 0; m--) {
        const start = new Date(now);
        start.setUTCDate(1);
        start.setUTCHours(0, 0, 0, 0);
        start.setUTCMonth(start.getUTCMonth() - m);
        const end = new Date(start);
        end.setUTCMonth(end.getUTCMonth() + 1);
        const [spend, revenue] = await Promise.all([
          db.transaction.aggregate({ where: { workspaceId, kind: "EXPENSE", date: { gte: start, lt: end } }, _sum: { amount: true } }),
          db.transaction.aggregate({ where: { workspaceId, kind: "REVENUE", date: { gte: start, lt: end } }, _sum: { amount: true } }),
        ]);
        points.push({
          month: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
          spend: spend._sum.amount ?? 0,
          revenue: revenue._sum.amount ?? 0,
        });
      }
      return points;
    },
  }),
  tool({
    name: "get_vendor_price_trend",
    description: "Per-SKU unit price history for a vendor, oldest to newest — use this to explain why a vendor's costs changed.",
    zodSchema: GetVendorPriceTrendArgs,
    jsonSchema: { type: "object", properties: { vendorName: { type: "string" } }, required: ["vendorName"] },
    execute: async (workspaceId, args) => {
      const { vendorName } = GetVendorPriceTrendArgs.parse(args);
      const vendor = await db.vendor.findFirst({ where: { workspaceId, name: { contains: vendorName, mode: "insensitive" } } });
      if (!vendor) return { error: `No vendor found matching "${vendorName}"` };
      const lineItems = await db.invoiceLineItem.findMany({
        where: { invoice: { workspaceId, vendorId: vendor.id } },
        include: { invoice: true },
        orderBy: { invoice: { invoiceDate: "asc" } },
        take: 50,
      });
      return {
        vendor: vendor.name,
        priceHistory: lineItems.map((li) => ({
          date: li.invoice.invoiceDate.toISOString().slice(0, 10),
          sku: li.sku,
          description: li.description,
          unitPrice: li.unitPrice,
          quantity: li.quantity,
        })),
      };
    },
  }),
  tool({
    name: "get_budget_vs_actual",
    description: "This month's budget vs. actual spend per category.",
    zodSchema: GetBudgetVsActualArgs,
    jsonSchema: { type: "object", properties: {} },
    execute: async (workspaceId) => {
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const budgets = await db.budget.findMany({ where: { workspaceId, month: monthStart }, include: { category: true } });
      const totals = await db.transaction.groupBy({
        by: ["categoryId"],
        where: { workspaceId, kind: "EXPENSE", date: { gte: monthStart, lte: now } },
        _sum: { amount: true },
      });
      const actualByCategory = new Map(totals.map((t) => [t.categoryId, t._sum.amount ?? 0]));
      return budgets.map((b) => ({
        category: b.category.label,
        budget: b.amount,
        actual: actualByCategory.get(b.categoryId) ?? 0,
      }));
    },
  }),
  tool({
    name: "search_transactions",
    description: "Look up individual transaction records matching a vendor, category, and/or date range — the underlying source records behind any total.",
    zodSchema: SearchTransactionsArgs,
    jsonSchema: {
      type: "object",
      properties: {
        startDate: { type: "string", format: "date-time" },
        endDate: { type: "string", format: "date-time" },
        vendorName: { type: "string" },
        categoryKey: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
    },
    execute: async (workspaceId, args) => {
      const { startDate, endDate, vendorName, categoryKey, limit } = SearchTransactionsArgs.parse(args);
      const { start, end } = resolveRange(startDate, endDate);
      const category = categoryKey ? await db.category.findFirst({ where: { workspaceId, key: categoryKey } }) : null;
      const vendor = vendorName ? await db.vendor.findFirst({ where: { workspaceId, name: { contains: vendorName, mode: "insensitive" } } }) : null;
      const transactions = await db.transaction.findMany({
        where: {
          workspaceId,
          date: { gte: start, lte: end },
          ...(category ? { categoryId: category.id } : {}),
          ...(vendor ? { vendorId: vendor.id } : {}),
        },
        include: { vendor: true, category: true },
        orderBy: { date: "desc" },
        take: limit,
      });
      return transactions.map((t) => ({
        id: t.id,
        date: t.date.toISOString().slice(0, 10),
        vendor: t.vendor?.name ?? null,
        category: t.category?.label ?? null,
        description: t.description,
        amount: t.amount,
        kind: t.kind,
      }));
    },
  }),
];
