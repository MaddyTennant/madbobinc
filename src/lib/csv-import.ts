import "server-only";
import { db } from "@/lib/db";
import { categorizeByText } from "@/lib/categorize";

export interface CsvImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

/** Minimal RFC 4180-ish CSV parser: handles quoted fields, escaped quotes, and CRLF/LF. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.length > 0)) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => (obj[h] = (r[idx] ?? "").trim()));
    return obj;
  });
}

/**
 * Expected columns: date, vendor, description, amount, and optionally
 * category (must match a workspace category key) and cost_center.
 */
export async function importTransactionsFromCsv(workspaceId: string, csvText: string): Promise<CsvImportResult> {
  const rows = parseCsv(csvText);
  const categories = await db.category.findMany({ where: { workspaceId } });
  const categoryByKey = new Map(categories.map((c) => [c.key, c]));

  const result: CsvImportResult = { imported: 0, skipped: 0, errors: [] };
  const vendorCache = new Map<string, string>();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const lineNo = i + 2; // account for header row, 1-indexed

    const vendorName = r.vendor?.trim();
    const amount = Number(r.amount);
    const date = r.date ? new Date(r.date) : null;

    if (!vendorName || !Number.isFinite(amount) || !date || Number.isNaN(date.getTime())) {
      result.skipped++;
      result.errors.push(`Row ${lineNo}: requires a valid vendor, amount, and date.`);
      continue;
    }

    let vendorId = vendorCache.get(vendorName);
    if (!vendorId) {
      const vendor = await db.vendor.upsert({
        where: { workspaceId_name: { workspaceId, name: vendorName } },
        update: {},
        create: { workspaceId, name: vendorName },
      });
      vendorId = vendor.id;
      vendorCache.set(vendorName, vendorId);
    }

    const description = r.description || vendorName;
    const requestedCategory = r.category ? categoryByKey.get(r.category) : undefined;
    const auto = categorizeByText(description);
    const category = requestedCategory ?? categoryByKey.get(auto.categoryKey);

    await db.transaction.create({
      data: {
        workspaceId,
        vendorId,
        categoryId: category?.id,
        date,
        description,
        amount,
        source: "csv",
        costCenter: r.cost_center || undefined,
        categoryConfidence: requestedCategory ? 1 : auto.confidence,
        categorizedBy: requestedCategory ? "manual" : "rule",
      },
    });
    result.imported++;
  }

  return result;
}
