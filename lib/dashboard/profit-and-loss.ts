import { prisma } from "../db";
import { add, minorUnits, subtract, type MinorUnits } from "../money";
import { computeCogs } from "./cogs";
import { loadReconciledPayouts, type ReconciledPayout } from "./payout-ledger";

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
  /** % of net cash from payouts this month — an estimate, not tax advice, same framing as PLAN.md's original tax set-aside. */
  taxSetAside: MinorUnits;

  payoutCount: number;
  unexplainedPayoutCount: number;
  /** Sum of |residual| across unexplained payouts this month — surfaced as a standalone warning, never netted into netProfit. */
  unexplainedResidual: MinorUnits;
}

/**
 * Pure arithmetic core — no DB access, unit-tested directly. netProfit is
 * always derived from each payout's reconciled `computedTotal` (never a
 * hand-assembled revenue-minus-deductions formula), so an unexplained
 * payout's residual can never silently vanish into the bottom line — see
 * lib/recon/explain-payout.ts's own comment on why. The category totals
 * (revenue, refunds, fees, chargebacks, adjustmentsAndReserves) are
 * display-only line items, same caveat as PayoutBreakdown's fields.
 */
export function computeProfitAndLoss(
  month: string,
  currency: string | null,
  monthPayouts: ReconciledPayout[],
  expenses: ExpenseLine[],
  cogs: MinorUnits,
  taxSetAsidePercent: number,
): ProfitAndLossStatement {
  let revenue = minorUnits(0);
  let refunds = minorUnits(0);
  let fees = minorUnits(0);
  let chargebacks = minorUnits(0);
  let adjustmentsAndReserves = minorUnits(0);
  let netTotal = minorUnits(0);
  let unexplainedPayoutCount = 0;
  let unexplainedResidual = minorUnits(0);

  for (const { breakdown } of monthPayouts) {
    revenue = add(revenue, breakdown.grossSales);
    refunds = add(refunds, breakdown.refunds);
    fees = add(fees, breakdown.fees);
    chargebacks = add(chargebacks, breakdown.chargebacks);
    adjustmentsAndReserves = add(adjustmentsAndReserves, breakdown.adjustments, breakdown.reserves, breakdown.other);
    netTotal = add(netTotal, breakdown.computedTotal);
    if (!breakdown.isExplained) {
      unexplainedPayoutCount++;
      unexplainedResidual = add(unexplainedResidual, minorUnits(Math.abs(breakdown.residual)));
    }
  }

  const netSales = subtract(revenue, refunds);
  const grossProfit = subtract(netSales, cogs);

  const expensesByCategory = new Map<string, MinorUnits>();
  for (const expense of expenses) {
    expensesByCategory.set(expense.category, add(expensesByCategory.get(expense.category) ?? minorUnits(0), expense.amount));
  }
  const operatingExpenses = [...expensesByCategory.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
  const operatingExpensesTotal = add(...operatingExpenses.map((e) => e.amount));

  const netProfit = subtract(netTotal, add(cogs, operatingExpensesTotal));
  const taxSetAside = minorUnits(Math.round((netTotal * taxSetAsidePercent) / 100));

  return {
    month,
    currency,
    revenue,
    refunds,
    netSales,
    cogs,
    grossProfit,
    operatingExpenses,
    operatingExpensesTotal,
    fees,
    chargebacks,
    adjustmentsAndReserves,
    netProfit,
    taxSetAside,
    payoutCount: monthPayouts.length,
    unexplainedPayoutCount,
    unexplainedResidual,
  };
}

/**
 * "This month" is defined by payout date, not order date — orders placed
 * this month might not actually be paid out until next month, and fees/
 * refunds only exist in payout data, not order data (same reasoning the old
 * Overview screen used). Operating expenses use a Bill's incurredOn (accrual
 * basis) — see cashflow.ts for the paidOn (cash basis) counterpart.
 */
export async function buildProfitAndLoss(storeId: string, now = new Date()): Promise<ProfitAndLossStatement> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const month = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`;

  const [settings, reconciledPayouts] = await Promise.all([
    prisma.storeSettings.upsert({ where: { storeId }, create: { storeId }, update: {} }),
    loadReconciledPayouts(storeId),
  ]);

  const monthPayouts = reconciledPayouts.filter((p) => p.payout.date >= monthStart && p.payout.date < monthEnd);
  const currency = monthPayouts[0]?.payout.currency ?? null;

  const orderIdsThisMonth = new Set<string>();
  for (const { transactions } of monthPayouts) {
    for (const txn of transactions) {
      if (txn.sourceOrderId) orderIdsThisMonth.add(txn.sourceOrderId);
    }
  }
  const cogs = await computeCogs(storeId, orderIdsThisMonth);

  const bills = await prisma.bill.findMany({ where: { storeId, incurredOn: { gte: monthStart, lt: monthEnd } } });
  const expenses: ExpenseLine[] = bills.map((bill) => ({ category: bill.category, amount: minorUnits(bill.amount) }));

  return computeProfitAndLoss(month, currency, monthPayouts, expenses, cogs, settings.taxSetAsidePercent);
}
