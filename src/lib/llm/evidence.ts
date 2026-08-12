import "server-only";
import { db } from "@/lib/db";

export interface EvidenceItem {
  id: string;
  type: "duplicate_invoice" | "price_creep" | "vendor_spike" | "budget_overrun" | "subscription_waste";
  headline: string;
  detail: string;
  dollarImpact: number;
  refs: { model: string; id: string; note: string }[];
}

function startOfMonth(monthsAgo: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMonth(d.getUTCMonth() - monthsAgo);
  return d;
}

/**
 * Deterministic feature extraction over the unified spend tables. Kept
 * separate from the LLM call by design: exact-duplicate matching, price
 * deltas, and budget math are things plain code computes reliably and
 * cheaply — the LLM's job (in generateInsights) is judgment and narrative on
 * top of these pre-computed, already-correct numbers, not arithmetic.
 */
export async function gatherEvidence(workspaceId: string): Promise<EvidenceItem[]> {
  const now = new Date();
  const items: EvidenceItem[] = [];

  // 1. Duplicate / double-billed invoices: same vendor + same amount within 5 days.
  const recentInvoices = await db.invoice.findMany({
    where: { workspaceId, invoiceDate: { gte: startOfMonth(3, now) } },
    include: { vendor: true },
    orderBy: { invoiceDate: "asc" },
  });
  const seen = new Set<string>();
  for (let i = 0; i < recentInvoices.length; i++) {
    for (let j = i + 1; j < recentInvoices.length; j++) {
      const a = recentInvoices[i];
      const b = recentInvoices[j];
      if (a.vendorId !== b.vendorId || seen.has(a.id) || seen.has(b.id)) continue;
      const daysApart = Math.abs(a.invoiceDate.getTime() - b.invoiceDate.getTime()) / 86_400_000;
      if (daysApart <= 5 && Math.abs(a.totalAmount - b.totalAmount) < 0.01) {
        seen.add(a.id);
        seen.add(b.id);
        items.push({
          id: `dup-${a.id}-${b.id}`,
          type: "duplicate_invoice",
          headline: `Possible duplicate invoice from ${a.vendor.name}`,
          detail: `Invoice ${a.invoiceNumber} (€${a.totalAmount.toFixed(2)}, ${a.invoiceDate.toDateString()}) and invoice ${b.invoiceNumber} (€${b.totalAmount.toFixed(2)}, ${b.invoiceDate.toDateString()}) from ${a.vendor.name} are for the identical amount ${daysApart.toFixed(0)} day(s) apart.`,
          dollarImpact: Math.min(a.totalAmount, b.totalAmount),
          refs: [
            { model: "Invoice", id: a.id, note: a.invoiceNumber },
            { model: "Invoice", id: b.id, note: b.invoiceNumber },
          ],
        });
      }
    }
  }

  // 2. Price creep: per-vendor, per-SKU unit price now vs. 3 months ago.
  const lineItems = await db.invoiceLineItem.findMany({
    where: { invoice: { workspaceId, invoiceDate: { gte: startOfMonth(4, now) } }, sku: { not: null } },
    include: { invoice: { include: { vendor: true } } },
    orderBy: { invoice: { invoiceDate: "asc" } },
  });
  const bySkuVendor = new Map<string, typeof lineItems>();
  for (const li of lineItems) {
    const key = `${li.invoice.vendorId}:${li.sku}`;
    const arr = bySkuVendor.get(key) ?? [];
    arr.push(li);
    bySkuVendor.set(key, arr);
  }
  for (const [, group] of bySkuVendor) {
    if (group.length < 2) continue;
    const first = group[0];
    const last = group[group.length - 1];
    if (first.unitPrice <= 0) continue;
    const pctChange = (last.unitPrice - first.unitPrice) / first.unitPrice;
    if (pctChange >= 0.08) {
      const vendor = last.invoice.vendor;
      items.push({
        id: `price-${vendor.id}-${last.sku}`,
        type: "price_creep",
        headline: `${vendor.name} raised the price on ${last.description}`,
        detail: `Unit price for ${last.description} (SKU ${last.sku}) from ${vendor.name} rose from €${first.unitPrice.toFixed(2)} to €${last.unitPrice.toFixed(2)} (+${(pctChange * 100).toFixed(1)}%) between ${first.invoice.invoiceDate.toDateString()} and ${last.invoice.invoiceDate.toDateString()}.`,
        dollarImpact: (last.unitPrice - first.unitPrice) * last.quantity,
        refs: [
          { model: "InvoiceLineItem", id: first.id, note: `€${first.unitPrice} on ${first.invoice.invoiceDate.toDateString()}` },
          { model: "InvoiceLineItem", id: last.id, note: `€${last.unitPrice} on ${last.invoice.invoiceDate.toDateString()}` },
        ],
      });
    }
  }

  // 3. Vendor spend spikes: current month vs. trailing 3-month average.
  const monthStart = startOfMonth(0, now);
  const [currentTotals, priorTotals] = await Promise.all([
    db.transaction.groupBy({
      by: ["vendorId"],
      where: { workspaceId, kind: "EXPENSE", vendorId: { not: null }, date: { gte: monthStart, lte: now } },
      _sum: { amount: true },
    }),
    db.transaction.groupBy({
      by: ["vendorId"],
      where: { workspaceId, kind: "EXPENSE", vendorId: { not: null }, date: { gte: startOfMonth(3, now), lt: monthStart } },
      _sum: { amount: true },
    }),
  ]);
  const priorByVendor = new Map(priorTotals.map((p) => [p.vendorId, (p._sum.amount ?? 0) / 3]));
  const vendorIds = currentTotals.map((c) => c.vendorId).filter((id): id is string => Boolean(id));
  const vendors = await db.vendor.findMany({ where: { id: { in: vendorIds } } });
  const vendorById = new Map(vendors.map((v) => [v.id, v]));
  for (const c of currentTotals) {
    if (!c.vendorId) continue;
    const current = c._sum.amount ?? 0;
    const priorAvg = priorByVendor.get(c.vendorId) ?? 0;
    if (priorAvg >= 50 && current > priorAvg * 2) {
      const vendor = vendorById.get(c.vendorId);
      items.push({
        id: `spike-${c.vendorId}`,
        type: "vendor_spike",
        headline: `${vendor?.name ?? "A vendor"} spend spiked this month`,
        detail: `Spend with ${vendor?.name ?? "this vendor"} this month is €${current.toFixed(2)}, vs. a trailing 3-month average of €${priorAvg.toFixed(2)} (${((current / priorAvg - 1) * 100).toFixed(0)}% above normal).`,
        dollarImpact: current - priorAvg,
        refs: [{ model: "Vendor", id: c.vendorId, note: `€${current.toFixed(2)} this month vs €${priorAvg.toFixed(2)} avg` }],
      });
    }
  }

  // 4. Budget overruns: current month actual vs. budget, per category.
  const budgets = await db.budget.findMany({ where: { workspaceId, month: monthStart }, include: { category: true } });
  const categoryTotals = await db.transaction.groupBy({
    by: ["categoryId"],
    where: { workspaceId, kind: "EXPENSE", date: { gte: monthStart, lte: now } },
    _sum: { amount: true },
  });
  const actualByCategory = new Map(categoryTotals.map((c) => [c.categoryId, c._sum.amount ?? 0]));
  for (const b of budgets) {
    const actual = actualByCategory.get(b.categoryId) ?? 0;
    if (actual > b.amount) {
      items.push({
        id: `budget-${b.categoryId}`,
        type: "budget_overrun",
        headline: `${b.category.label} is over budget`,
        detail: `${b.category.label} spend this month is €${actual.toFixed(2)} against a budget of €${b.amount.toFixed(2)} (€${(actual - b.amount).toFixed(2)} over), with ${new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate() - now.getDate()} day(s) left in the month.`,
        dollarImpact: actual - b.amount,
        refs: [{ model: "Budget", id: b.id, note: `${b.category.label}: €${actual.toFixed(2)} of €${b.amount.toFixed(2)}` }],
      });
    }
  }

  // 5. Subscription/software waste: multiple software vendors billed this month.
  const softwareCategory = await db.category.findFirst({ where: { workspaceId, key: "software" } });
  if (softwareCategory) {
    const softwareTx = await db.transaction.findMany({
      where: { workspaceId, kind: "EXPENSE", categoryId: softwareCategory.id, date: { gte: monthStart, lte: now } },
      include: { vendor: true },
    });
    const byVendor = new Map<string, number>();
    for (const t of softwareTx) {
      if (!t.vendor) continue;
      byVendor.set(t.vendor.name, (byVendor.get(t.vendor.name) ?? 0) + t.amount);
    }
    if (byVendor.size >= 2) {
      const names = [...byVendor.keys()];
      const total = [...byVendor.values()].reduce((a, b) => a + b, 0);
      items.push({
        id: "subscription-overlap",
        type: "subscription_waste",
        headline: "Multiple overlapping software subscriptions",
        detail: `${names.length} software subscriptions billed this month (${names.join(", ")}), totaling €${total.toFixed(2)}. Worth checking whether any are redundant (e.g. running two POS systems).`,
        dollarImpact: Math.min(...byVendor.values()),
        refs: names.map((n) => ({ model: "Vendor", id: n, note: `€${(byVendor.get(n) ?? 0).toFixed(2)}` })),
      });
    }
  }

  return items;
}
