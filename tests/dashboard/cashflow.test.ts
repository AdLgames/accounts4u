import { describe, expect, it } from "vitest";
import { computeCashflow } from "../../lib/dashboard/cashflow";
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

describe("computeCashflow", () => {
  it("recognizes cashIn at capture date, including transactions not yet paid out", () => {
    const pending = entry("t1", { type: "charge", amount: minorUnits(9500), net: minorUnits(9500) }, null);
    const statement = computeCashflow("2026-07", "GBP", [pending], []);
    expect(statement.cashIn).toBe(9500);
  });

  it("sums cash out from paid bill amounts (already filtered to the period by paidOn upstream)", () => {
    const charge = entry("t1", { type: "charge", amount: minorUnits(10000), net: minorUnits(10000) });
    const statement = computeCashflow("2026-07", "GBP", [charge], [minorUnits(1000), minorUnits(500)]);
    expect(statement.cashOut).toBe(1500);
    expect(statement.netCashFlow).toBe(8500);
    expect(statement.billsPaidCount).toBe(2);
  });

  it("renders zeroed-out for a period with no transactions and no paid bills", () => {
    const statement = computeCashflow("2026-07", null, [], []);
    expect(statement.cashIn).toBe(0);
    expect(statement.cashOut).toBe(0);
    expect(statement.netCashFlow).toBe(0);
  });
});
