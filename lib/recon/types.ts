import type { MinorUnits } from "@/lib/money";

/**
 * Buckets a Shopify Payments balance transaction can fall into. "other"
 * covers anything that doesn't match a known category (e.g. BNPL/
 * installment fee lines) rather than crashing on an unrecognized type —
 * see lib/recon/from-raw.ts for why the exact set of type strings Shopify
 * uses isn't fully verified here.
 */
export type BalanceTransactionType =
  | "charge"
  | "refund"
  | "dispute"
  | "reserve"
  | "adjustment"
  | "other";

export interface BalanceTransaction {
  id: string;
  type: BalanceTransactionType;
  amount: MinorUnits;
  fee: MinorUnits;
  /** amount minus fee — the actual balance impact of this transaction. */
  net: MinorUnits;
  currency: string;
  sourceOrderId: string | null;
  /**
   * True when Shopify remitted this order's tax as a marketplace facilitator
   * (e.g. a Shop app order); false when the merchant is liable; null when
   * not applicable (no associated order, or unknown).
   */
  taxRemittedByPlatform: boolean | null;
  processedAt: Date;
}

export interface Payout {
  id: string;
  status: string;
  currency: string;
  /** Net amount actually deposited to the merchant's bank account. */
  amount: MinorUnits;
  date: Date;
}

export interface PayoutBreakdown {
  payoutId: string;
  currency: string;
  deposited: MinorUnits;

  /** Category totals, for display — summed from each transaction's `amount`, not `net`. Not used for the balance check (see explainPayout's comment on why). */
  grossSales: MinorUnits;
  refunds: MinorUnits;
  fees: MinorUnits;
  chargebacks: MinorUnits;
  adjustments: MinorUnits;
  reserves: MinorUnits;
  other: MinorUnits;

  /** Sum of every transaction's net — the authoritative figure the balance check is built on. */
  computedTotal: MinorUnits;
  /** computedTotal minus deposited. Zero means the payout is fully explained. */
  residual: MinorUnits;
  isExplained: boolean;

  /** True when this payout or any of its transactions use a different currency than the rest — v1 doesn't attempt multi-currency arithmetic, it just flags it. */
  multiCurrencyWarning: boolean;

  merchantRemittedTaxOrderIds: string[];
  platformRemittedTaxOrderIds: string[];

  transactionCount: number;
}
