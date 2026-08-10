import { summarizeOrderEvents } from "../recon/order-financials";
import { prisma } from "../db";
import { add, minorUnits, subtract, type MinorUnits } from "../money";
import { loadOrderLedger } from "./order-ledger";

export interface BalanceSheetSnapshot {
  asOf: Date;
  currency: string | null;

  /**
   * Lifetime order revenue (net of refunds) minus lifetime bills paid — the
   * same gateway-agnostic source P&L/Cashflow use, not Shopify Payments
   * payout deposits. An ESTIMATE, not a real bank balance: no bank
   * connection exists, and this doesn't net out payment processing fees
   * (Shopify only exposes those for Shopify Payments, not other gateways).
   */
  cashEstimate: MinorUnits;
  /** Lifetime net sales × tax set-aside % — an ESTIMATE, not tax advice. Same figure P&L's "set aside for tax" is built from each month, so the two reconcile by construction instead of drifting apart. */
  taxReserveOwed: MinorUnits;
  unpaidBills: MinorUnits;

  /** = cashEstimate. Deliberately the ONLY asset line — no accounts receivable, no inventory valuation, since neither is tracked anywhere in this app. */
  totalAssets: MinorUnits;
  /** = unpaidBills + taxReserveOwed. */
  totalLiabilities: MinorUnits;
  /** Plug: totalAssets - totalLiabilities. Not an independently tracked figure. */
  equity: MinorUnits;
}

/**
 * Pure arithmetic core — no DB access, unit-tested directly. Point-in-time
 * snapshot (as of `asOf`), not period-scoped like P&L/Cashflow — a balance
 * sheet describes a moment, not a window.
 */
export function computeBalanceSheet(
  asOf: Date,
  currency: string | null,
  lifetimeNetSales: MinorUnits,
  paidBillAmounts: MinorUnits[],
  unpaidBillAmounts: MinorUnits[],
  taxSetAsidePercent: number,
): BalanceSheetSnapshot {
  const lifetimeBillsPaid = add(...paidBillAmounts);
  const cashEstimate = subtract(lifetimeNetSales, lifetimeBillsPaid);

  const taxReserveOwed = minorUnits(Math.round((lifetimeNetSales * taxSetAsidePercent) / 100));

  const unpaidBills = add(...unpaidBillAmounts);

  const totalAssets = cashEstimate;
  const totalLiabilities = add(unpaidBills, taxReserveOwed);
  const equity = subtract(totalAssets, totalLiabilities);

  return { asOf, currency, cashEstimate, taxReserveOwed, unpaidBills, totalAssets, totalLiabilities, equity };
}

export async function buildBalanceSheet(storeId: string, now = new Date()): Promise<BalanceSheetSnapshot> {
  const [settings, orderLedger, paidBills, unpaidBills] = await Promise.all([
    prisma.storeSettings.upsert({ where: { storeId }, create: { storeId }, update: {} }),
    loadOrderLedger(storeId),
    prisma.bill.findMany({ where: { storeId, status: "paid", paidOn: { lte: now } } }),
    prisma.bill.findMany({ where: { storeId, status: "unpaid" } }),
  ]);

  const eventsToDate = orderLedger.filter((event) => event.processedAt <= now);
  const currency = eventsToDate[0]?.currency ?? null;
  const lifetimeNetSales = summarizeOrderEvents(eventsToDate).netSales;

  return computeBalanceSheet(
    now,
    currency,
    lifetimeNetSales,
    paidBills.map((bill) => minorUnits(bill.amount)),
    unpaidBills.map((bill) => minorUnits(bill.amount)),
    settings.taxSetAsidePercent,
  );
}
