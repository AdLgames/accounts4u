import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhookHmac } from "../lib/shopify/hmac";

const SECRET = "test-secret";

describe("verifyWebhookHmac", () => {
  it("accepts a correctly signed body", () => {
    const body = JSON.stringify({ id: 12345, foo: "bar" });
    const hmac = createHmac("sha256", SECRET).update(body, "utf8").digest("base64");
    expect(verifyWebhookHmac(body, hmac, SECRET)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = JSON.stringify({ id: 12345, foo: "bar" });
    const hmac = createHmac("sha256", SECRET).update(body, "utf8").digest("base64");
    expect(verifyWebhookHmac(JSON.stringify({ id: 12345, foo: "tampered" }), hmac, SECRET)).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(verifyWebhookHmac("{}", null, SECRET)).toBe(false);
  });
});
