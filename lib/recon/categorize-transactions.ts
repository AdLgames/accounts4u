import { add, minorUnits, type MinorUnits } from "../money";
import type { BalanceTransaction } from "./types";

export interface CategorizedTotals {
  grossSales: MinorUnits;
  refunds: MinorUnits;
  fees: MinorUnits;
  chargebacks: MinorUnits;
  adjustments: MinorUnits;
  reserves: MinorUnits;
  other: MinorUnits;
  /** Sum of every transaction's net — same "trust net, not a hand-built formula" principle as explain-payout.ts. */
  netTotal: MinorUnits;
  transactionCount: number;
}

/**
 * The same charge/refund/fee/dispute/adjustment/reserve bucketing
 * explain-payout.ts already does, extracted as new code rather than a
 * refactor of it — explain-payout.ts's reconciliation logic (checked
 * against an actual bank deposit) must not change. This is for grouping an
 * arbitrary set of transactions by their own processedAt (e.g. a calendar
 * month), which has no deposit to reconcile against — see
 * lib/dashboard/profit-and-loss.ts and cashflow.ts.
 */
export function categorizeTransactions(transactions: BalanceTransaction[]): CategorizedTotals {
  let grossSales = minorUnits(0);
  let refunds = minorUnits(0);
  let fees = minorUnits(0);
  let chargebacks = minorUnits(0);
  let adjustments = minorUnits(0);
  let reserves = minorUnits(0);
  let other = minorUnits(0);
  let netTotal = minorUnits(0);

  for (const txn of transactions) {
    fees = add(fees, txn.fee);
    netTotal = add(netTotal, txn.net);

    switch (txn.type) {
      case "charge":
        grossSales = add(grossSales, txn.amount);
        break;
      case "refund":
        refunds = add(refunds, txn.amount);
        break;
      case "dispute":
        chargebacks = add(chargebacks, txn.amount);
        break;
      case "adjustment":
        adjustments = add(adjustments, txn.amount);
        break;
      case "reserve":
        reserves = add(reserves, txn.amount);
        break;
      default:
        other = add(other, txn.amount);
    }
  }

  return {
    grossSales,
    refunds,
    fees,
    chargebacks,
    adjustments,
    reserves,
    other,
    netTotal,
    transactionCount: transactions.length,
  };
}
