import { prisma } from "../db";
import { balanceTransactionFromRaw } from "../recon/from-raw";
import type { BalanceTransaction } from "../recon/types";

export interface LedgerEntry {
  shopifyId: string;
  transaction: BalanceTransaction;
  /** Null while pending — not yet bundled into any payout. */
  payoutId: string | null;
}

/**
 * Loads every balance transaction the store has ever had, independent of
 * payout — the capture-date counterpart to payout-ledger.ts's
 * loadReconciledPayouts, which stays unchanged and is still what the
 * Payouts tab and Balance Sheet use. This is what lets P&L/Cashflow
 * recognize a transaction the moment Shopify captures it (lib/shopify/sync.ts's
 * syncBalanceTransactions), rather than waiting for it to appear in a
 * completed payout.
 *
 * Loads the store's entire transaction history in one go — same "fine at
 * dev-store scale" judgment call already made in payout-ledger.ts.
 */
export async function loadTransactionLedger(storeId: string): Promise<LedgerEntry[]> {
  const rows = await prisma.rawTransaction.findMany({ where: { storeId }, orderBy: { receivedAt: "desc" } });

  const seen = new Set<string>();
  const entries: LedgerEntry[] = [];
  for (const row of rows) {
    if (seen.has(row.shopifyId)) continue;
    seen.add(row.shopifyId);

    const payload = row.payload as Record<string, unknown>;
    const payoutId = payload.payout_id != null ? String(payload.payout_id) : null;
    entries.push({
      shopifyId: row.shopifyId,
      transaction: balanceTransactionFromRaw(payload),
      payoutId,
    });
  }

  return entries;
}
