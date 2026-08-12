import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/tenant";
import { toApiErrorResponse } from "@/lib/api-error";

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAction("reports:view");
    const url = new URL(req.url);
    const startParam = url.searchParams.get("startDate");
    const endParam = url.searchParams.get("endDate");
    const end = endParam ? new Date(endParam) : new Date();
    const start = startParam ? new Date(startParam) : new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

    const transactions = await db.transaction.findMany({
      where: { workspaceId: session.workspaceId, date: { gte: start, lte: end } },
      include: { vendor: true, category: true },
      orderBy: { date: "asc" },
    });

    const header = ["date", "kind", "vendor", "category", "description", "amount", "cost_center", "source"];
    const rows = transactions.map((t) =>
      [
        t.date.toISOString().slice(0, 10),
        t.kind,
        t.vendor?.name ?? "",
        t.category?.label ?? "",
        t.description,
        t.amount.toFixed(2),
        t.costCenter ?? "",
        t.source,
      ]
        .map((v) => csvEscape(String(v)))
        .join(","),
    );
    const csv = [header.join(","), ...rows].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="spend-export-${start.toISOString().slice(0, 10)}-to-${end.toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
