import { describe, expect, it } from "vitest";
import { daysLeftInTrial, isReadOnly } from "../lib/billing/access";

describe("isReadOnly", () => {
  it("is not read-only during an active trial", () => {
    const trialEndsAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    expect(isReadOnly({ trialEndsAt, subscriptionStatus: "trialing" })).toBe(false);
  });

  it("is read-only once the trial has ended with no subscription", () => {
    const trialEndsAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(isReadOnly({ trialEndsAt, subscriptionStatus: "trialing" })).toBe(true);
  });

  it("is never read-only with an active subscription, even past trial end", () => {
    const trialEndsAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(isReadOnly({ trialEndsAt, subscriptionStatus: "active" })).toBe(false);
  });

  it("does not lock out a legacy row with no trialEndsAt set", () => {
    expect(isReadOnly({ trialEndsAt: null, subscriptionStatus: "trialing" })).toBe(false);
  });

  it("is read-only for a canceled subscription past trial end", () => {
    const trialEndsAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(isReadOnly({ trialEndsAt, subscriptionStatus: "canceled" })).toBe(true);
  });
});

describe("daysLeftInTrial", () => {
  it("counts down whole days remaining", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const trialEndsAt = new Date("2026-01-04T12:00:00Z");
    expect(daysLeftInTrial({ trialEndsAt, subscriptionStatus: "trialing" }, now)).toBe(4);
  });

  it("floors at 0 rather than going negative", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    const trialEndsAt = new Date("2026-01-01T00:00:00Z");
    expect(daysLeftInTrial({ trialEndsAt, subscriptionStatus: "trialing" }, now)).toBe(0);
  });

  it("returns null once subscribed", () => {
    const trialEndsAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    expect(daysLeftInTrial({ trialEndsAt, subscriptionStatus: "active" })).toBeNull();
  });

  it("returns null with no trialEndsAt set", () => {
    expect(daysLeftInTrial({ trialEndsAt: null, subscriptionStatus: "trialing" })).toBeNull();
  });
});
