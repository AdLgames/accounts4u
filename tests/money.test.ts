import { describe, expect, it } from "vitest";
import { add, formatDecimal, isZero, minorUnits, parseDecimal, subtract } from "../lib/money";

describe("money", () => {
  it("rejects non-integer minor units", () => {
    expect(() => minorUnits(12.5)).toThrow(TypeError);
  });

  it("adds and subtracts in minor units", () => {
    const total = add(minorUnits(1020), minorUnits(-61), minorUnits(-84), minorUnits(-2780));
    expect(total).toBe(1020 - 61 - 84 - 2780);
    expect(subtract(minorUnits(100), minorUnits(40))).toBe(60);
  });

  it("flags a balanced payout as zero residual", () => {
    const gross = minorUnits(102000);
    const deductions = add(minorUnits(6100), minorUnits(8400), minorUnits(2780));
    const deposited = minorUnits(84720);
    expect(isZero(subtract(subtract(gross, deductions), deposited))).toBe(true);
  });

  it("parses and formats decimal strings round-trip", () => {
    expect(parseDecimal("12.34")).toBe(1234);
    expect(parseDecimal("-5")).toBe(-500);
    expect(formatDecimal(minorUnits(1234))).toBe("12.34");
    expect(formatDecimal(minorUnits(-500))).toBe("-5.00");
  });

  it("rejects ambiguous decimal input", () => {
    expect(() => parseDecimal("12.345")).toThrow(TypeError);
    expect(() => parseDecimal("abc")).toThrow(TypeError);
  });
});
