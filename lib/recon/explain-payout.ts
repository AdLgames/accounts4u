import { add, isZero, minorUnits, subtract } from "../money";
import type { BalanceTransaction, Payout, PayoutBreakdown } from "./types";

/**
 * Explains a payout by decomposing its balance transactions into named
 * categories and checking that they fully account for the deposited amount.
 * Pure — no DB or network calls (see CLAUDE.md's reconciliation-logic rule).
 *
 * The balance check is built from each transaction's `net` (amount minus
 * fee), not from a hand-assembled `grossSales - fees - refunds + ...`
 * formula. Shopify's exact sign conventions per transaction type (does a
 * refund's `amount` arrive negative? does a refunded processing fee?)
 * aren't verifiable from this sandbox — guessing them wrong could produce a
 * formula that happens to cancel out and hide a real discrepancy, which is
 * exactly what CLAUDE.md's "never silently plug differences" rule forbids.
 * `net` has no such ambiguity: by definition, the sum of every transaction's
 * balance impact in a payout equals the deposited amount. The category
 * totals (grossSales, refunds, fees, ...) are still computed and returned
 * for display, just not relied on for the correctness check.
 */
export function explainPayout(payout: Payout, transactions: BalanceTransaction[]): PayoutBreakdown {
  const currencies = new Set([payout.currency, ...transactions.map((txn) => txn.currency)]);
  const multiCurrencyWarning = currencies.size > 1;

  let grossSales = minorUnits(0);
  let refunds = minorUnits(0);
  let fees = minorUnits(0);
  let chargebacks = minorUnits(0);
  let adjustments = minorUnits(0);
  let reserves = minorUnits(0);
  let other = minorUnits(0);
  let computedTotal = minorUnits(0);

  const merchantRemittedTaxOrderIds: string[] = [];
  const platformRemittedTaxOrderIds: string[] = [];

  for (const txn of transactions) {
    fees = add(fees, txn.fee);
    computedTotal = add(computedTotal, txn.net);

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

    if (txn.sourceOrderId && txn.taxRemittedByPlatform !== null) {
      const list = txn.taxRemittedByPlatform ? platformRemittedTaxOrderIds : merchantRemittedTaxOrderIds;
      if (!list.includes(txn.sourceOrderId)) {
        list.push(txn.sourceOrderId);
      }
    }
  }

  const residual = subtract(computedTotal, payout.amount);

  return {
    payoutId: payout.id,
    currency: payout.currency,
    deposited: payout.amount,
    grossSales,
    refunds,
    fees,
    chargebacks,
    adjustments,
    reserves,
    other,
    computedTotal,
    residual,
    isExplained: isZero(residual),
    multiCurrencyWarning,
    merchantRemittedTaxOrderIds,
    platformRemittedTaxOrderIds,
    transactionCount: transactions.length,
  };
}
