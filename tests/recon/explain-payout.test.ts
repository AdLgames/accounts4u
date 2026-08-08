import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseDecimal } from "../../lib/money";
import { explainPayout } from "../../lib/recon/explain-payout";
import type { BalanceTransaction, Payout } from "../../lib/recon/types";

interface Fixture {
  description: string;
  payout: { id: string; status: string; currency: string; amount: string; date: string };
  transactions: Array<{
    id: string;
    type: string;
    amount: string;
    fee: string;
    net: string;
    currency: string;
    sourceOrderId: string | null;
    taxRemittedByPlatform: boolean | null;
    processedAt: string;
  }>;
  expected: {
    isExplained: boolean;
    residual: string;
    multiCurrencyWarning: boolean;
    grossSales: string;
    refunds: string;
    fees: string;
    chargebacks: string;
    adjustments: string;
    reserves: string;
    other: string;
    merchantRemittedTaxOrderIds: string[];
    platformRemittedTaxOrderIds: string[];
  };
}

const fixturesDir = path.join(__dirname, "..", "fixtures", "recon");
const fixtureFiles = readdirSync(fixturesDir).filter((file) => file.endsWith(".json")).sort();

function toPayout(raw: Fixture["payout"]): Payout {
  return { id: raw.id, status: raw.status, currency: raw.currency, amount: parseDecimal(raw.amount), date: new Date(raw.date) };
}

function toTransaction(raw: Fixture["transactions"][number]): BalanceTransaction {
  return {
    id: raw.id,
    // Fixtures deliberately include unrecognized type strings (e.g. a BNPL
    // fee line) to exercise the "other" bucket — cast, since explainPayout
    // itself normalizes any string via its switch's default case.
    type: raw.type as BalanceTransaction["type"],
    amount: parseDecimal(raw.amount),
    fee: parseDecimal(raw.fee),
    net: parseDecimal(raw.net),
    currency: raw.currency,
    sourceOrderId: raw.sourceOrderId,
    taxRemittedByPlatform: raw.taxRemittedByPlatform,
    processedAt: new Date(raw.processedAt),
  };
}

describe("explainPayout fixtures", () => {
  it("has at least 20 fixtures", () => {
    expect(fixtureFiles.length).toBeGreaterThanOrEqual(20);
  });

  for (const file of fixtureFiles) {
    const fixture = JSON.parse(readFileSync(path.join(fixturesDir, file), "utf8")) as Fixture;

    it(`${file}: ${fixture.description}`, () => {
      const breakdown = explainPayout(toPayout(fixture.payout), fixture.transactions.map(toTransaction));

      expect(breakdown.isExplained).toBe(fixture.expected.isExplained);
      expect(breakdown.residual).toBe(parseDecimal(fixture.expected.residual));
      expect(breakdown.multiCurrencyWarning).toBe(fixture.expected.multiCurrencyWarning);
      expect(breakdown.grossSales).toBe(parseDecimal(fixture.expected.grossSales));
      expect(breakdown.refunds).toBe(parseDecimal(fixture.expected.refunds));
      expect(breakdown.fees).toBe(parseDecimal(fixture.expected.fees));
      expect(breakdown.chargebacks).toBe(parseDecimal(fixture.expected.chargebacks));
      expect(breakdown.adjustments).toBe(parseDecimal(fixture.expected.adjustments));
      expect(breakdown.reserves).toBe(parseDecimal(fixture.expected.reserves));
      expect(breakdown.other).toBe(parseDecimal(fixture.expected.other));
      expect(breakdown.merchantRemittedTaxOrderIds).toEqual(fixture.expected.merchantRemittedTaxOrderIds);
      expect(breakdown.platformRemittedTaxOrderIds).toEqual(fixture.expected.platformRemittedTaxOrderIds);
      expect(breakdown.transactionCount).toBe(fixture.transactions.length);
    });
  }
});
