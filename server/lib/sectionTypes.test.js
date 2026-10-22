// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  SECTION_MAX,
  SECTION_STYLE_FIELDS,
  SECTION_TYPE_NAMES,
  SECTION_TYPES,
  isSafeUrl,
  normalizeSections,
  validateSection,
  validateStyle,
} from "./sectionTypes.js";

describe("SECTION_TYPES", () => {
  it("SECTION_TYPE_NAMES lists exactly the twelve catalogue types", () => {
    expect(SECTION_TYPE_NAMES).toEqual([
      "hero",
      "richtext",
      "image",
      "gallery",
      "product_grid",
      "category_grid",
      "promo_banner",
      "cta",
      "faq",
      "video",
      "category_listing",
      "spacer",
    ]);
    expect(SECTION_TYPE_NAMES).toHaveLength(12);
    expect(SECTION_TYPE_NAMES).toEqual(Object.keys(SECTION_TYPES));
  });
});

describe("validateSection", () => {
  it("validateSection accepts a minimal valid hero", () => {
    const result = validateSection({ type: "hero", data: { heading: "Sale" } });
    expect(result.ok).toBe(true);
    expect(result.data.heading).toBe("Sale");
  });

  it("validateSection rejects a missing required field", () => {
    const result = validateSection({ type: "hero", data: {} });
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("hero.heading"))).toBe(true);
  });

  it("validateSection rejects an unknown type", () => {
    const result = validateSection({ type: "nope", data: {} });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("nope");
  });

  it("validateSection rejects a type of toString", () => {
    const result = validateSection({ type: "toString", data: {} });
    expect(result.ok).toBe(false);
  });

  it("validateSection rejects an unknown field", () => {
    const result = validateSection({ type: "hero", data: { heading: "x", subheadng: "typo" } });
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("subheadng"))).toBe(true);
  });

  it("validateSection rejects a field of the wrong type", () => {
    const result = validateSection({ type: "hero", data: { heading: 42 } });
    expect(result.ok).toBe(false);
  });

  it("validateSection rejects a string over its max length", () => {
    const result = validateSection({ type: "hero", data: { heading: "a".repeat(121) } });
    expect(result.ok).toBe(false);
  });

  it("validateSection rejects an enum value outside the list", () => {
    const result = validateSection({ type: "hero", data: { heading: "x", theme: "neon" } });
    expect(result.ok).toBe(false);
  });

  it("validateSection rejects a javascript CTA href", () => {
    const result = validateSection({
      type: "hero",
      data: { heading: "x", cta_href: "javascript:alert(1)" },
    });
    expect(result.ok).toBe(false);
  });

  it("validateSection accepts a hash-route CTA href", () => {
    const result = validateSection({
      type: "hero",
      data: { heading: "x", cta_href: "#/category/electronics" },
    });
    expect(result.ok).toBe(true);
  });

  it("validateSection accepts a relative CTA href", () => {
    const result = validateSection({
      type: "hero",
      data: { heading: "x", cta_href: "/pages/diwali-sale" },
    });
    expect(result.ok).toBe(true);
  });

  it("validateSection rejects a uuid_list that is not an array of uuids", () => {
    const result = validateSection({
      type: "product_grid",
      data: { product_ids: ["not-a-uuid"] },
    });
    expect(result.ok).toBe(false);
  });

  it("validateSection accepts an item_list of question and answer", () => {
    const result = validateSection({
      type: "faq",
      data: { items: [{ question: "Q", answer: "A" }] },
    });
    expect(result.ok).toBe(true);
  });

  it("validateSection rejects an item_list entry missing its question", () => {
    const result = validateSection({ type: "faq", data: { items: [{ answer: "A" }] } });
    expect(result.ok).toBe(false);
  });
});

describe("isSafeUrl", () => {
  it("isSafeUrl rejects a newline-obfuscated javascript scheme", () => {
    expect(isSafeUrl("java\nscript:alert(1)")).toBe(false);
  });

  it("isSafeUrl rejects a data URL", () => {
    expect(isSafeUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("isSafeUrl accepts http, https, mailto and tel", () => {
    expect(isSafeUrl("http://example.com/x")).toBe(true);
    expect(isSafeUrl("https://example.com/x")).toBe(true);
    expect(isSafeUrl("mailto:hello@example.com")).toBe(true);
    expect(isSafeUrl("tel:+919999999999")).toBe(true);
  });

  it("isSafeUrl accepts a site-relative path", () => {
    expect(isSafeUrl("/pages/x")).toBe(true);
    expect(isSafeUrl("//evil.example")).toBe(false);
  });
});

describe("validateStyle", () => {
  it("validateStyle rejects an unknown style key", () => {
    const result = validateStyle({ background: "none", nope: 1 });
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("nope"))).toBe(true);

    const valid = validateStyle({
      background: "surface",
      padding_top: "lg",
      padding_bottom: "sm",
      max_width: "narrow",
      align: "center",
    });
    expect(valid.ok).toBe(true);
    expect(Object.keys(SECTION_STYLE_FIELDS)).toEqual([
      "background",
      "padding_top",
      "padding_bottom",
      "max_width",
      "align",
    ]);
  });
});

describe("normalizeSections", () => {
  it("normalizeSections drops unknown keys and fills defaults", () => {
    const expected = {
      heading: "x",
      eyebrow: "",
      subheading: "",
      image_url: "",
      image_alt: "",
      cta_label: "",
      cta_href: "",
      theme: "light",
    };

    const result = normalizeSections([{ type: "hero", data: { heading: "x", bogus: 1 } }]);
    expect(result).toHaveLength(1);
    expect(result[0].data).toEqual(expected);

    // The same section passed on its own normalises identically.
    const single = normalizeSections({ type: "hero", data: { heading: "x", bogus: 1 } });
    expect(single).toHaveLength(1);
    expect(single[0].data).toEqual(expected);
  });

  it("normalizeSections never throws on garbage", () => {
    expect(() => normalizeSections(null)).not.toThrow();
    expect(normalizeSections(null)).toEqual([]);
    expect(normalizeSections("x")).toEqual([]);
    expect(normalizeSections(42)).toEqual([]);
    expect(normalizeSections([])).toEqual([]);
  });

  it("normalizeSections caps the section count", () => {
    const many = Array.from({ length: 30 }, () => ({ type: "hero", data: { heading: "x" } }));
    const result = normalizeSections(many);
    expect(result).toHaveLength(SECTION_MAX);
    expect(SECTION_MAX).toBe(24);
  });
});
