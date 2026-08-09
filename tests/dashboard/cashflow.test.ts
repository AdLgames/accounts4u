import { describe, expect, it } from "vitest";
import { computeCashflow } from "../../lib/dashboard/cashflow";
import { minorUnits } from "../../lib/money";
import type { OrderEvent } from "../../lib/recon/order-financials";

function sale(orderId: string, amount: number): OrderEvent {
  return { type: "sale", orderId, amount: minorUnits(amount), currency: "GBP", processedAt: new Date("2026-07-15"), gateway: "shopify_payments" };
}

function refund(orderId: string, amount: number): OrderEvent {
  return { type: "refund", orderId, amount: minorUnits(amount), currency: "GBP", processedAt: new Date("2026-07-16"), gateway: "shopify_payments" };
}

describe("computeCashflow", () => {
  it("recognizes cashIn from order totals, regardless of payment gateway", () => {
    const cash = sale("o1", 9500);
    const statement = computeCashflow("2026-07", "GBP", [cash], []);
    expect(statement.cashIn).toBe(9500);
  });

  it("nets refunds out of cashIn", () => {
    const statement = computeCashflow("2026-07", "GBP", [sale("o1", 10000), refund("o1", 3000)], []);
    expect(statement.cashIn).toBe(7000);
  });

  it("sums cash out from paid bill amounts (already filtered to the period by paidOn upstream)", () => {
    const statement = computeCashflow("2026-07", "GBP", [sale("o1", 10000)], [minorUnits(1000), minorUnits(500)]);
    expect(statement.cashOut).toBe(1500);
    expect(statement.netCashFlow).toBe(8500);
    expect(statement.billsPaidCount).toBe(2);
  });

  it("renders zeroed-out for a period with no orders and no paid bills", () => {
    const statement = computeCashflow("2026-07", null, [], []);
    expect(statement.cashIn).toBe(0);
    expect(statement.cashOut).toBe(0);
    expect(statement.netCashFlow).toBe(0);
  });
});
