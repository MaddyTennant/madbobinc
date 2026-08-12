import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireCurrentMembership } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { formatCurrency } from "@/lib/format";
import { generateBriefAction } from "./actions";

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCurrentMembership();
  const { id } = await params;
  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: session.workspaceId } });

  const vendor = await db.vendor.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (!vendor) notFound();

  const [invoices, spendAgg] = await Promise.all([
    db.invoice.findMany({ where: { workspaceId: session.workspaceId, vendorId: id }, include: { lineItems: true }, orderBy: { invoiceDate: "desc" }, take: 20 }),
    db.transaction.aggregate({ where: { workspaceId: session.workspaceId, vendorId: id, kind: "EXPENSE" }, _sum: { amount: true } }),
  ]);

  const lineItemsBySku = new Map<string, { date: string; unitPrice: number }[]>();
  for (const inv of [...invoices].reverse()) {
    for (const li of inv.lineItems) {
      if (!li.sku) continue;
      const arr = lineItemsBySku.get(li.sku) ?? [];
      arr.push({ date: inv.invoiceDate.toISOString().slice(0, 10), unitPrice: li.unitPrice });
      lineItemsBySku.set(li.sku, arr);
    }
  }

  const canGenerateBrief = can(session.role, "budgets:manage");

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/vendors" className="text-sm text-brand-600 hover:underline">
          &larr; Vendors
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{vendor.name}</h1>
        <p className="text-sm text-slate-500">
          {vendor.paymentTerms ? `Payment terms: ${vendor.paymentTerms} · ` : ""}
          All-time spend: {formatCurrency(spendAgg._sum.amount ?? 0, workspace.currency)}
        </p>
      </div>

      {lineItemsBySku.size > 0 ? (
        <div className="card">
          <h2 className="mb-3 font-medium text-slate-900">Unit price trend per SKU</h2>
          <div className="space-y-3">
            {[...lineItemsBySku.entries()].map(([sku, points]) => (
              <div key={sku}>
                <p className="text-xs font-medium text-slate-500">{sku}</p>
                <p className="text-sm text-slate-700">
                  {points.map((p) => `€${p.unitPrice.toFixed(2)} (${p.date})`).join(" → ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-900">AI negotiation brief</h2>
          {canGenerateBrief ? (
            <form action={generateBriefAction}>
              <input type="hidden" name="vendorId" value={vendor.id} />
              <button className="btn-secondary text-xs" type="submit">
                {vendor.negotiationBrief ? "Regenerate" : "Generate brief"}
              </button>
            </form>
          ) : null}
        </div>
        {vendor.negotiationBrief ? (
          <>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-slate-700">{vendor.negotiationBrief}</pre>
            <p className="mt-2 text-xs text-slate-400">
              Generated {vendor.negotiationBriefAt?.toLocaleString("en-US")}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No brief generated yet.</p>
        )}
      </div>

      <div className="card">
        <h2 className="mb-3 font-medium text-slate-900">Invoice history</h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-slate-500">No invoices yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 font-medium">Invoice</th>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Amount</th>
                <th className="pb-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2">{inv.invoiceNumber}</td>
                  <td className="py-2 text-slate-500">{inv.invoiceDate.toDateString()}</td>
                  <td className="py-2">{formatCurrency(inv.totalAmount, workspace.currency)}</td>
                  <td className="py-2 text-slate-500">{inv.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
