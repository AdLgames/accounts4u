import { describe, expect, it } from "vitest";
import { isSyncStale } from "../lib/admin/sync-health";

const now = new Date("2026-08-08T12:00:00Z");

describe("isSyncStale", () => {
  it("is stale when never synced", () => {
    expect(isSyncStale(null, now)).toBe(true);
  });

  it("is fresh within the 8h window", () => {
    expect(isSyncStale(new Date("2026-08-08T06:00:00Z"), now)).toBe(false);
  });

  it("is stale past the 8h window", () => {
    expect(isSyncStale(new Date("2026-08-08T03:00:00Z"), now)).toBe(true);
  });
});
