import { summarizeOrderEvents, type OrderEvent } from "../recon/order-financials";
import { prisma } from "../db";
import { add, minorUnits, subtract, type MinorUnits } from "../money";
import { loadOrderLedger } from "./order-ledger";

export interface CashflowStatement {
  /** "YYYY-MM", UTC. */
  month: string;
  currency: string | null;
  cashIn: MinorUnits;
  cashOut: MinorUnits;
  netCashFlow: MinorUnits;
  saleCount: number;
  billsPaidCount: number;
}

/**
 * Pure arithmetic core — no DB access, unit-tested directly.
 *
 * cashIn comes from order totals (same gateway-agnostic source as P&L's
 * revenue) rather than Shopify Payments' balance-transaction ledger, which
 * only exists for stores with Shopify Payments activated. This is a
 * deliberate simplification: it doesn't net out payment processing fees
 * (unlike Shopify Payments deposits, a Stripe/PayPal/cash sale has no
 * fee data available via Shopify's API at all), so cashIn is closer to
 * "money that changed hands" than "money that landed in the bank" — the
 * Payouts tab is still the place to see real Shopify Payments deposits.
 *
 * cashOut uses bills' paidOn (cash basis) — the counterpart to P&L's
 * incurredOn (accrual basis).
 */
export function computeCashflow(month: string, currency: string | null, monthOrderEvents: OrderEvent[], paidBillAmounts: MinorUnits[]): CashflowStatement {
  const orderTotals = summarizeOrderEvents(monthOrderEvents);
  const cashOut = add(...paidBillAmounts);
  const netCashFlow = subtract(orderTotals.netSales, cashOut);

  return {
    month,
    currency,
    cashIn: orderTotals.netSales,
    cashOut,
    netCashFlow,
    saleCount: orderTotals.saleCount,
    billsPaidCount: paidBillAmounts.length,
  };
}

export async function buildCashflow(storeId: string, now = new Date()): Promise<CashflowStatement> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const month = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`;

  const [orderLedger, paidBills] = await Promise.all([
    loadOrderLedger(storeId),
    prisma.bill.findMany({ where: { storeId, status: "paid", paidOn: { gte: monthStart, lt: monthEnd } } }),
  ]);

  const monthOrderEvents = orderLedger.filter((event) => event.processedAt >= monthStart && event.processedAt < monthEnd);
  const currency = monthOrderEvents[0]?.currency ?? null;
  const paidBillAmounts = paidBills.map((bill) => minorUnits(bill.amount));

  return computeCashflow(month, currency, monthOrderEvents, paidBillAmounts);
}
