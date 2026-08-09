import { describe, expect, it } from "vitest";
import { orderEventsFromRaw, summarizeOrderEvents } from "../../lib/recon/order-financials";

describe("orderEventsFromRaw", () => {
  it("emits one sale event from the order total, gateway-agnostic", () => {
    const events = orderEventsFromRaw({
      id: 123,
      currency: "GBP",
      total_price: "49.99",
      processed_at: "2026-07-10T12:00:00Z",
      payment_gateway_names: ["stripe"],
    });
    expect(events).toEqual([
      { type: "sale", orderId: "123", amount: 4999, currency: "GBP", processedAt: new Date("2026-07-10T12:00:00Z"), gateway: "stripe" },
    ]);
  });

  it("works for cash/manual orders with no gateway name", () => {
    const events = orderEventsFromRaw({ id: 124, currency: "GBP", total_price: "10.00", created_at: "2026-07-11T09:00:00Z" });
    expect(events).toHaveLength(1);
    expect(events[0].gateway).toBeNull();
  });

  it("emits a refund event dated by the refund's own processed_at, not the order date", () => {
    const events = orderEventsFromRaw({
      id: 125,
      currency: "GBP",
      total_price: "100.00",
      processed_at: "2026-07-01T00:00:00Z",
      refunds: [
        {
          processed_at: "2026-07-20T00:00:00Z",
          transactions: [{ kind: "refund", amount: "30.00" }],
        },
      ],
    });
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({ type: "refund", orderId: "125", amount: 3000, processedAt: new Date("2026-07-20T00:00:00Z") });
  });

  it("ignores void transactions within a refund", () => {
    const events = orderEventsFromRaw({
      id: 126,
      total_price: "50.00",
      processed_at: "2026-07-01T00:00:00Z",
      refunds: [{ processed_at: "2026-07-02T00:00:00Z", transactions: [{ kind: "void", amount: "50.00" }] }],
    });
    expect(events).toHaveLength(1); // the void-only refund contributes nothing
  });

  it("sums multiple refund transactions within one refund", () => {
    const events = orderEventsFromRaw({
      id: 127,
      total_price: "100.00",
      processed_at: "2026-07-01T00:00:00Z",
      refunds: [
        {
          processed_at: "2026-07-05T00:00:00Z",
          transactions: [
            { kind: "refund", amount: "10.00" },
            { kind: "refund", amount: "5.00" },
          ],
        },
      ],
    });
    expect(events[1].amount).toBe(1500);
  });
});

describe("summarizeOrderEvents", () => {
  it("computes netSales as grossSales minus refunds", () => {
    const totals = summarizeOrderEvents(
      orderEventsFromRaw({
        id: 1,
        total_price: "100.00",
        processed_at: "2026-07-01",
        refunds: [{ processed_at: "2026-07-02", transactions: [{ kind: "refund", amount: "20.00" }] }],
      }),
    );
    expect(totals.grossSales).toBe(10000);
    expect(totals.refunds).toBe(2000);
    expect(totals.netSales).toBe(8000);
    expect(totals.saleCount).toBe(1);
  });

  it("renders zeroed-out for no events", () => {
    const totals = summarizeOrderEvents([]);
    expect(totals.grossSales).toBe(0);
    expect(totals.netSales).toBe(0);
    expect(totals.saleCount).toBe(0);
  });
});
