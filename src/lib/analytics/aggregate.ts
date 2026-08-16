import "server-only";
import { db } from "@/lib/db";
import { colorForCategory } from "@/lib/colors";

const TREND_MONTHS = 6;
const MAX_CATEGORY_SLICES = 8; // matches the validated categorical palette's slot count
const TOP_VENDOR_COUNT = 8;

function startOfMonth(monthsAgo: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMonth(d.getUTCMonth() - monthsAgo);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export interface CategorySlice {
  key: string;
  label: string;
  amount: number;
  color: string;
}

export interface VendorSlice {
  vendorId: string;
  name: string;
  amount: number;
}

export interface TrendPoint {
  month: string; // "2026-08"
  label: string; // "Aug"
  spend: number;
  revenue: number;
}

export interface BudgetComparison {
  key: string;
  label: string;
  color: string;
  budget: number;
  actual: number;
}

export interface RatioTile {
  label: string;
  sublabel: string;
  value: number | null;
}

export interface DashboardSummary {
  currency: string;
  periodLabel: string;
  totalSpendMTD: number;
  totalSpendSamePointLastMonth: number;
  revenueMTD: number;
  primaryRatio: RatioTile;
  secondaryRatio: RatioTile;
  byCategory: CategorySlice[];
  byVendor: VendorSlice[];
  monthlyTrend: TrendPoint[];
  budgetVsActual: BudgetComparison[];
  cashOutForecast30d: number;
  dailyBurnRate: number;
}

export async function getDashboardSummary(workspaceId: string): Promise<DashboardSummary> {
  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  const now = new Date();
  const monthStart = startOfMonth(0, now);
  const dayOfMonth = now.getUTCDate();
  const prevMonthStart = startOfMonth(1, now);
  const prevMonthSamePoint = new Date(prevMonthStart);
  prevMonthSamePoint.setUTCDate(Math.min(dayOfMonth, 28));
  const trailing30Start = new Date(now);
  trailing30Start.setUTCDate(trailing30Start.getUTCDate() - 30);

  const [mtdExpense, mtdRevenue, prevSamePointExpense, categories, trailing30RevenueAgg, trailing30CategoryTotals] =
    await Promise.all([
      db.transaction.aggregate({
        where: { workspaceId, kind: "EXPENSE", date: { gte: monthStart, lte: now } },
        _sum: { amount: true },
      }),
      db.transaction.aggregate({
        where: { workspaceId, kind: "REVENUE", date: { gte: monthStart, lte: now } },
        _sum: { amount: true },
      }),
      db.transaction.aggregate({
        where: { workspaceId, kind: "EXPENSE", date: { gte: prevMonthStart, lte: prevMonthSamePoint } },
        _sum: { amount: true },
      }),
      db.category.findMany({ where: { workspaceId } }),
      db.transaction.aggregate({
        where: { workspaceId, kind: "REVENUE", date: { gte: trailing30Start, lte: now } },
        _sum: { amount: true },
      }),
      db.transaction.groupBy({
        by: ["categoryId"],
        where: { workspaceId, kind: "EXPENSE", date: { gte: trailing30Start, lte: now } },
        _sum: { amount: true },
      }),
    ]);

  const totalSpendMTD = mtdExpense._sum.amount ?? 0;
  const revenueMTD = mtdRevenue._sum.amount ?? 0;
  const totalSpendSamePointLastMonth = prevSamePointExpense._sum.amount ?? 0;

  const categoryTotals = await db.transaction.groupBy({
    by: ["categoryId"],
    where: { workspaceId, kind: "EXPENSE", date: { gte: monthStart, lte: now } },
    _sum: { amount: true },
  });
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  // These two ratio tiles use a trailing 30-day window rather than calendar
  // month-to-date: lumpy monthly costs (rent, payroll, subscriptions) tend to
  // land early in the month, which would otherwise make the ratios look
  // artificially inflated for most of the month.
  const amountForKeys = (keys: string[]) =>
    sum(
      trailing30CategoryTotals
        .filter((t) => {
          const key = t.categoryId ? categoryById.get(t.categoryId)?.key : null;
          return key != null && keys.includes(key);
        })
        .map((t) => t._sum.amount ?? 0),
    );

  let primaryRatio: RatioTile;
  let secondaryRatio: RatioTile;

  if (workspace.vertical === "TECH") {
    // Tech workspaces have no revenue connector (no POS equivalent), so revenue
    // is always $0 — these ratios are relative to total spend instead.
    const trailing30TotalExpense = sum(trailing30CategoryTotals.map((t) => t._sum.amount ?? 0));
    const infraAmount = amountForKeys(["cloud_infra", "observability", "cdn_edge"]);
    const saasAmount = amountForKeys(["saas_software"]);
    primaryRatio = {
      label: "Infra spend %",
      sublabel: "Cloud + observability + CDN / total spend, trailing 30 days",
      value: trailing30TotalExpense > 0 ? infraAmount / trailing30TotalExpense : null,
    };
    secondaryRatio = {
      label: "SaaS spend %",
      sublabel: "Software & subscriptions / total spend, trailing 30 days",
      value: trailing30TotalExpense > 0 ? saasAmount / trailing30TotalExpense : null,
    };
  } else {
    const trailing30Revenue = trailing30RevenueAgg._sum.amount ?? 0;
    const foodBevAmount = amountForKeys(["food_cost", "beverage"]);
    const laborAmount = amountForKeys(["labor"]);
    primaryRatio = {
      label: "Food cost %",
      sublabel: "Food + beverage / revenue, trailing 30 days",
      value: trailing30Revenue > 0 ? foodBevAmount / trailing30Revenue : null,
    };
    secondaryRatio = {
      label: "Prime cost %",
      sublabel: "Food + beverage + labor / revenue, trailing 30 days",
      value: trailing30Revenue > 0 ? (foodBevAmount + laborAmount) / trailing30Revenue : null,
    };
  }

  const rankedCategories = categoryTotals
    .map((t) => {
      const cat = t.categoryId ? categoryById.get(t.categoryId) : null;
      return { key: cat?.key ?? "other", label: cat?.label ?? "Uncategorized", amount: t._sum.amount ?? 0 };
    })
    .sort((a, b) => b.amount - a.amount);

  const byCategory: CategorySlice[] = [];
  let otherTotal = 0;
  rankedCategories.forEach((c, idx) => {
    if (idx < MAX_CATEGORY_SLICES - 1 || rankedCategories.length <= MAX_CATEGORY_SLICES) {
      byCategory.push({ ...c, color: colorForCategory(c.key) });
    } else {
      otherTotal += c.amount;
    }
  });
  if (otherTotal > 0) byCategory.push({ key: "other", label: "Other", amount: otherTotal, color: colorForCategory("other") });

  const vendorTotals = await db.transaction.groupBy({
    by: ["vendorId"],
    where: { workspaceId, kind: "EXPENSE", date: { gte: monthStart, lte: now }, vendorId: { not: null } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
    take: TOP_VENDOR_COUNT,
  });
  const vendorIds = vendorTotals.map((v) => v.vendorId).filter((id): id is string => Boolean(id));
  const vendors = await db.vendor.findMany({ where: { id: { in: vendorIds } } });
  const vendorById = new Map(vendors.map((v) => [v.id, v]));
  const byVendor: VendorSlice[] = vendorTotals.map((v) => ({
    vendorId: v.vendorId ?? "",
    name: v.vendorId ? vendorById.get(v.vendorId)?.name ?? "Unknown" : "Unknown",
    amount: v._sum.amount ?? 0,
  }));

  const monthlyTrend: TrendPoint[] = [];
  for (let m = TREND_MONTHS - 1; m >= 0; m--) {
    const start = startOfMonth(m, now);
    const end = m === 0 ? now : addMonths(start, 1);
    const [spendAgg, revenueAgg] = await Promise.all([
      db.transaction.aggregate({ where: { workspaceId, kind: "EXPENSE", date: { gte: start, lt: end } }, _sum: { amount: true } }),
      db.transaction.aggregate({ where: { workspaceId, kind: "REVENUE", date: { gte: start, lt: end } }, _sum: { amount: true } }),
    ]);
    monthlyTrend.push({
      month: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
      label: start.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
      spend: spendAgg._sum.amount ?? 0,
      revenue: revenueAgg._sum.amount ?? 0,
    });
  }

  const budgets = await db.budget.findMany({ where: { workspaceId, month: monthStart }, include: { category: true } });
  const budgetVsActual: BudgetComparison[] = budgets
    .map((b) => {
      const actualEntry = categoryTotals.find((t) => t.categoryId === b.categoryId);
      return {
        key: b.category.key,
        label: b.category.label,
        color: colorForCategory(b.category.key),
        budget: b.amount,
        actual: actualEntry?._sum.amount ?? 0,
      };
    })
    .sort((a, b) => b.budget - a.budget);

  // 30-day cash-out forecast: trailing 30-day daily average spend, projected forward.
  const trailing30Expense = await db.transaction.aggregate({
    where: { workspaceId, kind: "EXPENSE", date: { gte: trailing30Start, lte: now } },
    _sum: { amount: true },
  });
  const dailyBurnRate = (trailing30Expense._sum.amount ?? 0) / 30;
  const cashOutForecast30d = dailyBurnRate * 30;

  return {
    currency: workspace.currency,
    periodLabel: monthStart.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    totalSpendMTD,
    totalSpendSamePointLastMonth,
    revenueMTD,
    primaryRatio,
    secondaryRatio,
    byCategory,
    byVendor,
    monthlyTrend,
    budgetVsActual,
    cashOutForecast30d,
    dailyBurnRate,
  };
}
