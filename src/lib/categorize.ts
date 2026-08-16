import type { Vertical } from "@prisma/client";

const HOSPITALITY_CATEGORIES = [
  { key: "food_cost", label: "Food Cost", glCode: "5000" },
  { key: "beverage", label: "Beverage", glCode: "5100" },
  { key: "labor", label: "Labor", glCode: "6000" },
  { key: "utilities", label: "Utilities", glCode: "6200" },
  { key: "rent", label: "Rent", glCode: "6300" },
  { key: "marketing", label: "Marketing", glCode: "6400" },
  { key: "repairs", label: "Repairs & Maintenance", glCode: "6500" },
  { key: "delivery_fees", label: "Delivery Fees", glCode: "6600" },
  { key: "software", label: "Software & Subscriptions", glCode: "6700" },
  { key: "other", label: "Other", glCode: "6900" },
] as const;

const TECH_CATEGORIES = [
  { key: "cloud_infra", label: "Cloud Infrastructure", glCode: "7000" },
  { key: "observability", label: "Observability", glCode: "7100" },
  { key: "cdn_edge", label: "CDN & Edge", glCode: "7200" },
  { key: "saas_software", label: "Software & Subscriptions", glCode: "7300" },
  { key: "labor", label: "Labor", glCode: "7400" },
  { key: "marketing", label: "Marketing", glCode: "7500" },
  { key: "rent", label: "Rent & Facilities", glCode: "7600" },
  { key: "other", label: "Other", glCode: "7900" },
] as const;

/** Categories seeded on every new workspace, keyed by vertical. */
const CATEGORY_SETS = {
  HOSPITALITY: HOSPITALITY_CATEGORIES,
  // Placeholder — Healthcare has no category set of its own yet.
  HEALTHCARE: HOSPITALITY_CATEGORIES,
  TECH: TECH_CATEGORIES,
} satisfies Record<Vertical, readonly { key: string; label: string; glCode: string }[]>;

export type CategoryKey = (typeof CATEGORY_SETS)[Vertical][number]["key"];

/** Mutable copy for Prisma `create: [...]` inputs, which reject readonly tuples. */
export function defaultCategoryCreateInputs(vertical: Vertical): { key: string; label: string; glCode: string }[] {
  return CATEGORY_SETS[vertical].map((c) => ({ ...c }));
}

interface CategoryRule {
  category: CategoryKey;
  keywords: string[];
  confidence: number;
}

// Ordered keyword rules for a lightweight, explainable categorizer, keyed by
// vertical. Each entry's keywords are matched against the transaction/vendor
// description (case-insensitive); the first match wins. Confidence reflects
// how specific/unambiguous the keyword is.
const HOSPITALITY_RULES: CategoryRule[] = [
  { category: "labor", keywords: ["payroll", "gusto", "adp", "wages", "staffing"], confidence: 0.97 },
  { category: "rent", keywords: ["rent", "lease", "landlord", "property mgmt"], confidence: 0.95 },
  { category: "utilities", keywords: ["electric", "gas company", "water utility", "utility", "pg&e", "con edison"], confidence: 0.93 },
  { category: "delivery_fees", keywords: ["doordash", "ubereats", "uber eats", "grubhub", "delivery commission"], confidence: 0.93 },
  { category: "software", keywords: ["toast", "square", "quickbooks", "xero", "subscription", "saas", "software"], confidence: 0.85 },
  { category: "marketing", keywords: ["marketing", "advertis", "instagram ads", "google ads", "yelp"], confidence: 0.88 },
  { category: "repairs", keywords: ["repair", "maintenance", "hvac", "plumb", "technician"], confidence: 0.88 },
  {
    category: "beverage",
    keywords: ["wine", "beer", "spirits", "brewery", "distillery", "beverage", "coffee roaster", "soda"],
    confidence: 0.85,
  },
  {
    category: "food_cost",
    keywords: [
      "produce",
      "seafood",
      "meat",
      "poultry",
      "dairy",
      "bakery",
      "sysco",
      "us foods",
      "restaurant depot",
      "farm",
      "food supply",
    ],
    confidence: 0.85,
  },
];

const TECH_RULES: CategoryRule[] = [
  { category: "labor", keywords: ["payroll", "gusto", "adp", "wages", "staffing"], confidence: 0.97 },
  { category: "rent", keywords: ["rent", "lease", "landlord", "property mgmt", "office space"], confidence: 0.95 },
  {
    category: "cloud_infra",
    keywords: ["azure", "aws", "gcp", "compute", "vm usage", "storage egress", "cloud infrastructure"],
    confidence: 0.9,
  },
  {
    category: "observability",
    keywords: ["datadog", "apm", "host-hour", "log ingestion", "observability", "monitoring"],
    confidence: 0.9,
  },
  {
    category: "cdn_edge",
    keywords: ["fastly", "cdn", "bandwidth", "edge compute", "content delivery"],
    confidence: 0.9,
  },
  { category: "saas_software", keywords: ["subscription", "saas", "software"], confidence: 0.85 },
  { category: "marketing", keywords: ["marketing", "advertis", "google ads", "linkedin ads"], confidence: 0.88 },
];

const CATEGORIZATION_RULES: Record<Vertical, CategoryRule[]> = {
  HOSPITALITY: HOSPITALITY_RULES,
  HEALTHCARE: HOSPITALITY_RULES,
  TECH: TECH_RULES,
};

export interface CategorizationResult {
  categoryKey: CategoryKey;
  confidence: number;
  matchedBy: "rule" | "default";
}

export function categorizeByText(text: string, vertical: Vertical): CategorizationResult {
  const lower = text.toLowerCase();
  for (const rule of CATEGORIZATION_RULES[vertical]) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return { categoryKey: rule.category, confidence: rule.confidence, matchedBy: "rule" };
    }
  }
  return { categoryKey: "other", confidence: 0.4, matchedBy: "default" };
}
