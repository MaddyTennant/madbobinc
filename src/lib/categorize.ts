export const DEFAULT_CATEGORIES = [
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

export type CategoryKey = (typeof DEFAULT_CATEGORIES)[number]["key"];

/** Mutable copy for Prisma `create: [...]` inputs, which reject readonly tuples. */
export function defaultCategoryCreateInputs(): { key: string; label: string; glCode: string }[] {
  return DEFAULT_CATEGORIES.map((c) => ({ ...c }));
}

// Ordered keyword rules for a lightweight, explainable categorizer. Each entry's
// keywords are matched against the transaction/vendor description (case-insensitive);
// the first match wins. Confidence reflects how specific/unambiguous the keyword is.
const RULES: { category: CategoryKey; keywords: string[]; confidence: number }[] = [
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

export interface CategorizationResult {
  categoryKey: CategoryKey;
  confidence: number;
  matchedBy: "rule" | "default";
}

export function categorizeByText(text: string): CategorizationResult {
  const lower = text.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return { categoryKey: rule.category, confidence: rule.confidence, matchedBy: "rule" };
    }
  }
  return { categoryKey: "other", confidence: 0.4, matchedBy: "default" };
}
