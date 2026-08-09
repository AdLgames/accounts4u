import { categorizeTransactions } from "../recon/categorize-transactions";
import { summarizeOrderEvents, type OrderEvent } from "../recon/order-financials";
import { prisma } from "../db";
import { add, minorUnits, subtract, type MinorUnits } from "../money";
import { computeProductLines, type ProductLine } from "./product-lines";
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
  /** Revenue grouped by each product's revenueCategory (set in Inputs) — empty when nothing's categorized yet, in which case the page just shows the flat Revenue line above. */
  revenueByCategory: ExpenseLine[];
  /** Per-product detail: revenue is from order line items (pre-discount/pre-refund) so it won't exactly match the top-line Revenue figure above (which is the actual payment amount) — expected, not a bug. */
  productLines: ProductLine[];

  /** Bills grouped by category, status=paid with paidOn falling in this month — cash basis by default (most small businesses account for expenses when actually paid, not when billed). */
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
  productLines: ProductLine[],
  taxSetAsidePercent: number,
): ProfitAndLossStatement {
  const orderTotals = summarizeOrderEvents(monthOrderEvents);
  const paymentTotals = categorizeTransactions(monthPaymentEntries.map((entry) => entry.transaction));
  const pendingCashAmount = categorizeTransactions(
    monthPaymentEntries.filter((entry) => entry.payoutId === null).map((entry) => entry.transaction),
  ).netTotal;

  const netSales = orderTotals.netSales;
  const cogs = add(...productLines.map((line) => line.cogs));
  const grossProfit = subtract(netSales, cogs);

  const revenueByCategoryMap = new Map<string, MinorUnits>();
  for (const line of productLines) {
    if (!line.category) continue;
    revenueByCategoryMap.set(line.category, add(revenueByCategoryMap.get(line.category) ?? minorUnits(0), line.revenue));
  }
  const revenueByCategory = [...revenueByCategoryMap.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

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
    revenueByCategory,
    productLines,
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

function monthWindow(now: Date, monthsAgo: number): { monthStart: Date; monthEnd: Date; month: string } {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo + 1, 1));
  const month = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`;
  return { monthStart, monthEnd, month };
}

/**
 * Loads the store's order/payment history once, then slices it per month —
 * not "call buildProfitAndLoss N times", which would reload the same full
 * history N times for no benefit. Returned oldest-first, ending with the
 * current month.
 */
export async function buildProfitAndLossTrend(storeId: string, months: number, now = new Date()): Promise<ProfitAndLossStatement[]> {
  const [settings, orderLedger, paymentLedger] = await Promise.all([
    prisma.storeSettings.upsert({ where: { storeId }, create: { storeId }, update: {} }),
    loadOrderLedger(storeId),
    loadTransactionLedger(storeId),
  ]);

  const statements: ProfitAndLossStatement[] = [];
  for (let monthsAgo = months - 1; monthsAgo >= 0; monthsAgo--) {
    const { monthStart, monthEnd, month } = monthWindow(now, monthsAgo);

    const monthOrderEvents = orderLedger.filter((event) => event.processedAt >= monthStart && event.processedAt < monthEnd);
    const monthPaymentEntries = paymentLedger.filter(
      (entry) => entry.transaction.processedAt >= monthStart && entry.transaction.processedAt < monthEnd,
    );
    const currency = monthOrderEvents[0]?.currency ?? monthPaymentEntries[0]?.transaction.currency ?? null;

    const orderIdsThisMonth = new Set(monthOrderEvents.map((event) => event.orderId));
    const productLines = await computeProductLines(storeId, orderIdsThisMonth);

    // Cash basis by default: an expense counts in the month it was actually
    // paid, not the month it was incurred/billed -- matches how most small
    // businesses (e.g. HMRC's Cash Basis scheme) do their own books.
    const bills = await prisma.bill.findMany({ where: { storeId, status: "paid", paidOn: { gte: monthStart, lt: monthEnd } } });
    const expenses: ExpenseLine[] = bills.map((bill) => ({ category: bill.category, amount: minorUnits(bill.amount) }));

    statements.push(
      computeProfitAndLoss(month, currency, monthOrderEvents, monthPaymentEntries, expenses, productLines, settings.taxSetAsidePercent),
    );
  }

  return statements;
}

/**
 * "This month" is defined by when the order (or its refund) was processed
 * — the same date every merchant sees on the order itself, regardless of
 * payment gateway.
 */
export async function buildProfitAndLoss(storeId: string, now = new Date()): Promise<ProfitAndLossStatement> {
  const [statement] = await buildProfitAndLossTrend(storeId, 1, now);
  return statement;
}
