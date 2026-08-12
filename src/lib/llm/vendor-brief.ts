import "server-only";
import { db } from "@/lib/db";
import { callClaudeForText, isLlmConfigured, OVERSIGHT_MODEL } from "@/lib/llm/client";

interface BriefInputs {
  vendorName: string;
  paymentTerms: string | null;
  totalSpendTrailing12mo: number;
  firstUnitPrice: number | null;
  lastUnitPrice: number | null;
  pctPriceChange: number | null;
  peerAvgUnitPrice: number | null;
  categoryLabel: string | null;
}

async function gatherBriefInputs(workspaceId: string, vendorId: string): Promise<BriefInputs | null> {
  const vendor = await db.vendor.findFirst({ where: { id: vendorId, workspaceId } });
  if (!vendor) return null;

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setUTCMonth(twelveMonthsAgo.getUTCMonth() - 12);

  const [spendAgg, lineItems] = await Promise.all([
    db.transaction.aggregate({
      where: { workspaceId, vendorId, kind: "EXPENSE", date: { gte: twelveMonthsAgo } },
      _sum: { amount: true },
    }),
    db.invoiceLineItem.findMany({
      where: { invoice: { workspaceId, vendorId }, sku: { not: null } },
      include: { invoice: true },
      orderBy: { invoice: { invoiceDate: "asc" } },
    }),
  ]);

  const first = lineItems[0] ?? null;
  const last = lineItems[lineItems.length - 1] ?? null;
  const pctPriceChange = first && last && first.unitPrice > 0 ? (last.unitPrice - first.unitPrice) / first.unitPrice : null;

  let peerAvgUnitPrice: number | null = null;
  let categoryLabel: string | null = null;
  if (vendor.defaultCategoryKey) {
    const category = await db.category.findFirst({ where: { workspaceId, key: vendor.defaultCategoryKey } });
    categoryLabel = category?.label ?? null;
    if (category) {
      const peerLineItems = await db.invoiceLineItem.findMany({
        where: {
          invoice: { workspaceId, vendorId: { not: vendorId }, vendor: { defaultCategoryKey: vendor.defaultCategoryKey } },
        },
        select: { unitPrice: true },
      });
      if (peerLineItems.length > 0) {
        const avg = peerLineItems.reduce((sum, li) => sum + li.unitPrice, 0) / peerLineItems.length;
        // Guard against comparing prices quoted in incompatible units (e.g. €/kg
        // seafood vs €/crate produce) — only treat the peer average as a
        // meaningful benchmark if it's within the same rough order of magnitude.
        const reference = last?.unitPrice ?? first?.unitPrice ?? null;
        if (reference && avg > 0 && avg / reference >= 0.2 && avg / reference <= 5) {
          peerAvgUnitPrice = avg;
        }
      }
    }
  }

  return {
    vendorName: vendor.name,
    paymentTerms: vendor.paymentTerms,
    totalSpendTrailing12mo: spendAgg._sum.amount ?? 0,
    firstUnitPrice: first?.unitPrice ?? null,
    lastUnitPrice: last?.unitPrice ?? null,
    pctPriceChange,
    peerAvgUnitPrice,
    categoryLabel,
  };
}

function mockBrief(inputs: BriefInputs): string {
  const lines: string[] = [
    `Negotiation brief: ${inputs.vendorName}`,
    `- Trailing 12-month spend: €${inputs.totalSpendTrailing12mo.toFixed(2)}${inputs.paymentTerms ? ` (terms: ${inputs.paymentTerms})` : ""}.`,
  ];
  if (inputs.firstUnitPrice != null && inputs.lastUnitPrice != null && inputs.pctPriceChange != null) {
    lines.push(
      `- Unit price moved from €${inputs.firstUnitPrice.toFixed(2)} to €${inputs.lastUnitPrice.toFixed(2)} (${inputs.pctPriceChange >= 0 ? "+" : ""}${(inputs.pctPriceChange * 100).toFixed(1)}%).`,
    );
  }
  if (inputs.peerAvgUnitPrice != null && inputs.lastUnitPrice != null) {
    const diff = ((inputs.lastUnitPrice - inputs.peerAvgUnitPrice) / inputs.peerAvgUnitPrice) * 100;
    lines.push(
      `- Compared to other ${inputs.categoryLabel ?? "similar"} vendors, this vendor's average unit price is ${diff >= 0 ? "" : "-"}${Math.abs(diff).toFixed(1)}% ${diff >= 0 ? "above" : "below"} peers (€${inputs.peerAvgUnitPrice.toFixed(2)} avg).`,
    );
  }
  lines.push(
    inputs.pctPriceChange != null && inputs.pctPriceChange > 0.05
      ? "- Suggested opening ask: request the pre-increase price back, or a volume discount, citing the trend above."
      : "- Pricing has been stable; use this renewal to lock in current rates or request a small volume discount.",
  );
  lines.push("(Generated in mock mode — set ANTHROPIC_API_KEY for a fully written AI brief.)");
  return lines.join("\n");
}

export async function generateNegotiationBrief(workspaceId: string, vendorId: string): Promise<string | null> {
  const inputs = await gatherBriefInputs(workspaceId, vendorId);
  if (!inputs) return null;

  let brief: string;
  if (isLlmConfigured()) {
    const prompt = `Write a short negotiation brief a restaurant manager can bring into a renewal conversation
with this vendor. Use ONLY the numbers given below — do not invent any figures. 4-6 short bullet points:
recent price trend, how they compare to peer vendors in the same category, and 1-2 concrete negotiation asks.

${JSON.stringify(inputs, null, 2)}`;

    const text = await callClaudeForText({
      model: OVERSIGHT_MODEL,
      system: "You are a sharp, concise procurement negotiation advisor for an independent restaurant.",
      prompt,
      maxTokens: 600,
    });
    brief = text ?? mockBrief(inputs);
  } else {
    brief = mockBrief(inputs);
  }

  await db.vendor.update({ where: { id: vendorId }, data: { negotiationBrief: brief, negotiationBriefAt: new Date() } });
  return brief;
}
