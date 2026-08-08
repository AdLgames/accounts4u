import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyQueryHmac, verifyWebhookHmac } from "../lib/shopify/hmac";

const SECRET = "test-secret";

describe("verifyQueryHmac", () => {
  it("accepts a correctly signed query string", () => {
    const message = "code=abc123&shop=example.myshopify.com&state=xyz&timestamp=1700000000";
    const hmac = createHmac("sha256", SECRET).update(message).digest("hex");
    const rawQuery = `${message}&hmac=${hmac}`;
    expect(verifyQueryHmac(rawQuery, SECRET)).toBe(true);
  });

  it("rejects a tampered query string", () => {
    const message = "code=abc123&shop=example.myshopify.com&state=xyz&timestamp=1700000000";
    const hmac = createHmac("sha256", SECRET).update(message).digest("hex");
    const rawQuery = `code=tampered&shop=example.myshopify.com&state=xyz&timestamp=1700000000&hmac=${hmac}`;
    expect(verifyQueryHmac(rawQuery, SECRET)).toBe(false);
  });

  it("rejects a missing hmac param", () => {
    expect(verifyQueryHmac("code=abc123&shop=example.myshopify.com", SECRET)).toBe(false);
  });

  it("is order-independent for the signed params", () => {
    const message = "code=abc123&shop=example.myshopify.com&state=xyz";
    const hmac = createHmac("sha256", SECRET).update(message).digest("hex");
    const reordered = `shop=example.myshopify.com&hmac=${hmac}&state=xyz&code=abc123`;
    expect(verifyQueryHmac(reordered, SECRET)).toBe(true);
  });
});

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
