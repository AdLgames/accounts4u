import { categorizeTransactions } from "../recon/categorize-transactions";
import { prisma } from "../db";
import { add, minorUnits, subtract, type MinorUnits } from "../money";
import { computeCogs } from "./cogs";
import { loadTransactionLedger, type LedgerEntry } from "./transaction-ledger";

export interface ExpenseLine {
  category: string;
  amount: MinorUnits;
}

export interface ProfitAndLossStatement {
  /** "YYYY-MM", UTC. */
  month: string;
  currency: string | null;

  revenue: MinorUnits;
  refunds: MinorUnits;
  /** revenue - refunds. Display line — not the reconciliation source, see netProfit's comment. */
  netSales: MinorUnits;

  cogs: MinorUnits;
  grossProfit: MinorUnits;

  /** Bills grouped by category, incurredOn falling in this month — accrual basis. */
  operatingExpenses: ExpenseLine[];
  operatingExpensesTotal: MinorUnits;

  fees: MinorUnits;
  chargebacks: MinorUnits;
  adjustmentsAndReserves: MinorUnits;

  netProfit: MinorUnits;
  /** % of net cash from transactions this month — an estimate, not tax advice, same framing as PLAN.md's original tax set-aside. */
  taxSetAside: MinorUnits;

  transactionCount: number;
  /** Sum of net for this month's transactions not yet bundled into a payout — informational, not a warning: P&L now recognizes revenue at capture, which can run ahead of what's actually reached the bank. */
  pendingCashAmount: MinorUnits;
}

/**
 * Pure arithmetic core — no DB access, unit-tested directly. netProfit is
 * always derived from categorizeTransactions' netTotal (sum of each
 * transaction's `net`), never a hand-assembled revenue-minus-deductions
 * formula — same rule lib/recon/explain-payout.ts enforces at the payout
 * level, applied here to a plain calendar-month grouping instead. There is
 * no "unexplained residual" concept at this level (unlike a payout, a month
 * of transactions has no external deposit to check against) — see
 * pendingCashAmount instead, which is informational, not a warning.
 */
export function computeProfitAndLoss(
  month: string,
  currency: string | null,
  monthEntries: LedgerEntry[],
  expenses: ExpenseLine[],
  cogs: MinorUnits,
  taxSetAsidePercent: number,
): ProfitAndLossStatement {
  const totals = categorizeTransactions(monthEntries.map((entry) => entry.transaction));
  const pendingCashAmount = categorizeTransactions(
    monthEntries.filter((entry) => entry.payoutId === null).map((entry) => entry.transaction),
  ).netTotal;

  const netSales = subtract(totals.grossSales, totals.refunds);
  const grossProfit = subtract(netSales, cogs);

  const expensesByCategory = new Map<string, MinorUnits>();
  for (const expense of expenses) {
    expensesByCategory.set(expense.category, add(expensesByCategory.get(expense.category) ?? minorUnits(0), expense.amount));
  }
  const operatingExpenses = [...expensesByCategory.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
  const operatingExpensesTotal = add(...operatingExpenses.map((e) => e.amount));

  const netProfit = subtract(totals.netTotal, add(cogs, operatingExpensesTotal));
  const taxSetAside = minorUnits(Math.round((totals.netTotal * taxSetAsidePercent) / 100));
  const adjustmentsAndReserves = add(totals.adjustments, totals.reserves, totals.other);

  return {
    month,
    currency,
    revenue: totals.grossSales,
    refunds: totals.refunds,
    netSales,
    cogs,
    grossProfit,
    operatingExpenses,
    operatingExpensesTotal,
    fees: totals.fees,
    chargebacks: totals.chargebacks,
    adjustmentsAndReserves,
    netProfit,
    taxSetAside,
    transactionCount: monthEntries.length,
    pendingCashAmount,
  };
}

/**
 * "This month" is now defined by when Shopify captured the customer's
 * payment (each transaction's own processedAt), not by payout date — a
 * merchant sees revenue the moment it's earned, not weeks later once
 * Shopify batches it into a bank deposit. Operating expenses still use a
 * Bill's incurredOn (accrual basis) — see cashflow.ts for the paidOn (cash
 * basis) counterpart.
 */
export async function buildProfitAndLoss(storeId: string, now = new Date()): Promise<ProfitAndLossStatement> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const month = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`;

  const [settings, ledger] = await Promise.all([
    prisma.storeSettings.upsert({ where: { storeId }, create: { storeId }, update: {} }),
    loadTransactionLedger(storeId),
  ]);

  const monthEntries = ledger.filter(
    (entry) => entry.transaction.processedAt >= monthStart && entry.transaction.processedAt < monthEnd,
  );
  const currency = monthEntries[0]?.transaction.currency ?? null;

  const orderIdsThisMonth = new Set<string>();
  for (const { transaction } of monthEntries) {
    if (transaction.sourceOrderId) orderIdsThisMonth.add(transaction.sourceOrderId);
  }
  const cogs = await computeCogs(storeId, orderIdsThisMonth);

  const bills = await prisma.bill.findMany({ where: { storeId, incurredOn: { gte: monthStart, lt: monthEnd } } });
  const expenses: ExpenseLine[] = bills.map((bill) => ({ category: bill.category, amount: minorUnits(bill.amount) }));

  return computeProfitAndLoss(month, currency, monthEntries, expenses, cogs, settings.taxSetAsidePercent);
}
