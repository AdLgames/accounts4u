import { describe, expect, it } from "vitest";
import { isValidShopDomain } from "../lib/shopify/domain";

describe("isValidShopDomain", () => {
  it("accepts a well-formed shop domain", () => {
    expect(isValidShopDomain("example-store.myshopify.com")).toBe(true);
  });

  it("rejects a non-myshopify host", () => {
    expect(isValidShopDomain("example.com")).toBe(false);
  });

  it("rejects an attempted domain-suffix bypass", () => {
    expect(isValidShopDomain("evil.com/.myshopify.com")).toBe(false);
    expect(isValidShopDomain("myshopify.com.evil.com")).toBe(false);
  });

  it("rejects a domain with a scheme or path", () => {
    expect(isValidShopDomain("https://example.myshopify.com")).toBe(false);
    expect(isValidShopDomain("example.myshopify.com/admin")).toBe(false);
  });
});
