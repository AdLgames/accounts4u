import { describe, expect, it } from "vitest";
import { minorUnits } from "../../lib/money";
import { splitTransactionsByMonth } from "../../lib/recon/split-by-month";
import type { BalanceTransaction } from "../../lib/recon/types";

function txn(overrides: Partial<BalanceTransaction>): BalanceTransaction {
  return {
    id: "t1",
    type: "charge",
    amount: minorUnits(1000),
    fee: minorUnits(30),
    net: minorUnits(970),
    currency: "GBP",
    sourceOrderId: null,
    taxRemittedByPlatform: null,
    processedAt: new Date("2026-01-15T10:00:00Z"),
    ...overrides,
  };
}

describe("splitTransactionsByMonth", () => {
  it("groups a payout spanning a month boundary into two months", () => {
    const groups = splitTransactionsByMonth([
      txn({ id: "t1", processedAt: new Date("2026-01-31T23:00:00Z"), net: minorUnits(500) }),
      txn({ id: "t2", processedAt: new Date("2026-02-01T01:00:00Z"), net: minorUnits(300) }),
      txn({ id: "t3", processedAt: new Date("2026-01-15T12:00:00Z"), net: minorUnits(200) }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].month).toBe("2026-01");
    expect(groups[0].transactions.map((t) => t.id)).toEqual(["t1", "t3"]);
    expect(groups[0].netTotal).toBe(minorUnits(700));
    expect(groups[1].month).toBe("2026-02");
    expect(groups[1].transactions.map((t) => t.id)).toEqual(["t2"]);
    expect(groups[1].netTotal).toBe(minorUnits(300));
  });

  it("returns a single group when everything is in one month", () => {
    const groups = splitTransactionsByMonth([
      txn({ id: "t1", processedAt: new Date("2026-03-05T10:00:00Z") }),
      txn({ id: "t2", processedAt: new Date("2026-03-20T10:00:00Z") }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].month).toBe("2026-03");
  });

  it("returns no groups for an empty transaction list", () => {
    expect(splitTransactionsByMonth([])).toEqual([]);
  });

  it("uses UTC month boundaries, not local time", () => {
    // 2026-01-31T23:30:00Z is still January in UTC regardless of local offset.
    const groups = splitTransactionsByMonth([txn({ processedAt: new Date("2026-01-31T23:30:00Z") })]);
    expect(groups[0].month).toBe("2026-01");
  });
});
