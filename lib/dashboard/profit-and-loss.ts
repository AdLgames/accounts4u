import { categorizeTransactions } from "../recon/categorize-transactions";
import { summarizeOrderEvents, type OrderEvent } from "../recon/order-financials";
import { prisma } from "../db";
import { add, minorUnits, subtract, type MinorUnits } from "../money";
import { computeCogs } from "./cogs";
import { loadOrderLedger } from "./order-ledger";
import { loadTransactionLedger, type LedgerEntry } from "./transaction-ledger";

export interface ExpenseLine {
  category: string;
  amount: MinorUnits;
}

export interface ProfitAndLossStatement {
  /** "YYYY-MM", UTC. */
  month: string;
  currency: string | null;

  /** From order totals — works for every payment gateway (Shopify Payments, Stripe, PayPal, cash/manual), not just Shopify Payments. */
  revenue: MinorUnits;
  refunds: MinorUnits;
  /** revenue - refunds. */
  netSales: MinorUnits;

  cogs: MinorUnits;
  grossProfit: MinorUnits;

  /** Bills grouped by category, incurredOn falling in this month — accrual basis. */
  operatingExpenses: ExpenseLine[];
  operatingExpensesTotal: MinorUnits;

  /** From Shopify Payments balance transactions — £0 for stores using a different gateway, since Shopify doesn't expose fee data for other processors. */
  fees: MinorUnits;
  chargebacks: MinorUnits;
  /** Adjustments/reserves/other from Shopify Payments — informational only, not subtracted from netProfit (their sign isn't reliably known, see categorize-transactions.ts). */
  otherPaymentActivity: MinorUnits;

  /** netSales - fees - chargebacks - cogs - operatingExpensesTotal. */
  netProfit: MinorUnits;
  /** % of net sales — an estimate, not tax advice, same framing as PLAN.md's original tax set-aside. */
  taxSetAside: MinorUnits;

  saleCount: number;
  /** Sum of net for this month's Shopify Payments transactions not yet paid out — £0 (not an error) for stores not using Shopify Payments. Informational, not a warning. */
  pendingCashAmount: MinorUnits;
}

/**
 * Pure arithmetic core — no DB access, unit-tested directly. Revenue/
 * refunds/netSales come from order data (monthOrderEvents), gateway-
 * agnostic by construction. fees/chargebacks/otherPaymentActivity are an
 * enrichment layer from Shopify Payments balance transactions
 * (monthPaymentEntries) when available — empty for stores on a different
 * gateway, never an error. netProfit only ever subtracts fees/chargebacks
 * (unambiguously costs) alongside cogs/operatingExpensesTotal; adjustments/
 * reserves/other are shown for transparency but not folded into the
 * bottom line, since their sign isn't independently verified.
 */
export function computeProfitAndLoss(
  month: string,
  currency: string | null,
  monthOrderEvents: OrderEvent[],
  monthPaymentEntries: LedgerEntry[],
  expenses: ExpenseLine[],
  cogs: MinorUnits,
  taxSetAsidePercent: number,
): ProfitAndLossStatement {
  const orderTotals = summarizeOrderEvents(monthOrderEvents);
  const paymentTotals = categorizeTransactions(monthPaymentEntries.map((entry) => entry.transaction));
  const pendingCashAmount = categorizeTransactions(
    monthPaymentEntries.filter((entry) => entry.payoutId === null).map((entry) => entry.transaction),
  ).netTotal;

  const netSales = orderTotals.netSales;
  const grossProfit = subtract(netSales, cogs);

  const expensesByCategory = new Map<string, MinorUnits>();
  for (const expense of expenses) {
    expensesByCategory.set(expense.category, add(expensesByCategory.get(expense.category) ?? minorUnits(0), expense.amount));
  }
  const operatingExpenses = [...expensesByCategory.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
  const operatingExpensesTotal = add(...operatingExpenses.map((e) => e.amount));

  const otherPaymentActivity = add(paymentTotals.adjustments, paymentTotals.reserves, paymentTotals.other);
  const netProfit = subtract(netSales, add(paymentTotals.fees, paymentTotals.chargebacks, cogs, operatingExpensesTotal));
  const taxSetAside = minorUnits(Math.round((netSales * taxSetAsidePercent) / 100));

  return {
    month,
    currency,
    revenue: orderTotals.grossSales,
    refunds: orderTotals.refunds,
    netSales,
    cogs,
    grossProfit,
    operatingExpenses,
    operatingExpensesTotal,
    fees: paymentTotals.fees,
    chargebacks: paymentTotals.chargebacks,
    otherPaymentActivity,
    netProfit,
    taxSetAside,
    saleCount: orderTotals.saleCount,
    pendingCashAmount,
  };
}

/**
 * "This month" is defined by when the order (or its refund) was processed
 * — the same date every merchant sees on the order itself, regardless of
 * payment gateway. Operating expenses still use a Bill's incurredOn
 * (accrual basis) — see cashflow.ts for the paidOn (cash basis) counterpart.
 */
export async function buildProfitAndLoss(storeId: string, now = new Date()): Promise<ProfitAndLossStatement> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const month = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`;

  const [settings, orderLedger, paymentLedger] = await Promise.all([
    prisma.storeSettings.upsert({ where: { storeId }, create: { storeId }, update: {} }),
    loadOrderLedger(storeId),
    loadTransactionLedger(storeId),
  ]);

  const monthOrderEvents = orderLedger.filter((event) => event.processedAt >= monthStart && event.processedAt < monthEnd);
  const monthPaymentEntries = paymentLedger.filter(
    (entry) => entry.transaction.processedAt >= monthStart && entry.transaction.processedAt < monthEnd,
  );
  const currency = monthOrderEvents[0]?.currency ?? monthPaymentEntries[0]?.transaction.currency ?? null;

  const orderIdsThisMonth = new Set(monthOrderEvents.map((event) => event.orderId));
  const cogs = await computeCogs(storeId, orderIdsThisMonth);

  const bills = await prisma.bill.findMany({ where: { storeId, incurredOn: { gte: monthStart, lt: monthEnd } } });
  const expenses: ExpenseLine[] = bills.map((bill) => ({ category: bill.category, amount: minorUnits(bill.amount) }));

  return computeProfitAndLoss(month, currency, monthOrderEvents, monthPaymentEntries, expenses, cogs, settings.taxSetAsidePercent);
}
