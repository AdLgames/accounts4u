import { describe, expect, it } from "vitest";
import { computeCashflow } from "../../lib/dashboard/cashflow";
import type { ReconciledPayout } from "../../lib/dashboard/payout-ledger";
import { minorUnits } from "../../lib/money";
import type { PayoutBreakdown } from "../../lib/recon/types";

function reconciled(id: string, depositedAmount: number, breakdownOverrides: Partial<PayoutBreakdown>): ReconciledPayout {
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
      computedTotal: minorUnits(depositedAmount),
      residual: minorUnits(0),
      isExplained: true,
      multiCurrencyWarning: false,
      merchantRemittedTaxOrderIds: [],
      platformRemittedTaxOrderIds: [],
      transactionCount: 0,
      ...breakdownOverrides,
    },
  };
}

describe("computeCashflow", () => {
  it("uses payout.amount for cashIn, not computedTotal, when a payout is unexplained", () => {
    const payout = reconciled("p1", 9500, { computedTotal: minorUnits(9700), residual: minorUnits(200), isExplained: false });
    const statement = computeCashflow("2026-07", "GBP", [payout], []);
    expect(statement.cashIn).toBe(9500); // deposited, not the reconciled 9700
  });

  it("sums cash out from paid bill amounts (already filtered to the period by paidOn upstream)", () => {
    const payout = reconciled("p1", 10000, {});
    const statement = computeCashflow("2026-07", "GBP", [payout], [minorUnits(1000), minorUnits(500)]);
    expect(statement.cashOut).toBe(1500);
    expect(statement.netCashFlow).toBe(8500);
    expect(statement.billsPaidCount).toBe(2);
  });

  it("renders zeroed-out for a period with no payouts and no paid bills", () => {
    const statement = computeCashflow("2026-07", null, [], []);
    expect(statement.cashIn).toBe(0);
    expect(statement.cashOut).toBe(0);
    expect(statement.netCashFlow).toBe(0);
  });
});
