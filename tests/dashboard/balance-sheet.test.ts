import { describe, expect, it } from "vitest";
import { computeBalanceSheet } from "../../lib/dashboard/balance-sheet";
import type { ReconciledPayout } from "../../lib/dashboard/payout-ledger";
import { minorUnits } from "../../lib/money";
import type { PayoutBreakdown } from "../../lib/recon/types";

function reconciled(id: string, depositedAmount: number, computedTotal: number): ReconciledPayout {
  return {
    shopifyId: id,
    payout: { id, status: "paid", currency: "GBP", amount: minorUnits(depositedAmount), date: new Date("2026-07-15") },
    transactions: [],
    breakdown: {
      payoutId: id,
      currency: "GBP",
      deposited: minorUnits(depositedAmount),
      grossSales: minorUnits(0),
      refunds: minorUnits(0),
      fees: minorUnits(0),
      chargebacks: minorUnits(0),
      adjustments: minorUnits(0),
      reserves: minorUnits(0),
      other: minorUnits(0),
      computedTotal: minorUnits(computedTotal),
      residual: minorUnits(computedTotal - depositedAmount),
      isExplained: computedTotal === depositedAmount,
      multiCurrencyWarning: false,
      merchantRemittedTaxOrderIds: [],
      platformRemittedTaxOrderIds: [],
      transactionCount: 0,
    } as PayoutBreakdown,
  };
}

describe("computeBalanceSheet", () => {
  const asOf = new Date("2026-08-01T00:00:00Z");

  it("computes cash as lifetime payouts received minus lifetime bills paid", () => {
    const payouts = [reconciled("p1", 10000, 10000), reconciled("p2", 5000, 5000)];
    const snapshot = computeBalanceSheet(asOf, "GBP", payouts, [minorUnits(2000)], [], 25);
    expect(snapshot.cashEstimate).toBe(15000 - 2000);
    expect(snapshot.totalAssets).toBe(snapshot.cashEstimate);
  });

  it("excludes unpaid bills from cash but includes them as a liability", () => {
    const payouts = [reconciled("p1", 10000, 10000)];
    const snapshot = computeBalanceSheet(asOf, "GBP", payouts, [], [minorUnits(3000)], 0);
    expect(snapshot.cashEstimate).toBe(10000); // unpaid bill doesn't reduce cash
    expect(snapshot.unpaidBills).toBe(3000);
    expect(snapshot.totalLiabilities).toBe(3000);
  });

  it("computes tax reserve owed from lifetime reconciled totals", () => {
    const payouts = [reconciled("p1", 10000, 10000)];
    const snapshot = computeBalanceSheet(asOf, "GBP", payouts, [], [], 25);
    expect(snapshot.taxReserveOwed).toBe(2500);
  });

  it("derives equity as a pure plug (assets - liabilities)", () => {
    const payouts = [reconciled("p1", 10000, 10000)];
    const snapshot = computeBalanceSheet(asOf, "GBP", payouts, [], [minorUnits(1000)], 25);
    expect(snapshot.equity).toBe(snapshot.totalAssets - snapshot.totalLiabilities);
    expect(snapshot.equity).toBe(10000 - (1000 + 2500));
  });

  it("renders zeroed-out with no payouts and no bills", () => {
    const snapshot = computeBalanceSheet(asOf, null, [], [], [], 25);
    expect(snapshot.cashEstimate).toBe(0);
    expect(snapshot.totalAssets).toBe(0);
    expect(snapshot.totalLiabilities).toBe(0);
    expect(snapshot.equity).toBe(0);
  });
});
