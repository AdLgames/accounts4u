// Fixed pick-list, same pattern as lib/bills/types.ts's BILL_CATEGORIES --
// validated at the app layer, not a DB enum. Unlike bill categories these
// are genuinely store-specific (a jewelry store's and a pet-supply store's
// natural categories don't share a sensible universal list) -- this is a
// reasonable v1 default, not a settled taxonomy.
export const REVENUE_CATEGORIES = [
  "Physical Products",
  "Digital Products",
  "Services",
  "Shipping & Handling",
  "Other",
] as const;

export type RevenueCategory = (typeof REVENUE_CATEGORIES)[number];

export function isRevenueCategory(value: string): value is RevenueCategory {
  return (REVENUE_CATEGORIES as readonly string[]).includes(value);
}
