import { summarizeOrderEvents, type OrderEvent } from "../recon/order-financials";
import { prisma } from "../db";
import { add, minorUnits, subtract, type MinorUnits } from "../money";
import { loadOrderLedger } from "./order-ledger";
import type { ExpenseLine } from "./profit-and-loss";

export interface CashflowWeek {
  /** Monday of this week, "YYYY-MM-DD", UTC. The most recent week is current-week-to-date, not a full 7 days. */
  weekStart: string;
  currency: string | null;
  /** From order totals — same gateway-agnostic source as P&L's revenue (see computeCashflowWeek's doc comment). */
  cashIn: MinorUnits;
  /** Currently always a single "Revenue" line — kept as a category breakdown, not a flat number, so a future non-order cash-in source (e.g. a manual entry) has somewhere to add its own line without a shape change. */
  cashInByCategory: ExpenseLine[];
  /** Paid bills (paidOn falling in this week), grouped by Bill.category. */
  cashOut: MinorUnits;
  cashOutByCategory: ExpenseLine[];
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
export function computeCashflowWeek(
  weekStart: string,
  currency: string | null,
  weekOrderEvents: OrderEvent[],
  weekPaidBills: ExpenseLine[],
): CashflowWeek {
  const orderTotals = summarizeOrderEvents(weekOrderEvents);
  const cashIn = orderTotals.netSales;
  const cashInByCategory: ExpenseLine[] = cashIn !== 0 ? [{ category: "Revenue", amount: cashIn }] : [];

  const cashOutByCategoryMap = new Map<string, MinorUnits>();
  for (const bill of weekPaidBills) {
    cashOutByCategoryMap.set(bill.category, add(cashOutByCategoryMap.get(bill.category) ?? minorUnits(0), bill.amount));
  }
  const cashOutByCategory = [...cashOutByCategoryMap.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
  const cashOut = add(...cashOutByCategory.map((line) => line.amount));

  return {
    weekStart,
    currency,
    cashIn,
    cashInByCategory,
    cashOut,
    cashOutByCategory,
    netCashFlow: subtract(cashIn, cashOut),
    saleCount: orderTotals.saleCount,
    billsPaidCount: weekPaidBills.length,
  };
}

/** Monday of the UTC week containing `date`. */
function mondayOf(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceMonday = (d.getUTCDay() + 6) % 7; // getUTCDay(): 0=Sun..6=Sat
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d;
}

function weekWindow(now: Date, weeksAgo: number): { weekStart: Date; weekEnd: Date; label: string } {
  const weekStart = mondayOf(now);
  weekStart.setUTCDate(weekStart.getUTCDate() - weeksAgo * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  return { weekStart, weekEnd, label: weekStart.toISOString().slice(0, 10) };
}

const TRAILING_WEEKS = 13;

/**
 * Loads the store's order/bill history once, then slices it per week —
 * same "load once, slice the pure core" pattern as
 * profit-and-loss.ts's buildProfitAndLossTrend. Historical only (no
 * forward forecast, per explicit user direction) — 13 trailing weeks
 * ending with the current, partial week. Weeks are Monday-Sunday, UTC.
 */
export async function buildCashflowTrailing13Weeks(storeId: string, now = new Date()): Promise<CashflowWeek[]> {
  const { weekStart: earliestStart } = weekWindow(now, TRAILING_WEEKS - 1);

  const [orderLedger, paidBills] = await Promise.all([
    loadOrderLedger(storeId),
    prisma.bill.findMany({ where: { storeId, status: "paid", paidOn: { gte: earliestStart } } }),
  ]);

  const weeks: CashflowWeek[] = [];
  for (let weeksAgo = TRAILING_WEEKS - 1; weeksAgo >= 0; weeksAgo--) {
    const { weekStart, weekEnd, label } = weekWindow(now, weeksAgo);

    const weekOrderEvents = orderLedger.filter((event) => event.processedAt >= weekStart && event.processedAt < weekEnd);
    const weekPaidBills = paidBills
      .filter((bill) => bill.paidOn !== null && bill.paidOn >= weekStart && bill.paidOn < weekEnd)
      .map((bill) => ({ category: bill.category, amount: minorUnits(bill.amount) }));
    const currency = weekOrderEvents[0]?.currency ?? null;

    weeks.push(computeCashflowWeek(label, currency, weekOrderEvents, weekPaidBills));
  }

  return weeks;
}
