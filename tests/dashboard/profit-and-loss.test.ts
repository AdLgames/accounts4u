import { describe, expect, it } from "vitest";
import { computeProfitAndLoss, type ExpenseLine } from "../../lib/dashboard/profit-and-loss";
import type { LedgerEntry } from "../../lib/dashboard/transaction-ledger";
import { minorUnits } from "../../lib/money";
import type { OrderEvent } from "../../lib/recon/order-financials";
import type { BalanceTransaction } from "../../lib/recon/types";

function sale(orderId: string, amount: number, gateway: string | null = "shopify_payments"): OrderEvent {
  return { type: "sale", orderId, amount: minorUnits(amount), currency: "GBP", processedAt: new Date("2026-07-15"), gateway };
}

function refund(orderId: string, amount: number): OrderEvent {
  return { type: "refund", orderId, amount: minorUnits(amount), currency: "GBP", processedAt: new Date("2026-07-16"), gateway: "shopify_payments" };
}

function paymentEntry(overrides: Partial<BalanceTransaction>, payoutId: string | null = "payout-1"): LedgerEntry {
  return {
    shopifyId: overrides.id ?? "t1",
    payoutId,
    transaction: {
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
    },
  };
}

describe("computeProfitAndLoss", () => {
  it("derives revenue/refunds from order data, gateway-agnostic (no Shopify Payments transactions needed)", () => {
    const statement = computeProfitAndLoss("2026-07", "GBP", [sale("o1", 10000, "stripe")], [], [], minorUnits(0), 25);
    expect(statement.revenue).toBe(10000);
    expect(statement.netSales).toBe(10000);
    expect(statement.netProfit).toBe(10000); // no fees available for a non-Shopify-Payments order
    expect(statement.fees).toBe(0);
  });

  it("nets refunds out of revenue regardless of which order they belong to", () => {
    const statement = computeProfitAndLoss("2026-07", "GBP", [sale("o1", 10000), refund("o1", 1000)], [], [], minorUnits(0), 25);
    expect(statement.revenue).toBe(10000);
    expect(statement.refunds).toBe(1000);
    expect(statement.netSales).toBe(9000);
  });

  it("enriches with fees/chargebacks from Shopify Payments transactions when available, without double-counting revenue", () => {
    const orderEvents = [sale("o1", 10000)];
    const paymentEntries = [paymentEntry({ type: "charge", amount: minorUnits(10000), fee: minorUnits(300), net: minorUnits(9700) })];
    const statement = computeProfitAndLoss("2026-07", "GBP", orderEvents, paymentEntries, [], minorUnits(0), 25);
    expect(statement.revenue).toBe(10000); // from order, not from the payment transaction's amount
    expect(statement.fees).toBe(300);
    expect(statement.netProfit).toBe(10000 - 300);
  });

  it("surfaces pending (not-yet-paid-out) Shopify Payments cash informationally, at £0 for stores without Shopify Payments", () => {
    const orderEvents = [sale("o1", 10000, "stripe")];
    const statement = computeProfitAndLoss("2026-07", "GBP", orderEvents, [], [], minorUnits(0), 25);
    expect(statement.pendingCashAmount).toBe(0);
  });

  it("subtracts cogs and grouped operating expenses from netProfit", () => {
    const expenses: ExpenseLine[] = [
      { category: "Advertising", amount: minorUnits(1000) },
      { category: "Advertising", amount: minorUnits(500) },
      { category: "Rent", amount: minorUnits(2000) },
    ];
    const statement = computeProfitAndLoss("2026-07", "GBP", [sale("o1", 10000)], [], expenses, minorUnits(3000), 25);

    expect(statement.operatingExpenses).toEqual([
      { category: "Rent", amount: 2000 },
      { category: "Advertising", amount: 1500 },
    ]);
    expect(statement.operatingExpensesTotal).toBe(3500);
    expect(statement.netProfit).toBe(10000 - 3000 - 3500);
  });

  it("computes tax set-aside as a percent of net sales", () => {
    const statement = computeProfitAndLoss("2026-07", "GBP", [sale("o1", 10000)], [], [], minorUnits(0), 25);
    expect(statement.taxSetAside).toBe(2500);
  });

  it("renders zeroed-out rather than throwing for a month with no orders", () => {
    const statement = computeProfitAndLoss("2026-07", null, [], [], [], minorUnits(0), 25);
    expect(statement.netProfit).toBe(0);
    expect(statement.saleCount).toBe(0);
    expect(statement.operatingExpenses).toEqual([]);
    expect(statement.pendingCashAmount).toBe(0);
  });
});
