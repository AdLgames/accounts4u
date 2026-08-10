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
 * Loads balance transactions the store has had, independent of payout —
 * the capture-date counterpart to payout-ledger.ts's loadReconciledPayouts,
 * which stays unchanged and is still what the Payouts tab uses. This is
 * what lets P&L recognize a transaction the moment Shopify captures it
 * (lib/shopify/sync.ts's syncBalanceTransactions), rather than waiting for
 * it to appear in a completed payout.
 *
 * `receivedSince`, when passed, bounds the query to rows *received* on or
 * after that date rather than loading the store's entire lifetime history
 * on every call -- a real cost at high order volume, since this pulls full
 * JSON payloads into memory on every P&L page view. Safe as a proxy for
 * "transaction happened on or after X" as long as the caller pads it
 * earlier than the actual window it cares about (received-at lags the
 * transaction's own date by at most the sync sweep's lookback window, not
 * by months) -- see buildProfitAndLossTrend, the only caller that needs a
 * bounded window today.
 */
export async function loadTransactionLedger(storeId: string, receivedSince?: Date): Promise<LedgerEntry[]> {
  const rows = await prisma.rawTransaction.findMany({
    where: { storeId, ...(receivedSince ? { receivedAt: { gte: receivedSince } } : {}) },
    orderBy: { receivedAt: "desc" },
  });

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
