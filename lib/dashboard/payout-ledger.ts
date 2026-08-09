import { prisma } from "../db";
import { explainPayout } from "../recon/explain-payout";
import { balanceTransactionFromRaw, payoutFromRaw } from "../recon/from-raw";
import type { BalanceTransaction, Payout, PayoutBreakdown } from "../recon/types";

export interface ReconciledPayout {
  shopifyId: string;
  payout: Payout;
  transactions: BalanceTransaction[];
  breakdown: PayoutBreakdown;
}

/**
 * Loads and reconciles every payout the store has ever had — shared by
 * profit-and-loss.ts, cashflow.ts, and balance-sheet.ts, which each filter
 * or aggregate the result differently. payouts.ts (the Payouts screen) has
 * a different access pattern (single-payout lookup) and doesn't use this.
 *
 * Loads the store's entire payout/transaction history in one go — fine at
 * dev-store scale, same judgment call already made in payouts.ts's
 * explainPayoutById (transactions aren't queryable by payout_id at the DB
 * level, only inside the JSON payload). Fast-follow if this ever matters:
 * add payout_id as an indexed column at sync time and filter server-side.
 */
export async function loadReconciledPayouts(storeId: string): Promise<ReconciledPayout[]> {
  const [payoutRows, transactionRows] = await Promise.all([
    prisma.rawPayout.findMany({ where: { storeId }, orderBy: { receivedAt: "desc" } }),
    prisma.rawTransaction.findMany({ where: { storeId } }),
  ]);

  // De-dupe append-only rows by shopifyId, keeping the most recently received.
  const seenPayoutIds = new Set<string>();
  const payouts: Array<{ shopifyId: string; payout: Payout }> = [];
  for (const row of payoutRows) {
    if (seenPayoutIds.has(row.shopifyId)) continue;
    seenPayoutIds.add(row.shopifyId);
    payouts.push({ shopifyId: row.shopifyId, payout: payoutFromRaw(row.payload as Record<string, unknown>) });
  }

  const transactionPayloads = transactionRows.map((row) => row.payload as Record<string, unknown>);

  return payouts.map(({ shopifyId, payout }) => {
    const transactions = transactionPayloads
      .filter((payload) => String(payload.payout_id ?? "") === shopifyId)
      .map((payload) => balanceTransactionFromRaw(payload));
    const breakdown = explainPayout(payout, transactions);
    return { shopifyId, payout, transactions, breakdown };
  });
}
