import { describe, expect, it } from "vitest";
import { computeProfitAndLoss, type ExpenseLine } from "../../lib/dashboard/profit-and-loss";
import type { ReconciledPayout } from "../../lib/dashboard/payout-ledger";
import { minorUnits } from "../../lib/money";
import type { PayoutBreakdown } from "../../lib/recon/types";

function breakdown(overrides: Partial<PayoutBreakdown>): PayoutBreakdown {
  return {
    payoutId: "p1",
    currency: "GBP",
    deposited: minorUnits(0),
    grossSales: minorUnits(0),
    refunds: minorUnits(0),
    fees: minorUnits(0),
    chargebacks: minorUnits(0),
    adjustments: minorUnits(0),
    reserves: minorUnits(0),
    other: minorUnits(0),
    computedTotal: minorUnits(0),
    residual: minorUnits(0),
    isExplained: true,
    multiCurrencyWarning: false,
    merchantRemittedTaxOrderIds: [],
    platformRemittedTaxOrderIds: [],
    transactionCount: 0,
    ...overrides,
  };
}

function reconciled(id: string, overrides: Partial<PayoutBreakdown>): ReconciledPayout {
  return {
    shopifyId: id,
    payout: { id, status: "paid", currency: "GBP", amount: overrides.deposited ?? minorUnits(0), date: new Date("2026-07-15") },
    transactions: [],
    breakdown: breakdown({ payoutId: id, ...overrides }),
  };
}

describe("computeProfitAndLoss", () => {
  it("derives netProfit from computedTotal, not a hand-assembled formula", () => {
    const payout = reconciled("p1", {
      grossSales: minorUnits(10000),
      refunds: minorUnits(1000),
      fees: minorUnits(300),
      computedTotal: minorUnits(8700),
      deposited: minorUnits(8700),
      isExplained: true,
    });
    const statement = computeProfitAndLoss("2026-07", "GBP", [payout], [], minorUnits(0), 25);
    expect(statement.netProfit).toBe(8700);
    expect(statement.netSales).toBe(9000); // grossSales - refunds, display only
  });

  it("keeps an unexplained payout's residual out of netProfit, surfaced separately", () => {
    const payout = reconciled("p1", {
      grossSales: minorUnits(10000),
      computedTotal: minorUnits(9700),
      deposited: minorUnits(9500), // 200 unexplained
      residual: minorUnits(200),
      isExplained: false,
    });
    const statement = computeProfitAndLoss("2026-07", "GBP", [payout], [], minorUnits(0), 25);
    expect(statement.netProfit).toBe(9700); // still from computedTotal, not deposited
    expect(statement.unexplainedPayoutCount).toBe(1);
    expect(statement.unexplainedResidual).toBe(200);
  });

  it("subtracts cogs and grouped operating expenses from netProfit", () => {
    const payout = reconciled("p1", { computedTotal: minorUnits(10000), deposited: minorUnits(10000) });
    const expenses: ExpenseLine[] = [
      { category: "Advertising", amount: minorUnits(1000) },
      { category: "Advertising", amount: minorUnits(500) },
      { category: "Rent", amount: minorUnits(2000) },
    ];
    const statement = computeProfitAndLoss("2026-07", "GBP", [payout], expenses, minorUnits(3000), 25);

    expect(statement.operatingExpenses).toEqual([
      { category: "Rent", amount: 2000 },
      { category: "Advertising", amount: 1500 },
    ]);
    expect(statement.operatingExpensesTotal).toBe(3500);
    expect(statement.netProfit).toBe(10000 - 3000 - 3500);
  });

  it("computes tax set-aside as a percent of net cash from payouts", () => {
    const payout = reconciled("p1", { computedTotal: minorUnits(10000), deposited: minorUnits(10000) });
    const statement = computeProfitAndLoss("2026-07", "GBP", [payout], [], minorUnits(0), 25);
    expect(statement.taxSetAside).toBe(2500);
  });

  it("renders zeroed-out rather than throwing for a month with no payouts", () => {
    const statement = computeProfitAndLoss("2026-07", null, [], [], minorUnits(0), 25);
    expect(statement.netProfit).toBe(0);
    expect(statement.payoutCount).toBe(0);
    expect(statement.operatingExpenses).toEqual([]);
  });
});
