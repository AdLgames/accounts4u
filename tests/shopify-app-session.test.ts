import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decodeSessionToken, encodeSessionToken } from "../lib/shopify/app-session";

const SECRET = "test-secret-do-not-use-in-real-env";
const OTHER_SECRET = "a-different-secret";

describe("encodeSessionToken / decodeSessionToken", () => {
  it("round-trips a valid session", () => {
    const token = encodeSessionToken({ storeId: "store_1", shop: "shop1.myshopify.com" }, Date.now() + 60_000, SECRET);
    const decoded = decodeSessionToken(token, SECRET);
    expect(decoded).toEqual({ storeId: "store_1", shop: "shop1.myshopify.com" });
  });

  it("rejects a token signed with a different secret (forged token)", () => {
    const token = encodeSessionToken({ storeId: "store_1", shop: "shop1.myshopify.com" }, Date.now() + 60_000, OTHER_SECRET);
    expect(decodeSessionToken(token, SECRET)).toBeNull();
  });

  it("rejects a tampered payload even if the original signature is reused", () => {
    const token = encodeSessionToken({ storeId: "store_1", shop: "shop1.myshopify.com" }, Date.now() + 60_000, SECRET);
    const [, signature] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ storeId: "victim_store", shop: "shop1.myshopify.com", exp: Date.now() + 60_000 })).toString(
      "base64url",
    );
    expect(decodeSessionToken(`${forgedPayload}.${signature}`, SECRET)).toBeNull();
  });

  it("rejects an expired token even with a valid signature", () => {
    const token = encodeSessionToken({ storeId: "store_1", shop: "shop1.myshopify.com" }, Date.now() - 1000, SECRET);
    expect(decodeSessionToken(token, SECRET)).toBeNull();
  });

  it("accepts a token right up to its expiry instant", () => {
    const expiresAt = Date.now() + 60_000;
    const token = encodeSessionToken({ storeId: "store_1", shop: "shop1.myshopify.com" }, expiresAt, SECRET);
    expect(decodeSessionToken(token, SECRET, expiresAt)).not.toBeNull();
    expect(decodeSessionToken(token, SECRET, expiresAt + 1)).toBeNull();
  });

  it("rejects malformed input (missing signature, garbage string, empty string)", () => {
    expect(decodeSessionToken("not-a-real-token", SECRET)).toBeNull();
    expect(decodeSessionToken("", SECRET)).toBeNull();
    expect(decodeSessionToken("onlyonepart", SECRET)).toBeNull();
  });

  it("rejects a payload missing required fields even with a valid signature", () => {
    const payload = Buffer.from(JSON.stringify({ shop: "shop1.myshopify.com", exp: Date.now() + 60_000 })).toString("base64url");
    const signature = createHmac("sha256", SECRET).update(payload).digest("base64url");
    expect(decodeSessionToken(`${payload}.${signature}`, SECRET)).toBeNull();
  });
});
