import { add, minorUnits, parseDecimal, type MinorUnits } from "../money";

export type OrderEventType = "sale" | "refund";

export interface OrderEvent {
  type: OrderEventType;
  orderId: string;
  /** Always positive. */
  amount: MinorUnits;
  currency: string;
  processedAt: Date;
  gateway: string | null;
}

export interface OrderTotals {
  grossSales: MinorUnits;
  refunds: MinorUnits;
  netSales: MinorUnits;
  saleCount: number;
}

/**
 * Converts a raw Shopify Order REST payload (as stored in raw_orders.payload)
 * into gateway-agnostic financial events -- one "sale" for the order total,
 * one "refund" per entry in the order's refunds array. Works for any
 * payment gateway (Shopify Payments, Stripe, PayPal, cash/manual orders)
 * since it reads straight off the order itself, rather than Shopify
 * Payments' balance-transaction ledger, which only exists for stores that
 * have Shopify Payments activated -- confirmed live this session that a
 * dev store without it active gets a 404 from that entire API namespace.
 *
 * Refund amounts/dates are read from each refund's own transactions array
 * -- not independently verified against a live payload; re-check field
 * names (transactions[].amount, transactions[].kind, processed_at) before
 * fully trusting this in production, per CLAUDE.md's "any bug found
 * becomes a fixture" rule.
 */
export function orderEventsFromRaw(raw: Record<string, unknown>): OrderEvent[] {
  const orderId = String(raw.id);
  const currency = String(raw.currency ?? "");
  const processedAt = new Date(String(raw.processed_at ?? raw.created_at ?? Date.now()));
  const gatewayNames = Array.isArray(raw.payment_gateway_names) ? (raw.payment_gateway_names as unknown[]) : [];
  const gateway = gatewayNames.length > 0 ? String(gatewayNames[0]) : raw.gateway != null ? String(raw.gateway) : null;

  const events: OrderEvent[] = [
    {
      type: "sale",
      orderId,
      amount: parseDecimal(String(raw.total_price ?? raw.current_total_price ?? "0")),
      currency,
      processedAt,
      gateway,
    },
  ];

  const refunds = Array.isArray(raw.refunds) ? (raw.refunds as Record<string, unknown>[]) : [];
  for (const refund of refunds) {
    const transactions = Array.isArray(refund.transactions) ? (refund.transactions as Record<string, unknown>[]) : [];
    let refundAmount = minorUnits(0);
    for (const txn of transactions) {
      if (txn.kind === "void") continue;
      refundAmount = add(refundAmount, parseDecimal(String(txn.amount ?? "0")));
    }
    if (refundAmount === 0) continue;

    events.push({
      type: "refund",
      orderId,
      amount: minorUnits(Math.abs(refundAmount)),
      currency,
      processedAt: new Date(String(refund.processed_at ?? refund.created_at ?? processedAt.toISOString())),
      gateway,
    });
  }

  return events;
}

export function summarizeOrderEvents(events: OrderEvent[]): OrderTotals {
  let grossSales = minorUnits(0);
  let refunds = minorUnits(0);
  let saleCount = 0;

  for (const event of events) {
    if (event.type === "sale") {
      grossSales = add(grossSales, event.amount);
      saleCount++;
    } else {
      refunds = add(refunds, event.amount);
    }
  }

  return { grossSales, refunds, netSales: minorUnits(grossSales - refunds), saleCount };
}
