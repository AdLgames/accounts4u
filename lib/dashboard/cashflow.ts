import { categorizeTransactions } from "../recon/categorize-transactions";
import { prisma } from "../db";
import { add, minorUnits, subtract, type MinorUnits } from "../money";
import { loadTransactionLedger, type LedgerEntry } from "./transaction-ledger";

export interface CashflowStatement {
  /** "YYYY-MM", UTC. */
  month: string;
  currency: string | null;
  cashIn: MinorUnits;
  cashOut: MinorUnits;
  netCashFlow: MinorUnits;
  transactionCount: number;
  billsPaidCount: number;
}

/**
 * Pure arithmetic core — no DB access, unit-tested directly.
 *
 * cashIn is now capture-date-based, same as P&L (lib/dashboard/profit-and-loss.ts)
 * — a deliberate choice: it recognizes money the moment Shopify captures it,
 * not once it's later batched into a bank deposit. This means Cashflow can
 * run ahead of what's actually sitting in the bank; Payouts is still the
 * place to see real deposits.
 *
 * cashOut uses bills' paidOn (cash basis) — the counterpart to P&L's
 * incurredOn (accrual basis).
 */
export function computeCashflow(
  month: string,
  currency: string | null,
  monthEntries: LedgerEntry[],
  paidBillAmounts: MinorUnits[],
): CashflowStatement {
  const cashIn = categorizeTransactions(monthEntries.map((entry) => entry.transaction)).netTotal;
  const cashOut = add(...paidBillAmounts);
  const netCashFlow = subtract(cashIn, cashOut);

  return {
    month,
    currency,
    cashIn,
    cashOut,
    netCashFlow,
    transactionCount: monthEntries.length,
    billsPaidCount: paidBillAmounts.length,
  };
}

export async function buildCashflow(storeId: string, now = new Date()): Promise<CashflowStatement> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const month = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`;

  const [ledger, paidBills] = await Promise.all([
    loadTransactionLedger(storeId),
    prisma.bill.findMany({ where: { storeId, status: "paid", paidOn: { gte: monthStart, lt: monthEnd } } }),
  ]);

  const monthEntries = ledger.filter(
    (entry) => entry.transaction.processedAt >= monthStart && entry.transaction.processedAt < monthEnd,
  );
  const currency = monthEntries[0]?.transaction.currency ?? null;
  const paidBillAmounts = paidBills.map((bill) => minorUnits(bill.amount));

  return computeCashflow(month, currency, monthEntries, paidBillAmounts);
}
