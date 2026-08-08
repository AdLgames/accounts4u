import { prisma } from "@/lib/db";
import { explainPayout } from "@/lib/recon/explain-payout";
import { balanceTransactionFromRaw, payoutFromRaw } from "@/lib/recon/from-raw";
import type { Payout, PayoutBreakdown } from "@/lib/recon/types";

/**
 * raw_payouts/raw_transactions are append-only (CLAUDE.md) — the same
 * Shopify payout or transaction can appear as more than one row if it was
 * synced more than once (backfill, then a later sweep). De-dupes by
 * shopifyId, keeping the most recently received row.
 */
export async function listPayouts(storeId: string, limit = 50): Promise<Payout[]> {
  const rows = await prisma.rawPayout.findMany({
    where: { storeId },
    orderBy: { receivedAt: "desc" },
    take: limit,
  });

  const seen = new Set<string>();
  const payouts: Payout[] = [];
  for (const row of rows) {
    if (seen.has(row.shopifyId)) continue;
    seen.add(row.shopifyId);
    payouts.push(payoutFromRaw(row.payload as Record<string, unknown>));
  }

  return payouts.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * Loads a single payout and the balance transactions that made it up, then
 * runs them through explainPayout. Transactions aren't queryable by
 * payout_id at the DB level (it's only inside the JSON payload, not a real
 * column) — filtering happens in application code instead, which means
 * this loads every transaction row for the store. Fine at dev-store scale;
 * a follow-up would add payout_id as its own indexed column at sync time.
 */
export async function explainPayoutById(storeId: string, payoutId: string): Promise<PayoutBreakdown | null> {
  const payoutRow = await prisma.rawPayout.findFirst({
    where: { storeId, shopifyId: payoutId },
    orderBy: { receivedAt: "desc" },
  });
  if (!payoutRow) return null;

  const transactionRows = await prisma.rawTransaction.findMany({ where: { storeId } });
  const transactions = transactionRows
    .map((row) => row.payload as Record<string, unknown>)
    .filter((payload) => String(payload.payout_id ?? "") === payoutId)
    .map((payload) => balanceTransactionFromRaw(payload));

  return explainPayout(payoutFromRaw(payoutRow.payload as Record<string, unknown>), transactions);
}
