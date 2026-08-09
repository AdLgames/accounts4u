import { prisma } from "../db";
import { orderEventsFromRaw, type OrderEvent } from "../recon/order-financials";

/**
 * Loads gateway-agnostic sale/refund events for every order the store has
 * ever had — the primary revenue source for P&L/Cashflow (see
 * profit-and-loss.ts, cashflow.ts), since it works regardless of which
 * payment gateway processed the order. The Shopify-Payments-specific
 * balance-transaction ledger (transaction-ledger.ts) is still used
 * alongside this, but only to enrich with fee/chargeback data when
 * available — not as the revenue source.
 *
 * Loads the store's entire order history in one go — same "fine at
 * dev-store scale" judgment call already made in payout-ledger.ts.
 */
export async function loadOrderLedger(storeId: string): Promise<OrderEvent[]> {
  const rows = await prisma.rawOrder.findMany({ where: { storeId }, orderBy: { receivedAt: "desc" } });

  const seen = new Set<string>();
  const events: OrderEvent[] = [];
  for (const row of rows) {
    if (seen.has(row.shopifyId)) continue;
    seen.add(row.shopifyId);
    events.push(...orderEventsFromRaw(row.payload as Record<string, unknown>));
  }

  return events;
}
