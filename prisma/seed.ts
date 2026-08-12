import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { encryptSecret } from "../src/lib/crypto";
import { categorizeByText, defaultCategoryCreateInputs } from "../src/lib/categorize";

// bcryptjs, not lib/auth's hashPassword, because lib/auth.ts is guarded with
// `import "server-only"`, which unconditionally throws outside a Next.js
// server bundle (e.g. this plain tsx-run seed script).
function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

const db = new PrismaClient();

const DEMO_PASSWORD = "password123";

type VendorSeed = {
  name: string;
  categoryHint: string; // free text fed through the categorizer, mimics an invoice line description
  paymentTerms: string;
  baseUnitPrice: number; // EUR per unit, before monthly drift
  monthlyDriftPct: number; // simulates price creep (or 0)
  monthlyBaseAmount: number; // typical monthly spend before drift
  volatility: number; // 0..1, random swing applied per month
};

const VENDORS: VendorSeed[] = [
  { name: "North Sea Seafood Co.", categoryHint: "seafood delivery", paymentTerms: "NET 30", baseUnitPrice: 18, monthlyDriftPct: 0.045, monthlyBaseAmount: 4200, volatility: 0.1 },
  { name: "Amstel Produce Market", categoryHint: "produce delivery", paymentTerms: "NET 15", baseUnitPrice: 2.4, monthlyDriftPct: 0.01, monthlyBaseAmount: 3100, volatility: 0.12 },
  { name: "Windmill Wine & Spirits", categoryHint: "wine and spirits order", paymentTerms: "NET 30", baseUnitPrice: 12, monthlyDriftPct: 0.005, monthlyBaseAmount: 2600, volatility: 0.15 },
  { name: "CleanBrew Coffee Roasters", categoryHint: "coffee roaster beverage supply", paymentTerms: "NET 30", baseUnitPrice: 9, monthlyDriftPct: 0.0, monthlyBaseAmount: 640, volatility: 0.05 },
  { name: "ServicePro Facilities", categoryHint: "hvac repair and maintenance", paymentTerms: "NET 30", baseUnitPrice: 85, monthlyDriftPct: 0.0, monthlyBaseAmount: 420, volatility: 0.6 },
  { name: "Toast POS", categoryHint: "toast software subscription", paymentTerms: "Monthly", baseUnitPrice: 269, monthlyDriftPct: 0.0, monthlyBaseAmount: 269, volatility: 0.0 },
  { name: "Square Register", categoryHint: "square software subscription", paymentTerms: "Monthly", baseUnitPrice: 89, monthlyDriftPct: 0.0, monthlyBaseAmount: 89, volatility: 0.0 },
  { name: "DoorDash for Business", categoryHint: "doordash delivery commission", paymentTerms: "Monthly", baseUnitPrice: 1, monthlyDriftPct: 0.0, monthlyBaseAmount: 980, volatility: 0.2 },
  { name: "Amsterdam Energie", categoryHint: "electric utility bill", paymentTerms: "Monthly", baseUnitPrice: 1, monthlyDriftPct: 0.02, monthlyBaseAmount: 1450, volatility: 0.15 },
  { name: "Canal View Properties", categoryHint: "rent lease payment", paymentTerms: "Monthly", baseUnitPrice: 1, monthlyDriftPct: 0.0, monthlyBaseAmount: 6800, volatility: 0.0 },
  { name: "Gusto Payroll", categoryHint: "payroll wages", paymentTerms: "Monthly", baseUnitPrice: 1, monthlyDriftPct: 0.0, monthlyBaseAmount: 15200, volatility: 0.08 },
];

const MONTHS_BACK = 6; // seed the trailing 6 months including the current one

function startOfMonth(monthsAgo: number): Date {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMonth(d.getUTCMonth() - monthsAgo);
  return d;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

async function main() {
  console.log("Seeding demo workspace...");

  const workspace = await db.workspace.create({
    data: {
      name: "Blue Anchor Bistro",
      location: "Amsterdam, NL",
      currency: "EUR",
      fiscalMonthStart: 1,
      categories: { create: defaultCategoryCreateInputs() },
    },
  });

  const categories = await db.category.findMany({ where: { workspaceId: workspace.id } });
  const categoryByKey = new Map(categories.map((c) => [c.key, c]));

  const users = await Promise.all(
    [
      { email: "owner@blueanchor.demo", name: "Mira Alden", role: "OWNER" as const },
      { email: "finance@blueanchor.demo", name: "Tomas Reyes", role: "FINANCE_MANAGER" as const },
      { email: "kitchen@blueanchor.demo", name: "Priya Nandy", role: "KITCHEN_MANAGER" as const },
      { email: "viewer@blueanchor.demo", name: "Sam Okafor", role: "VIEWER" as const },
    ].map(async (u) => {
      const user = await db.user.create({
        data: { email: u.email, name: u.name, passwordHash: await hashPassword(DEMO_PASSWORD) },
      });
      await db.membership.create({ data: { userId: user.id, workspaceId: workspace.id, role: u.role } });
      return user;
    }),
  );
  console.log(`Created ${users.length} demo users (password: ${DEMO_PASSWORD})`);

  const connectorDefs: { type: "POS" | "ACCOUNTING" | "SUPPLIER" | "BANK" | "PAYROLL" | "DELIVERY"; provider: string; recordCount: number }[] = [
    { type: "POS", provider: "toast", recordCount: 18450 },
    { type: "ACCOUNTING", provider: "quickbooks", recordCount: 2380 },
    { type: "SUPPLIER", provider: "restaurant-depot", recordCount: 640 },
    { type: "BANK", provider: "plaid", recordCount: 3120 },
    { type: "PAYROLL", provider: "gusto", recordCount: 96 },
    { type: "DELIVERY", provider: "doordash", recordCount: 5210 },
  ];
  for (const c of connectorDefs) {
    await db.connector.create({
      data: {
        workspaceId: workspace.id,
        type: c.type,
        provider: c.provider,
        status: "CONNECTED",
        encryptedConfig: encryptSecret(JSON.stringify({ apiKey: `demo_${c.provider}_key`, accountId: "demo-account" })),
        lastSyncAt: new Date(),
        recordCount: c.recordCount,
      },
    });
  }
  console.log(`Connected ${connectorDefs.length} mock integrations`);

  const vendors = await Promise.all(
    VENDORS.map((v) =>
      db.vendor.create({
        data: {
          workspaceId: workspace.id,
          name: v.name,
          paymentTerms: v.paymentTerms,
          defaultCategoryKey: categorizeByText(v.categoryHint).categoryKey,
        },
      }),
    ),
  );

  let invoiceSeq = 1000;
  let duplicateInjected = false;
  let spikeInjected = false;

  // POS revenue: a restaurant's own daily sales, distinct from vendor spend.
  // Spread across ~daily batches (like a real POS sync would produce) rather
  // than one lump sum, so month-to-date queries for the current, in-progress
  // month naturally reflect a partial month instead of a future-dated total.
  const REVENUE_BASE = 42000;
  const REVENUE_GROWTH_PCT = 0.01;
  const today = new Date();
  for (let m = MONTHS_BACK - 1; m >= 0; m--) {
    const monthStart = startOfMonth(m);
    const growth = Math.pow(1 + REVENUE_GROWTH_PCT, MONTHS_BACK - 1 - m);
    const monthlyTotal = REVENUE_BASE * growth;
    const daysInMonth = m === 0 ? today.getUTCDate() : new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
    const perDay = monthlyTotal / 30; // divisor fixed at 30 so a partial current month reads as partial, not inflated

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(monthStart);
      date.setUTCDate(day);
      await db.transaction.create({
        data: {
          workspaceId: workspace.id,
          date,
          description: "Toast POS — daily net sales",
          amount: Math.round(perDay * (1 + rand(-0.15, 0.15)) * 100) / 100,
          kind: "REVENUE",
          source: "pos",
          costCenter: "front-of-house",
          categoryConfidence: 1,
          categorizedBy: "rule",
        },
      });
    }
  }
  console.log("Seeded daily POS revenue for 6 months");

  for (let m = MONTHS_BACK - 1; m >= 0; m--) {
    const monthStart = startOfMonth(m);

    for (let vi = 0; vi < vendors.length; vi++) {
      const vendor = vendors[vi];
      const spec = VENDORS[vi];
      const cat = categoryByKey.get(spec.categoryHint ? categorizeByText(spec.categoryHint).categoryKey : "other")!;

      const drift = Math.pow(1 + spec.monthlyDriftPct, MONTHS_BACK - 1 - m);
      const swing = 1 + rand(-spec.volatility, spec.volatility);
      let amount = Math.round(spec.monthlyBaseAmount * drift * swing * 100) / 100;

      // Inject one facilities cost spike in the most recent full month for the oversight engine to catch.
      if (spec.name === "ServicePro Facilities" && m === 1 && !spikeInjected) {
        amount = amount * 4.2;
        spikeInjected = true;
      }

      const invoiceDate = new Date(monthStart);
      const desiredDay = Math.min(28, 3 + vi);
      invoiceDate.setUTCDate(m === 0 ? Math.min(desiredDay, today.getUTCDate()) : desiredDay);
      const quantity = spec.baseUnitPrice > 1 ? Math.round((amount / (spec.baseUnitPrice * drift)) * 10) / 10 : amount;
      const unitPrice = spec.baseUnitPrice > 1 ? Math.round(spec.baseUnitPrice * drift * 100) / 100 : 1;

      const invoice = await db.invoice.create({
        data: {
          workspaceId: workspace.id,
          vendorId: vendor.id,
          invoiceNumber: `INV-${invoiceSeq++}`,
          invoiceDate,
          totalAmount: amount,
          source: spec.paymentTerms === "Monthly" ? "accounting" : "supplier",
          lineItems: {
            create: [
              {
                sku: spec.baseUnitPrice > 1 ? `${vendor.name.slice(0, 3).toUpperCase()}-001` : undefined,
                description: spec.categoryHint,
                quantity,
                unitPrice,
                amount,
              },
            ],
          },
        },
      });

      const { categoryKey, confidence } = categorizeByText(spec.categoryHint);
      await db.transaction.create({
        data: {
          workspaceId: workspace.id,
          vendorId: vendor.id,
          invoiceId: invoice.id,
          categoryId: categoryByKey.get(categoryKey)!.id,
          date: invoiceDate,
          description: `${vendor.name} — ${spec.categoryHint}`,
          amount,
          source: invoice.source,
          costCenter: categoryKey === "food_cost" || categoryKey === "beverage" ? "kitchen" : "hq",
          categoryConfidence: confidence,
          categorizedBy: "rule",
        },
      });

      // Inject one duplicate/double-billed invoice for the oversight engine to catch.
      if (vendor.name === "Amstel Produce Market" && m === 0 && !duplicateInjected) {
        duplicateInjected = true;
        const dupeDate = new Date(invoiceDate);
        dupeDate.setUTCDate(Math.min(dupeDate.getUTCDate() + 1, today.getUTCDate()));
        const dupeInvoice = await db.invoice.create({
          data: {
            workspaceId: workspace.id,
            vendorId: vendor.id,
            invoiceNumber: `INV-${invoiceSeq++}`,
            invoiceDate: dupeDate,
            totalAmount: amount,
            source: "supplier",
            lineItems: { create: [{ description: spec.categoryHint, quantity, unitPrice, amount }] },
          },
        });
        await db.transaction.create({
          data: {
            workspaceId: workspace.id,
            vendorId: vendor.id,
            invoiceId: dupeInvoice.id,
            categoryId: categoryByKey.get(categoryKey)!.id,
            date: dupeDate,
            description: `${vendor.name} — ${spec.categoryHint}`,
            amount,
            source: "supplier",
            costCenter: "kitchen",
            categoryConfidence: confidence,
            categorizedBy: "rule",
          },
        });
      }
    }
  }
  console.log("Seeded 6 months of invoices/line items/transactions across 11 vendors");

  const budgetTargets: Record<string, number> = {
    food_cost: 21000,
    beverage: 9000,
    labor: 15500,
    utilities: 1500,
    rent: 6800,
    marketing: 800,
    repairs: 500,
    delivery_fees: 900,
    software: 400,
    other: 300,
  };
  const currentMonth = startOfMonth(0);
  for (const [key, amount] of Object.entries(budgetTargets)) {
    const category = categoryByKey.get(key);
    if (!category) continue;
    await db.budget.create({
      data: { workspaceId: workspace.id, categoryId: category.id, location: workspace.location, month: currentMonth, amount },
    });
  }
  console.log("Seeded current-month budgets per category");

  await db.webhookEndpoint.create({
    data: { workspaceId: workspace.id, token: `whk_${workspace.id.slice(0, 12)}`, label: "Generic inbound webhook" },
  });

  console.log("\nDemo login (any role, same password):");
  console.log("  owner@blueanchor.demo / finance@blueanchor.demo / kitchen@blueanchor.demo / viewer@blueanchor.demo");
  console.log(`  password: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
