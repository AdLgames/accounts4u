import { describe, expect, it } from "vitest";
import { computeBalanceSheet } from "../../lib/dashboard/balance-sheet";
import { minorUnits } from "../../lib/money";

describe("computeBalanceSheet", () => {
  const asOf = new Date("2026-08-01T00:00:00Z");

  it("computes cash as lifetime net sales minus lifetime bills paid", () => {
    const snapshot = computeBalanceSheet(asOf, "GBP", minorUnits(15000), [minorUnits(2000)], [], 25);
    expect(snapshot.cashEstimate).toBe(15000 - 2000);
    expect(snapshot.totalAssets).toBe(snapshot.cashEstimate);
  });

  it("excludes unpaid bills from cash but includes them as a liability", () => {
    const snapshot = computeBalanceSheet(asOf, "GBP", minorUnits(10000), [], [minorUnits(3000)], 0);
    expect(snapshot.cashEstimate).toBe(10000); // unpaid bill doesn't reduce cash
    expect(snapshot.unpaidBills).toBe(3000);
    expect(snapshot.totalLiabilities).toBe(3000);
  });

  it("computes tax reserve owed from lifetime net sales — the same figure P&L's running total is built from", () => {
    const snapshot = computeBalanceSheet(asOf, "GBP", minorUnits(10000), [], [], 25);
    expect(snapshot.taxReserveOwed).toBe(2500);
  });

  it("derives equity as a pure plug (assets - liabilities)", () => {
    const snapshot = computeBalanceSheet(asOf, "GBP", minorUnits(10000), [], [minorUnits(1000)], 25);
    expect(snapshot.equity).toBe(snapshot.totalAssets - snapshot.totalLiabilities);
    expect(snapshot.equity).toBe(10000 - (1000 + 2500));
  });

  it("renders zeroed-out with no revenue and no bills", () => {
    const snapshot = computeBalanceSheet(asOf, null, minorUnits(0), [], [], 25);
    expect(snapshot.cashEstimate).toBe(0);
    expect(snapshot.totalAssets).toBe(0);
    expect(snapshot.totalLiabilities).toBe(0);
    expect(snapshot.equity).toBe(0);
  });
});
