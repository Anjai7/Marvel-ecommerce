// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  RESERVED_PAGE_SLUGS,
  isPublicPage,
  isReservedSlug,
  validatePage,
  validateSeo,
} from "./pageRules.js";

describe("validatePage", () => {
  it("validatePage accepts a minimal page", () => {
    expect(validatePage({ slug: "diwali-sale", title: "Diwali" })).toBe(null);
  });

  it("validatePage rejects a missing title", () => {
    const error = validatePage({ slug: "diwali-sale" });
    expect(error).toBeTruthy();
    expect(error).toContain("title");
  });

  it("validatePage rejects a slug with a slash", () => {
    const error = validatePage({ slug: "sale/2026", title: "x" });
    expect(error).toBeTruthy();
    expect(error).toContain("slug");
  });

  it("validatePage rejects an uppercase slug", () => {
    const error = validatePage({ slug: "Diwali", title: "x" });
    expect(error).toBeTruthy();
    expect(error).toContain("slug");
  });

  it("validatePage rejects a reserved slug", () => {
    const error = validatePage({ slug: "admin", title: "x" });
    expect(error).toBeTruthy();
    expect(error).toContain("slug");
    expect(error).toContain("reserved");
  });

  it("validatePage rejects a slug that is only hyphens", () => {
    const error = validatePage({ slug: "---", title: "x" });
    expect(error).toBeTruthy();
    expect(error).toContain("slug");
  });

  it("validatePage rejects an unknown kind", () => {
    const error = validatePage({ slug: "x", title: "x", kind: "weird" });
    expect(error).toBeTruthy();
    expect(error).toContain("kind");
  });

  it("validatePage rejects an unknown template", () => {
    const error = validatePage({ slug: "x", title: "x", template: "weird" });
    expect(error).toBeTruthy();
    expect(error).toContain("template");
  });

  it("validatePage rejects an unknown status", () => {
    const error = validatePage({ slug: "x", title: "x", status: "live" });
    expect(error).toBeTruthy();
    expect(error).toContain("status");
  });

  it("validatePage rejects a non-ISO scheduled_at", () => {
    const error = validatePage({ slug: "x", title: "x", scheduled_at: "soon" });
    expect(error).toBeTruthy();
    expect(error).toContain("scheduled_at");
  });

  it("validatePage rejects an expired_at that is not after scheduled_at", () => {
    const error = validatePage({
      slug: "x",
      title: "x",
      scheduled_at: "2026-10-22T00:00:00.000Z",
      expired_at: "2026-10-21T00:00:00.000Z",
    });
    expect(error).toBeTruthy();
    expect(error).toContain("expired_at");
  });

  it("validatePage skips absent fields in partial mode", () => {
    expect(validatePage({}, { partial: true })).toBe(null);
  });

  it("validatePage still rejects a present bad slug in partial mode", () => {
    const error = validatePage({ slug: "BAD" }, { partial: true });
    expect(error).toBeTruthy();
    expect(error).toContain("slug");
  });
});

describe("validateSeo", () => {
  it("validateSeo rejects a non-https canonical URL", () => {
    const error = validateSeo({ canonical: "javascript:alert(1)" });
    expect(error).toBeTruthy();
    expect(error).toContain("canonical");
  });

  it("validateSeo rejects an unknown seo key", () => {
    const error = validateSeo({ title: "x", bogus: 1 });
    expect(error).toBeTruthy();
    expect(error).toContain("bogus");
  });

  it("validateSeo accepts an empty object", () => {
    expect(validateSeo({})).toBe(null);
  });
});

describe("isReservedSlug", () => {
  it("isReservedSlug is true for admin and false for diwali-sale", () => {
    expect(isReservedSlug("admin")).toBe(true);
    expect(isReservedSlug("diwali-sale")).toBe(false);
    // The lookup trims and ignores the case.
    expect(isReservedSlug("ADMIN")).toBe(true);
    expect(isReservedSlug("  Admin  ")).toBe(true);
    expect(isReservedSlug("sitemap.xml")).toBe(true);
    expect(RESERVED_PAGE_SLUGS.has("sitemap.xml")).toBe(true);
  });
});

describe("isPublicPage", () => {
  const now = new Date("2026-10-22T12:00:00.000Z");

  it("isPublicPage is false for a draft", () => {
    expect(isPublicPage({ status: "draft", scheduled_at: null, expired_at: null }, now)).toBe(
      false
    );
  });

  it("isPublicPage is false for a scheduled page before its scheduled_at", () => {
    // The window has not opened yet, and a row in the `scheduled` status is
    // never public on its own.
    expect(
      isPublicPage(
        { status: "published", scheduled_at: "2026-10-23T00:00:00.000Z", expired_at: null },
        now
      )
    ).toBe(false);
    expect(
      isPublicPage({ status: "scheduled", scheduled_at: "2026-10-23T00:00:00.000Z" }, now)
    ).toBe(false);
  });

  it("isPublicPage is true for a scheduled page after its scheduled_at", () => {
    expect(
      isPublicPage(
        { status: "published", scheduled_at: "2026-10-21T00:00:00.000Z", expired_at: null },
        now
      )
    ).toBe(true);
  });

  it("isPublicPage is false for an expired page", () => {
    expect(
      isPublicPage(
        { status: "published", scheduled_at: null, expired_at: "2026-10-21T00:00:00.000Z" },
        now
      )
    ).toBe(false);
  });

  it("isPublicPage is true for a published page with no window", () => {
    expect(isPublicPage({ status: "published", scheduled_at: null, expired_at: null }, now)).toBe(
      true
    );
  });
});
