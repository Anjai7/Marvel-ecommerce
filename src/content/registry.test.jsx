import { describe, expect, it } from "vitest";
import { SECTION_REGISTRY, resolveSection } from "./registry";

const TWELVE_TYPES = [
  "category_grid",
  "category_listing",
  "cta",
  "faq",
  "gallery",
  "hero",
  "image",
  "product_grid",
  "promo_banner",
  "richtext",
  "spacer",
  "video",
];

describe("the section registry", () => {
  it("contains exactly the twelve catalogue types", () => {
    expect([...SECTION_REGISTRY.keys()].sort()).toEqual(TWELVE_TYPES);
  });

  it("returns a component for a known type", () => {
    expect(typeof resolveSection("hero")).toBe("function");
  });

  it("returns null for an unknown type", () => {
    expect(resolveSection("nope")).toBeNull();
  });

  it("ignores prototype keys", () => {
    // A plain object would hand back `Object.prototype.toString` here.
    expect(resolveSection("toString")).toBeNull();
    expect(resolveSection("constructor")).toBeNull();
    expect(resolveSection("__proto__")).toBeNull();
    expect(resolveSection("hasOwnProperty")).toBeNull();
  });

  it("returns null for a non-string type", () => {
    expect(resolveSection(null)).toBeNull();
    expect(resolveSection(42)).toBeNull();
    expect(resolveSection({})).toBeNull();
    expect(resolveSection(undefined)).toBeNull();
  });
});
