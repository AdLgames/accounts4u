import { describe, expect, it } from "vitest";
import { categorizeTransactions } from "../../lib/recon/categorize-transactions";
import { minorUnits } from "../../lib/money";
import type { BalanceTransaction } from "../../lib/recon/types";

function txn(overrides: Partial<BalanceTransaction>): BalanceTransaction {
  return {
    id: "t1",
    type: "charge",
    amount: minorUnits(0),
    fee: minorUnits(0),
    net: minorUnits(0),
    currency: "GBP",
    sourceOrderId: null,
    taxRemittedByPlatform: null,
    processedAt: new Date("2026-07-15"),
    ...overrides,
  };
}

describe("categorizeTransactions", () => {
  it("buckets by type and sums fees across every type", () => {
    const totals = categorizeTransactions([
      txn({ type: "charge", amount: minorUnits(10000), fee: minorUnits(300), net: minorUnits(9700) }),
      txn({ type: "refund", amount: minorUnits(1000), fee: minorUnits(0), net: minorUnits(-1000) }),
      txn({ type: "dispute", amount: minorUnits(500), fee: minorUnits(15), net: minorUnits(-515) }),
      txn({ type: "adjustment", amount: minorUnits(200), net: minorUnits(200) }),
      txn({ type: "reserve", amount: minorUnits(100), net: minorUnits(-100) }),
      txn({ type: "other", amount: minorUnits(50), net: minorUnits(50) }),
    ]);

    expect(totals.grossSales).toBe(10000);
    expect(totals.refunds).toBe(1000);
    expect(totals.chargebacks).toBe(500);
    expect(totals.adjustments).toBe(200);
    expect(totals.reserves).toBe(100);
    expect(totals.other).toBe(50);
    expect(totals.fees).toBe(315);
    expect(totals.transactionCount).toBe(6);
  });

  it("netTotal is the sum of every transaction's net, not a hand-assembled formula", () => {
    const totals = categorizeTransactions([
      txn({ type: "charge", amount: minorUnits(10000), fee: minorUnits(300), net: minorUnits(9700) }),
      txn({ type: "refund", amount: minorUnits(1000), fee: minorUnits(0), net: minorUnits(-1000) }),
    ]);
    expect(totals.netTotal).toBe(9700 - 1000);
  });

  it("renders zeroed-out for an empty list", () => {
    const totals = categorizeTransactions([]);
    expect(totals.netTotal).toBe(0);
    expect(totals.transactionCount).toBe(0);
  });
});
