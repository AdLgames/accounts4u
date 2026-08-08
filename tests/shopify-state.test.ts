import { describe, expect, it, vi } from "vitest";
import { createState, verifyState } from "../lib/shopify/state";

const SECRET = "test-secret";
const SHOP = "example.myshopify.com";

describe("shopify state token", () => {
  it("round-trips for the shop it was created for", () => {
    const state = createState(SHOP, SECRET);
    expect(verifyState(state, SHOP, SECRET)).toBe(true);
  });

  it("rejects a state issued for a different shop", () => {
    const state = createState(SHOP, SECRET);
    expect(verifyState(state, "other.myshopify.com", SECRET)).toBe(false);
  });

  it("rejects a tampered state", () => {
    const state = createState(SHOP, SECRET);
    const tampered = state.slice(0, -2) + (state.at(-2) === "a" ? "b" : "a") + state.at(-1);
    expect(verifyState(tampered, SHOP, SECRET)).toBe(false);
  });

  it("rejects a state signed with a different secret", () => {
    const state = createState(SHOP, "another-secret");
    expect(verifyState(state, SHOP, SECRET)).toBe(false);
  });

  it("rejects garbage input", () => {
    expect(verifyState("not-a-real-state", SHOP, SECRET)).toBe(false);
    expect(verifyState("", SHOP, SECRET)).toBe(false);
  });

  it("rejects an expired state", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      const state = createState(SHOP, SECRET);
      vi.setSystemTime(11 * 60 * 1000);
      expect(verifyState(state, SHOP, SECRET)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
