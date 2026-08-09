import { describe, expect, it } from "vitest";
import { computeCashflowWeek } from "../../lib/dashboard/cashflow";
import { minorUnits } from "../../lib/money";
import type { ExpenseLine } from "../../lib/dashboard/profit-and-loss";
import type { OrderEvent } from "../../lib/recon/order-financials";

function sale(orderId: string, amount: number): OrderEvent {
  return { type: "sale", orderId, amount: minorUnits(amount), currency: "GBP", processedAt: new Date("2026-07-15"), gateway: "shopify_payments" };
}

function refund(orderId: string, amount: number): OrderEvent {
  return { type: "refund", orderId, amount: minorUnits(amount), currency: "GBP", processedAt: new Date("2026-07-16"), gateway: "shopify_payments" };
}

function bill(category: string, amount: number): ExpenseLine {
  return { category, amount: minorUnits(amount) };
}

describe("computeCashflowWeek", () => {
  it("recognizes cashIn from order totals, regardless of payment gateway", () => {
    const week = computeCashflowWeek("2026-07-13", "GBP", [sale("o1", 9500)], []);
    expect(week.cashIn).toBe(9500);
    expect(week.cashInByCategory).toEqual([{ category: "Revenue", amount: 9500 }]);
  });

  it("nets refunds out of cashIn", () => {
    const week = computeCashflowWeek("2026-07-13", "GBP", [sale("o1", 10000), refund("o1", 3000)], []);
    expect(week.cashIn).toBe(7000);
  });

  it("groups cash out by bill category and sums to cashOut", () => {
    const week = computeCashflowWeek(
      "2026-07-13",
      "GBP",
      [sale("o1", 10000)],
      [bill("Advertising", 1000), bill("Rent", 500), bill("Advertising", 250)],
    );
    expect(week.cashOutByCategory).toEqual([
      { category: "Advertising", amount: 1250 },
      { category: "Rent", amount: 500 },
    ]);
    expect(week.cashOut).toBe(1750);
    expect(week.netCashFlow).toBe(8250);
    expect(week.billsPaidCount).toBe(3);
  });

  it("renders zeroed-out for a week with no orders and no paid bills", () => {
    const week = computeCashflowWeek("2026-07-13", null, [], []);
    expect(week.cashIn).toBe(0);
    expect(week.cashInByCategory).toEqual([]);
    expect(week.cashOut).toBe(0);
    expect(week.cashOutByCategory).toEqual([]);
    expect(week.netCashFlow).toBe(0);
  });
});
