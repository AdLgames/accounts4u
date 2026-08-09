import { describe, expect, it } from "vitest";
import { parseBillsCsv } from "../../lib/bills/csv";

const HEADER = "incurred_date,vendor,category,amount,status,paid_date";

describe("parseBillsCsv", () => {
  it("parses valid rows", () => {
    const csv = [
      HEADER,
      "2026-07-01,Meta Ads,Advertising,150.00,paid,2026-07-14",
      "2026-07-05,Acme Supplies,Shipping & Packaging,42.10,unpaid,",
    ].join("\n");

    const { valid, errors } = parseBillsCsv(csv);

    expect(errors).toEqual([]);
    expect(valid).toHaveLength(2);
    expect(valid[0]).toMatchObject({ vendor: "Meta Ads", category: "Advertising", amount: 15000, status: "paid" });
    expect(valid[0].incurredOn.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(valid[0].paidOn?.toISOString()).toBe("2026-07-14T00:00:00.000Z");
    expect(valid[1].paidOn).toBeNull();
  });

  it("handles a quoted vendor name containing a comma", () => {
    const csv = [HEADER, '2026-07-01,"Acme Supplies, Inc",Rent,100.00,unpaid,'].join("\n");
    const { valid, errors } = parseBillsCsv(csv);
    expect(errors).toEqual([]);
    expect(valid[0].vendor).toBe("Acme Supplies, Inc");
  });

  it("matches category case-insensitively and normalizes casing", () => {
    const csv = [HEADER, "2026-07-01,Vendor,advertising,10.00,unpaid,"].join("\n");
    const { valid, errors } = parseBillsCsv(csv);
    expect(errors).toEqual([]);
    expect(valid[0].category).toBe("Advertising");
  });

  it("errors on an unrecognized category rather than defaulting to Other", () => {
    const csv = [HEADER, "2026-07-01,Vendor,Snacks,10.00,unpaid,"].join("\n");
    const { valid, errors } = parseBillsCsv(csv);
    expect(valid).toEqual([]);
    expect(errors).toEqual([{ row: 2, message: expect.stringContaining("Snacks") }]);
  });

  it("errors on an ambiguous non-ISO date", () => {
    const csv = [HEADER, "07/14/2026,Vendor,Rent,10.00,unpaid,"].join("\n");
    const { valid, errors } = parseBillsCsv(csv);
    expect(valid).toEqual([]);
    expect(errors[0].message).toContain("incurred_date");
  });

  it("errors on a non-positive amount", () => {
    const csv = [HEADER, "2026-07-01,Vendor,Rent,0.00,unpaid,", "2026-07-01,Vendor,Rent,-5.00,unpaid,"].join("\n");
    const { valid, errors } = parseBillsCsv(csv);
    expect(valid).toEqual([]);
    expect(errors).toHaveLength(2);
  });

  it("errors when status is paid but paid_date is missing", () => {
    const csv = [HEADER, "2026-07-01,Vendor,Rent,10.00,paid,"].join("\n");
    const { valid, errors } = parseBillsCsv(csv);
    expect(valid).toEqual([]);
    expect(errors[0].message).toContain("paid_date");
  });

  it("errors when status is unpaid but paid_date is present", () => {
    const csv = [HEADER, "2026-07-01,Vendor,Rent,10.00,unpaid,2026-07-02"].join("\n");
    const { valid, errors } = parseBillsCsv(csv);
    expect(valid).toEqual([]);
    expect(errors[0].message).toContain("paid_date");
  });

  it("imports valid rows even when other rows in the same file have errors", () => {
    const csv = [
      HEADER,
      "2026-07-01,Good Vendor,Rent,10.00,unpaid,",
      "2026-07-01,Bad Vendor,NotACategory,10.00,unpaid,",
      "2026-07-02,Another Good Vendor,Advertising,20.00,paid,2026-07-03",
    ].join("\n");
    const { valid, errors } = parseBillsCsv(csv);
    expect(valid).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0].row).toBe(3);
  });

  it("throws on an empty file", () => {
    expect(() => parseBillsCsv("")).toThrow(TypeError);
  });

  it("throws on a missing or wrong header", () => {
    expect(() => parseBillsCsv("date,who,what,how_much\n2026-07-01,Vendor,Rent,10.00")).toThrow(TypeError);
  });
});
