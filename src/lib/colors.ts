// Fixed categorical palette (validated for CVD-safe adjacent contrast — see
// dataviz skill). Category identity is mapped to a slot once and reused across
// every chart (dashboard, budgets, insights) so a given category is always the
// same color everywhere, never re-assigned when a filtered view changes.
export const CATEGORICAL_PALETTE = [
  "#2a78d6", // 1 blue
  "#eb6834", // 2 orange
  "#1baf7a", // 3 aqua
  "#eda100", // 4 yellow
  "#e87ba4", // 5 magenta
  "#008300", // 6 green
  "#4a3aa7", // 7 violet
  "#e34948", // 8 red
] as const;

export const CATEGORY_COLOR_MAP: Record<string, string> = {
  food_cost: CATEGORICAL_PALETTE[0],
  beverage: CATEGORICAL_PALETTE[1],
  labor: CATEGORICAL_PALETTE[2],
  utilities: CATEGORICAL_PALETTE[3],
  rent: CATEGORICAL_PALETTE[4],
  marketing: CATEGORICAL_PALETTE[5],
  repairs: CATEGORICAL_PALETTE[6],
  delivery_fees: CATEGORICAL_PALETTE[7],
  // Tech-vertical-only keys. Safe to reuse Hospitality-only slots above (0/1/3/6) —
  // a workspace only ever has one vertical's categories, so these never co-occur.
  cloud_infra: CATEGORICAL_PALETTE[0],
  observability: CATEGORICAL_PALETTE[1],
  cdn_edge: CATEGORICAL_PALETTE[3],
  saas_software: CATEGORICAL_PALETTE[6],
};
export const OTHER_CATEGORY_COLOR = "#898781"; // muted ink — for "software", "other", and any overflow bucket

export function colorForCategory(key: string): string {
  return CATEGORY_COLOR_MAP[key] ?? OTHER_CATEGORY_COLOR;
}

export const SEQUENTIAL_BLUE = "#2a78d6";

export const STATUS_COLORS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;
