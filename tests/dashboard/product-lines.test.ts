import { describe, expect, it } from "vitest";
import { normalizeCategoryLabel } from "../../lib/dashboard/product-lines";

describe("normalizeCategoryLabel", () => {
  it("merges case variants into one canonical label", () => {
    expect(normalizeCategoryLabel("SHOES")).toBe("Shoes");
    expect(normalizeCategoryLabel("shoes")).toBe("Shoes");
    expect(normalizeCategoryLabel("Shoes")).toBe("Shoes");
  });

  it("title-cases multi-word categories and collapses extra whitespace", () => {
    expect(normalizeCategoryLabel("home  &   garden")).toBe("Home & Garden");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeCategoryLabel("  accessories  ")).toBe("Accessories");
  });

  it("returns null for empty, whitespace-only, null, or undefined input", () => {
    expect(normalizeCategoryLabel("")).toBeNull();
    expect(normalizeCategoryLabel("   ")).toBeNull();
    expect(normalizeCategoryLabel(null)).toBeNull();
    expect(normalizeCategoryLabel(undefined)).toBeNull();
  });
});
