import { describe, expect, it } from "vitest";
import { computeProfitAndLoss, type ExpenseLine } from "../../lib/dashboard/profit-and-loss";
import type { LedgerEntry } from "../../lib/dashboard/transaction-ledger";
import { minorUnits } from "../../lib/money";
import type { BalanceTransaction } from "../../lib/recon/types";

function entry(id: string, overrides: Partial<BalanceTransaction>, payoutId: string | null = "payout-1"): LedgerEntry {
  return {
    shopifyId: id,
    payoutId,
    transaction: {
      id,
      type: "charge",
      amount: minorUnits(0),
      fee: minorUnits(0),
      net: minorUnits(0),
      currency: "GBP",
      sourceOrderId: null,
      taxRemittedByPlatform: null,
      processedAt: new Date("2026-07-15"),
      ...overrides,
    },
  };
}

describe("computeProfitAndLoss", () => {
  it("derives netProfit from categorized net totals, not a hand-assembled formula", () => {
    const charge = entry("t1", { type: "charge", amount: minorUnits(10000), net: minorUnits(9700) });
    const fee = entry("t2", { type: "charge", amount: minorUnits(0), fee: minorUnits(300), net: minorUnits(-300) });
    const statement = computeProfitAndLoss("2026-07", "GBP", [charge, fee], [], minorUnits(0), 25);
    expect(statement.netProfit).toBe(9700 - 300);
    expect(statement.revenue).toBe(10000);
  });

  it("surfaces pending (not-yet-paid-out) revenue informationally, without excluding it from netProfit", () => {
    const paidOut = entry("t1", { type: "charge", amount: minorUnits(5000), net: minorUnits(5000) }, "payout-1");
    const pending = entry("t2", { type: "charge", amount: minorUnits(2000), net: minorUnits(2000) }, null);
    const statement = computeProfitAndLoss("2026-07", "GBP", [paidOut, pending], [], minorUnits(0), 25);
    expect(statement.netProfit).toBe(7000); // both included
    expect(statement.pendingCashAmount).toBe(2000); // only the pending one
  });

  it("subtracts cogs and grouped operating expenses from netProfit", () => {
    const charge = entry("t1", { type: "charge", amount: minorUnits(10000), net: minorUnits(10000) });
    const expenses: ExpenseLine[] = [
      { category: "Advertising", amount: minorUnits(1000) },
      { category: "Advertising", amount: minorUnits(500) },
      { category: "Rent", amount: minorUnits(2000) },
    ];
    const statement = computeProfitAndLoss("2026-07", "GBP", [charge], expenses, minorUnits(3000), 25);

    expect(statement.operatingExpenses).toEqual([
      { category: "Rent", amount: 2000 },
      { category: "Advertising", amount: 1500 },
    ]);
    expect(statement.operatingExpensesTotal).toBe(3500);
    expect(statement.netProfit).toBe(10000 - 3000 - 3500);
  });

  it("computes tax set-aside as a percent of net cash from transactions", () => {
    const charge = entry("t1", { type: "charge", amount: minorUnits(10000), net: minorUnits(10000) });
    const statement = computeProfitAndLoss("2026-07", "GBP", [charge], [], minorUnits(0), 25);
    expect(statement.taxSetAside).toBe(2500);
  });

  it("renders zeroed-out rather than throwing for a month with no transactions", () => {
    const statement = computeProfitAndLoss("2026-07", null, [], [], minorUnits(0), 25);
    expect(statement.netProfit).toBe(0);
    expect(statement.transactionCount).toBe(0);
    expect(statement.operatingExpenses).toEqual([]);
    expect(statement.pendingCashAmount).toBe(0);
  });
});
