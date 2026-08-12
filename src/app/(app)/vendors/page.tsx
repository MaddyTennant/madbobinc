import Link from "next/link";
import { db } from "@/lib/db";
import { requireCurrentMembership } from "@/lib/tenant";
import { formatCurrency } from "@/lib/format";

export default async function VendorsPage() {
  const session = await requireCurrentMembership();
  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: session.workspaceId } });

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setUTCMonth(twelveMonthsAgo.getUTCMonth() - 12);

  const vendors = await db.vendor.findMany({ where: { workspaceId: session.workspaceId }, orderBy: { name: "asc" } });
  const totals = await db.transaction.groupBy({
    by: ["vendorId"],
    where: { workspaceId: session.workspaceId, kind: "EXPENSE", vendorId: { not: null }, date: { gte: twelveMonthsAgo } },
    _sum: { amount: true },
    _count: true,
  });
  const totalByVendor = new Map(totals.map((t) => [t.vendorId, t]));

  const rows = vendors
    .map((v) => ({ vendor: v, total: totalByVendor.get(v.id)?._sum.amount ?? 0, count: totalByVendor.get(v.id)?._count ?? 0 }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="max-w-4xl space-y-6 p-8">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Vendors</h1>
        <p className="text-sm text-stone-500">Trailing 12-month spend across all connected sources.</p>
      </div>

      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-stone-500">
              <th className="pb-2 font-medium">Vendor</th>
              <th className="pb-2 font-medium">Payment terms</th>
              <th className="pb-2 font-medium">Transactions</th>
              <th className="pb-2 font-medium">Total spend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ vendor, total, count }) => (
              <tr key={vendor.id} className="border-b border-stone-100 last:border-0">
                <td className="py-2">
                  <Link href={`/vendors/${vendor.id}`} className="font-medium text-brand-600 hover:underline">
                    {vendor.name}
                  </Link>
                </td>
                <td className="py-2 text-stone-500">{vendor.paymentTerms ?? "—"}</td>
                <td className="py-2 text-stone-500">{count}</td>
                <td className="py-2">{formatCurrency(total, workspace.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
