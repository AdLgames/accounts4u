import { prisma } from "../db";
import { orderEventsFromRaw, type OrderEvent } from "../recon/order-financials";

/**
 * Loads gateway-agnostic sale/refund events for the store's orders — the
 * primary revenue source for P&L/Cashflow/Balance Sheet (see
 * profit-and-loss.ts, cashflow.ts, balance-sheet.ts), since it works
 * regardless of which payment gateway processed the order. The
 * Shopify-Payments-specific balance-transaction ledger
 * (transaction-ledger.ts) is still used alongside this, but only to
 * enrich with fee/chargeback data when available — not as the revenue
 * source.
 *
 * `receivedSince`, when passed, bounds the query to rows *received* on or
 * after that date instead of loading the store's entire lifetime order
 * history on every call. That full-history load is a real cost at high
 * order volume -- a store with a couple of years of history at even a
 * modest order rate can mean tens of thousands of full JSON payloads
 * pulled into memory on a single page view, which gets slow and risks
 * hitting a serverless function's memory ceiling. receivedSince is a safe
 * proxy for "the order happened on or after X" as long as the caller pads
 * it earlier than the actual window it cares about: a row's receivedAt
 * (when *we* synced it) can only lag its real order date by the sync
 * sweep's lookback window, not by months, so a period-scoped caller like
 * buildProfitAndLossTrend/buildCashflowTrailing13Weeks padding by a month
 * is more than enough margin. Left unbounded for buildBalanceSheet, which
 * genuinely needs a lifetime total -- a known, accepted O(n) read for now;
 * if that page's load time becomes a real problem at scale, the fix is an
 * incrementally-maintained running total updated at sync time, not a
 * bigger version of this same full reload.
 */
export async function loadOrderLedger(storeId: string, receivedSince?: Date): Promise<OrderEvent[]> {
  const rows = await prisma.rawOrder.findMany({
    where: { storeId, ...(receivedSince ? { receivedAt: { gte: receivedSince } } : {}) },
    orderBy: { receivedAt: "desc" },
  });

  const seen = new Set<string>();
  const events: OrderEvent[] = [];
  for (const row of rows) {
    if (seen.has(row.shopifyId)) continue;
    seen.add(row.shopifyId);
    events.push(...orderEventsFromRaw(row.payload as Record<string, unknown>));
  }

  return events;
}
