/**
 * All money in this codebase is an integer count of minor units (pence/cents).
 * Never represent money as a float — floating-point arithmetic silently loses
 * precision on currency math, which is unacceptable for reconciliation.
 */
export type MinorUnits = number & { readonly __brand: "MinorUnits" };

export function minorUnits(value: number): MinorUnits {
  if (!Number.isInteger(value)) {
    throw new TypeError(`Money must be an integer number of minor units, got ${value}`);
  }
  return value as MinorUnits;
}

export function add(...values: MinorUnits[]): MinorUnits {
  return minorUnits(values.reduce((sum, v) => sum + v, 0));
}

export function subtract(a: MinorUnits, b: MinorUnits): MinorUnits {
  return minorUnits(a - b);
}

export function isZero(value: MinorUnits): boolean {
  return value === 0;
}

/** Parses a decimal string (e.g. "12.34") into minor units. Throws on ambiguous input. */
export function parseDecimal(value: string): MinorUnits {
  const match = /^-?\d+(\.\d{1,2})?$/.exec(value.trim());
  if (!match) {
    throw new TypeError(`Cannot parse "${value}" as a decimal money amount`);
  }
  const [whole, fraction = ""] = value.trim().split(".");
  const paddedFraction = fraction.padEnd(2, "0");
  const sign = whole.startsWith("-") ? -1 : 1;
  const wholeAbs = Math.abs(Number(whole));
  return minorUnits(sign * (wholeAbs * 100 + Number(paddedFraction)));
}

/** Formats minor units as a decimal string (e.g. 1234 -> "12.34"). Does not add a currency symbol. */
export function formatDecimal(value: MinorUnits): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}
