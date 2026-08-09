import { prisma } from "../db";
import { add, minorUnits, subtract, type MinorUnits } from "../money";
import { loadReconciledPayouts, type ReconciledPayout } from "./payout-ledger";

export interface CashflowStatement {
  /** "YYYY-MM", UTC. */
  month: string;
  currency: string | null;
  cashIn: MinorUnits;
  cashOut: MinorUnits;
  netCashFlow: MinorUnits;
  payoutCount: number;
  billsPaidCount: number;
}

/**
 * Pure arithmetic core — no DB access, unit-tested directly.
 *
 * cashIn deliberately uses each payout's `amount` (what Shopify actually
 * deposited), never `computedTotal` (the reconciled figure P&L uses). These
 * normally match, but diverge exactly when a payout is unexplained — and
 * cash that hit the bank doesn't wait for reconciliation to be "real," so
 * Cashflow shouldn't inherit P&L's residual-warning mechanics at all.
 *
 * cashOut uses bills' paidOn (cash basis) — the counterpart to P&L's
 * incurredOn (accrual basis); this is what makes the two statements
 * genuinely different rather than redundant.
 */
export function computeCashflow(
  month: string,
  currency: string | null,
  monthPayouts: ReconciledPayout[],
  paidBillAmounts: MinorUnits[],
): CashflowStatement {
  const cashIn = add(...monthPayouts.map((p) => p.payout.amount));
  const cashOut = add(...paidBillAmounts);
  const netCashFlow = subtract(cashIn, cashOut);

  return {
    month,
    currency,
    cashIn,
    cashOut,
    netCashFlow,
    payoutCount: monthPayouts.length,
    billsPaidCount: paidBillAmounts.length,
  };
}

export async function buildCashflow(storeId: string, now = new Date()): Promise<CashflowStatement> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const month = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`;

  const [reconciledPayouts, paidBills] = await Promise.all([
    loadReconciledPayouts(storeId),
    prisma.bill.findMany({ where: { storeId, status: "paid", paidOn: { gte: monthStart, lt: monthEnd } } }),
  ]);

  const monthPayouts = reconciledPayouts.filter((p) => p.payout.date >= monthStart && p.payout.date < monthEnd);
  const currency = monthPayouts[0]?.payout.currency ?? null;
  const paidBillAmounts = paidBills.map((bill) => minorUnits(bill.amount));

  return computeCashflow(month, currency, monthPayouts, paidBillAmounts);
}
