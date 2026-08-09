import type { MinorUnits } from "../money";

// Fixed pick-list rather than freeform text (validated at this layer, not a
// DB enum -- same pattern as Store.subscriptionStatus) so P&L's itemized
// expense grouping doesn't fragment into near-duplicate category strings.
export const BILL_CATEGORIES = [
  "Advertising",
  "Software & Subscriptions",
  "Rent",
  "Shipping & Packaging",
  "Contractors & Labor",
  "Other",
] as const;

export type BillCategory = (typeof BILL_CATEGORIES)[number];

export type BillStatus = "unpaid" | "paid";

export interface BillInput {
  vendor: string;
  category: BillCategory;
  amount: MinorUnits;
  /** Accrual date -- which P&L period this counts in. */
  incurredOn: Date;
  status: BillStatus;
  /** Cash date -- which Cashflow period this counts in. Required iff status === "paid", must be null otherwise. */
  paidOn: Date | null;
  notes?: string | null;
}

export function isBillCategory(value: string): value is BillCategory {
  return (BILL_CATEGORIES as readonly string[]).includes(value);
}
