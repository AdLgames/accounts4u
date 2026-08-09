import { prisma } from "../db";
import { add, minorUnits, subtract, type MinorUnits } from "../money";
import { loadReconciledPayouts, type ReconciledPayout } from "./payout-ledger";

export interface BalanceSheetSnapshot {
  asOf: Date;
  currency: string | null;

  /** Lifetime payouts received minus lifetime bills paid — an ESTIMATE, not a real bank balance (no bank connection exists). */
  cashEstimate: MinorUnits;
  /** Lifetime reconciled payout total × tax set-aside % — an ESTIMATE, not tax advice. */
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
  allPayouts: ReconciledPayout[],
  paidBillAmounts: MinorUnits[],
  unpaidBillAmounts: MinorUnits[],
  taxSetAsidePercent: number,
): BalanceSheetSnapshot {
  const lifetimePayoutsIn = add(...allPayouts.map((p) => p.payout.amount));
  const lifetimeBillsPaid = add(...paidBillAmounts);
  const cashEstimate = subtract(lifetimePayoutsIn, lifetimeBillsPaid);

  const lifetimeNetTotal = add(...allPayouts.map((p) => p.breakdown.computedTotal));
  const taxReserveOwed = minorUnits(Math.round((lifetimeNetTotal * taxSetAsidePercent) / 100));

  const unpaidBills = add(...unpaidBillAmounts);

  const totalAssets = cashEstimate;
  const totalLiabilities = add(unpaidBills, taxReserveOwed);
  const equity = subtract(totalAssets, totalLiabilities);

  return { asOf, currency, cashEstimate, taxReserveOwed, unpaidBills, totalAssets, totalLiabilities, equity };
}

export async function buildBalanceSheet(storeId: string, now = new Date()): Promise<BalanceSheetSnapshot> {
  const [settings, allPayouts, paidBills, unpaidBills] = await Promise.all([
    prisma.storeSettings.upsert({ where: { storeId }, create: { storeId }, update: {} }),
    loadReconciledPayouts(storeId),
    prisma.bill.findMany({ where: { storeId, status: "paid", paidOn: { lte: now } } }),
    prisma.bill.findMany({ where: { storeId, status: "unpaid" } }),
  ]);

  const currency = allPayouts[0]?.payout.currency ?? null;

  return computeBalanceSheet(
    now,
    currency,
    allPayouts,
    paidBills.map((bill) => minorUnits(bill.amount)),
    unpaidBills.map((bill) => minorUnits(bill.amount)),
    settings.taxSetAsidePercent,
  );
}
