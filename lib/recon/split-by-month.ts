import { add } from "../money";
import type { MinorUnits } from "../money";
import type { BalanceTransaction } from "./types";

export interface MonthGroup {
  /** "YYYY-MM", UTC calendar month. */
  month: string;
  transactions: BalanceTransaction[];
  netTotal: MinorUnits;
}

/**
 * Groups a payout's transactions by calendar month (UTC), for period
 * reporting when a payout spans a month boundary. A payout itself isn't
 * split — it's deposited on one date — but the transactions that make it
 * up can straddle two months, and monthly summaries need to attribute each
 * transaction to the month it was actually processed in.
 */
export function splitTransactionsByMonth(transactions: BalanceTransaction[]): MonthGroup[] {
  const groups = new Map<string, BalanceTransaction[]>();

  for (const txn of transactions) {
    const month = monthKey(txn.processedAt);
    const existing = groups.get(month);
    if (existing) {
      existing.push(txn);
    } else {
      groups.set(month, [txn]);
    }
  }

  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([month, txns]) => ({
      month,
      transactions: txns,
      netTotal: add(...txns.map((txn) => txn.net)),
    }));
}

function monthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}
