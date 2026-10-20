import { describe, it, expect } from "vitest";
import {
  isHrefOrUrl,
  isHttpsOrRelative,
  slugify,
  validateBanner,
  validateCategory,
  validateDepth,
  validateFooterLink,
  validateFooterSection,
  validateHeroSlide,
} from "./validation.js";

describe("isHttpsOrRelative", () => {
  it("accepts null and the empty string", () => {
    expect(isHttpsOrRelative(null)).toBe(true);
    expect(isHttpsOrRelative(undefined)).toBe(true);
    expect(isHttpsOrRelative("")).toBe(true);
  });

  it("accepts site-relative paths and https URLs", () => {
    expect(isHttpsOrRelative("/")).toBe(true);
    expect(isHttpsOrRelative("/products")).toBe(true);
    expect(isHttpsOrRelative("https://x.com/a")).toBe(true);
  });

  it("rejects plain http, other schemes and non-strings", () => {
    expect(isHttpsOrRelative("http://x.com")).toBe(false);
    expect(isHttpsOrRelative("javascript:alert(1)")).toBe(false);
    expect(isHttpsOrRelative("ftp://x")).toBe(false);
    expect(isHttpsOrRelative(42)).toBe(false);
  });

  it("keeps rejecting hash routes: it guards image and asset URLs", () => {
    expect(isHttpsOrRelative("#/products")).toBe(false);
    expect(isHttpsOrRelative("#/category/electronics/mobiles")).toBe(false);
  });
});

describe("isHrefOrUrl", () => {
  it("accepts null, the empty string, relative paths, https URLs and hash routes", () => {
    expect(isHrefOrUrl(null)).toBe(true);
    expect(isHrefOrUrl(undefined)).toBe(true);
    expect(isHrefOrUrl("")).toBe(true);
    expect(isHrefOrUrl("/help")).toBe(true);
    expect(isHrefOrUrl("#/")).toBe(true);
    expect(isHrefOrUrl("#/category/electronics/mobiles")).toBe(true);
    expect(isHrefOrUrl("  #/cart  ")).toBe(true);
    expect(isHrefOrUrl("https://x.com/help")).toBe(true);
  });

  it("rejects other schemes, a bare fragment and non-strings", () => {
    expect(isHrefOrUrl("javascript:alert(1)")).toBe(false);
    expect(isHrefOrUrl("http://x.com")).toBe(false);
    expect(isHrefOrUrl("ftp://x")).toBe(false);
    expect(isHrefOrUrl("#")).toBe(false);
    expect(isHrefOrUrl("help")).toBe(false);
    expect(isHrefOrUrl(42)).toBe(false);
  });
});

describe("validateHeroSlide", () => {
  it("accepts a slide with only a title", () => {
    expect(validateHeroSlide({ title: "A" })).toBeNull();
  });

  it("requires a title", () => {
    expect(validateHeroSlide({})).toBe("Hero slide title is required.");
    expect(validateHeroSlide()).toBe("Hero slide title is required.");
    expect(validateHeroSlide({ title: "   " })).toBe("Hero slide title is required.");
    expect(validateHeroSlide({ title: 42 })).toBe("Hero slide title is required.");
  });

  it("requires order_index to be an exact integer", () => {
    expect(validateHeroSlide({ title: "A", order_index: "1.5" })).toBe(
      "order_index must be an integer."
    );
    expect(validateHeroSlide({ title: "A", order_index: "01" })).toBe(
      "order_index must be an integer."
    );
    expect(validateHeroSlide({ title: "A", order_index: "1e3" })).toBe(
      "order_index must be an integer."
    );
    expect(validateHeroSlide({ title: "A", order_index: 1.5 })).toBe(
      "order_index must be an integer."
    );
    expect(validateHeroSlide({ title: "A", order_index: "12" })).toBeNull();
    expect(validateHeroSlide({ title: "A", order_index: 0 })).toBeNull();
  });

  it("rejects insecure URLs in every URL field", () => {
    expect(validateHeroSlide({ title: "A", bg_image_url: "http://x" })).toBe(
      "Field 'bg_image_url' must be an https URL or a relative path."
    );
    expect(validateHeroSlide({ title: "A", product_image_url: "http://x" })).toBe(
      "Field 'product_image_url' must be an https URL or a relative path."
    );
    expect(validateHeroSlide({ title: "A", fallback_image_url: "ftp://x" })).toBe(
      "Field 'fallback_image_url' must be an https URL or a relative path."
    );
    expect(validateHeroSlide({ title: "A", btn_path: 42 })).toBe(
      "Field 'btn_path' must be an https URL or a relative path."
    );
    expect(validateHeroSlide({ title: "A", btn_path: "/products" })).toBeNull();
  });

  it("skips required-field checks when partial", () => {
    expect(validateHeroSlide({ subtitle: "x" }, { partial: true })).toBeNull();
    expect(validateHeroSlide({}, { partial: true })).toBeNull();
  });

  it("still validates fields that are present when partial", () => {
    expect(validateHeroSlide({ order_index: "1.5" }, { partial: true })).toBe(
      "order_index must be an integer."
    );
    expect(validateHeroSlide({ title: "" }, { partial: true })).toBe(
      "Hero slide title is required."
    );
  });
});

describe("validateCategory", () => {
  it("accepts a minimal category", () => {
    expect(validateCategory({ name: "A", slug: "a" })).toBeNull();
  });

  it("requires a name", () => {
    expect(validateCategory({})).toBe("Category name is required.");
    expect(validateCategory({ name: "  ", slug: "a" })).toBe("Category name is required.");
    expect(validateCategory({ name: 7, slug: "a" })).toBe("Category name is required.");
  });

  it("requires a lowercase hyphenated slug", () => {
    expect(validateCategory({ name: "A", slug: "Bad Slug!" })).toBe(
      "slug must be lowercase letters, numbers and hyphens only."
    );
    expect(validateCategory({ name: "A", slug: "UPPER" })).toBe(
      "slug must be lowercase letters, numbers and hyphens only."
    );
    expect(validateCategory({ name: "A", slug: "-leading" })).toBe(
      "slug must be lowercase letters, numbers and hyphens only."
    );
    expect(validateCategory({ name: "A", slug: "men-s-fashion" })).toBeNull();
    expect(validateCategory({ name: "A" })).toBe(
      "slug must be lowercase letters, numbers and hyphens only."
    );
  });

  it("requires level to be an integer between 1 and 3 when present", () => {
    expect(validateCategory({ name: "A", slug: "a", level: 4 })).toBe(
      "Category level must be an integer between 1 and 3."
    );
    expect(validateCategory({ name: "A", slug: "a", level: 0 })).toBe(
      "Category level must be an integer between 1 and 3."
    );
    expect(validateCategory({ name: "A", slug: "a", level: 2.5 })).toBe(
      "Category level must be an integer between 1 and 3."
    );
    expect(validateCategory({ name: "A", slug: "a", level: 3 })).toBeNull();
  });

  it("rejects insecure optional URLs", () => {
    expect(validateCategory({ name: "A", slug: "a", image_url: "http://x" })).toBe(
      "Field 'image_url' must be an https URL or a relative path."
    );
    expect(validateCategory({ name: "A", slug: "a", banner_image_url: "ftp://x" })).toBe(
      "Field 'banner_image_url' must be an https URL or a relative path."
    );
    expect(
      validateCategory({
        name: "A",
        slug: "a",
        image_url: "https://x.com/a.png",
        banner_image_url: "/banner.png",
        icon: "Cpu",
        description: "Text",
      })
    ).toBeNull();
  });

  it("skips required-field checks when partial", () => {
    expect(validateCategory({ name: "New" }, { partial: true })).toBeNull();
    expect(validateCategory({}, { partial: true })).toBeNull();
    expect(validateCategory({ slug: "Bad Slug!" }, { partial: true })).toBe(
      "slug must be lowercase letters, numbers and hyphens only."
    );
  });
});

describe("validateBanner", () => {
  const valid = { title: "A", placement: "home_banner_layout" };

  it("accepts a minimal banner", () => {
    expect(validateBanner(valid)).toBeNull();
  });

  it("requires a title", () => {
    expect(validateBanner({ placement: "home_banner_layout" })).toBe("Banner title is required.");
    expect(validateBanner({ title: "  ", placement: "home_banner_layout" })).toBe(
      "Banner title is required."
    );
  });

  it("requires a known placement", () => {
    expect(validateBanner({ title: "A" })).toBe("Banner placement is required.");
    expect(validateBanner({ title: "A", placement: "sidebar" })).toBe(
      "Banner placement must be one of: home_banner_layout, home_promo_carousel, promo_strip."
    );
  });

  it("rejects insecure URLs", () => {
    expect(validateBanner({ ...valid, cta_path: "ftp://x" })).toContain("cta_path");
    expect(validateBanner({ ...valid, cta_path: "ftp://x" })).toBe(
      "Field 'cta_path' must be an https URL or a relative path."
    );
    expect(validateBanner({ ...valid, image_url: "http://x" })).toBe(
      "Field 'image_url' must be an https URL or a relative path."
    );
    expect(validateBanner({ ...valid, bg_image_url: "http://x" })).toBe(
      "Field 'bg_image_url' must be an https URL or a relative path."
    );
    expect(validateBanner({ ...valid, fallback_image_url: "http://x" })).toBe(
      "Field 'fallback_image_url' must be an https URL or a relative path."
    );
  });

  it("accepts an ordered ISO-8601 window", () => {
    expect(
      validateBanner({
        ...valid,
        starts_at: "2026-10-20T00:00:00.000Z",
        ends_at: "2026-10-31T23:59:59.000Z",
      })
    ).toBeNull();
  });

  it("rejects malformed timestamps and a backwards window", () => {
    expect(validateBanner({ ...valid, starts_at: "tomorrow" })).toBe(
      "starts_at must be an ISO-8601 timestamp."
    );
    expect(validateBanner({ ...valid, ends_at: "31/10/2026" })).toBe(
      "ends_at must be an ISO-8601 timestamp."
    );
    expect(validateBanner({ ...valid, starts_at: 42 })).toBe(
      "starts_at must be an ISO-8601 timestamp."
    );
    expect(
      validateBanner({
        ...valid,
        starts_at: "2026-10-31T00:00:00.000Z",
        ends_at: "2026-10-20T00:00:00.000Z",
      })
    ).toBe("ends_at must be after starts_at.");
  });

  it("skips required-field checks when partial", () => {
    expect(validateBanner({ title: "A" }, { partial: true })).toBeNull();
    expect(validateBanner({}, { partial: true })).toBeNull();
    expect(validateBanner({ placement: "sidebar" }, { partial: true })).toBe(
      "Banner placement must be one of: home_banner_layout, home_promo_carousel, promo_strip."
    );
    expect(validateBanner({ ends_at: "2026-10-20T00:00:00.000Z" }, { partial: true })).toBeNull();
  });
});

describe("validateFooterSection", () => {
  it("accepts a heading", () => {
    expect(validateFooterSection({ heading: "H" })).toBeNull();
  });

  it("requires a non-blank heading", () => {
    expect(validateFooterSection({})).toBe("Footer section heading is required.");
    expect(validateFooterSection({ heading: "   " })).toBe("Footer section heading is required.");
    expect(validateFooterSection({ heading: 42 })).toBe("Footer section heading is required.");
  });

  it("skips required-field checks when partial", () => {
    expect(validateFooterSection({ section_type: "tags" }, { partial: true })).toBeNull();
    expect(validateFooterSection({ heading: "" }, { partial: true })).toBe(
      "Footer section heading is required."
    );
  });
});

describe("validateFooterLink", () => {
  it("accepts a label and a relative href", () => {
    expect(validateFooterLink({ label: "L", href: "/help" })).toBeNull();
    expect(validateFooterLink({ label: "L", href: "https://x.com/help" })).toBeNull();
  });

  it("accepts a hash route, so a seeded footer row can be re-saved", () => {
    expect(validateFooterLink({ label: "L", href: "#/category/electronics/mobiles" })).toBeNull();
    expect(validateFooterLink({ label: "L", href: "#/" })).toBeNull();
    expect(validateFooterLink({ label: "L", href: "/help" })).toBeNull();
    expect(validateFooterLink({ label: "L", href: "https://x.com/help" })).toBeNull();
    expect(validateFooterLink({ label: "L", href: "#/cart" }, { partial: true })).toBeNull();
  });

  it("still rejects a javascript: href", () => {
    expect(validateFooterLink({ label: "L", href: "javascript:alert(1)" })).toBe(
      "Field 'href' must be an https URL or a relative path."
    );
  });

  it("requires a label", () => {
    expect(validateFooterLink({})).toBe("Footer link label is required.");
    expect(validateFooterLink({ label: "  ", href: "/help" })).toBe(
      "Footer link label is required."
    );
    expect(validateFooterLink({ label: 7, href: "/help" })).toBe("Footer link label is required.");
  });

  it("requires an href and keeps it https-or-relative", () => {
    expect(validateFooterLink({ label: "L" })).toBe("Footer link href is required.");
    expect(validateFooterLink({ label: "L", href: "" })).toBe("Footer link href is required.");
    expect(validateFooterLink({ label: "L", href: "http://x.com" })).toBe(
      "Field 'href' must be an https URL or a relative path."
    );
  });

  it("skips required-field checks when partial", () => {
    expect(validateFooterLink({ href: "/help" }, { partial: true })).toBeNull();
    expect(validateFooterLink({ label: "L" }, { partial: true })).toBeNull();
    expect(validateFooterLink({ href: "javascript:alert(1)" }, { partial: true })).toBe(
      "Field 'href' must be an https URL or a relative path."
    );
  });
});

describe("validateDepth", () => {
  it("accepts a root category with no parent", () => {
    expect(validateDepth({ level: 1, parent_id: null }, null)).toBeNull();
    expect(validateDepth({}, null)).toBeNull();
  });

  it("requires a parent below level 1", () => {
    expect(validateDepth({ level: 2, parent_id: null }, null)).toBe(
      "parent_id is required for categories below level 1."
    );
    expect(validateDepth({ level: 3, parent_id: "" }, null)).toBe(
      "parent_id is required for categories below level 1."
    );
  });

  it("rejects a parent on a level 1 category", () => {
    expect(validateDepth({ level: 1, parent_id: "p" }, null)).toBe(
      "Level 1 categories must not have a parent_id."
    );
  });

  it("requires the parent to be exactly one level above", () => {
    expect(validateDepth({ level: 3, parent_id: "p" }, { id: "p", level: 2 })).toBeNull();
    expect(validateDepth({ level: 3, parent_id: "p" }, { id: "p", level: 1 })).toBe(
      "Parent category must be at level 2 for a level 3 category."
    );
    expect(validateDepth({ level: 2, parent_id: "p" }, { id: "p", level: 2 })).toBe(
      "Parent category must be at level 1 for a level 2 category."
    );
    expect(validateDepth({ level: 2, parent_id: "p" }, { id: "p", level: 1 })).toBeNull();
  });

  it("reports a missing parent", () => {
    expect(validateDepth({ level: 2, parent_id: "p" }, null)).toBe("Parent category not found.");
  });

  it("caps depth at level 3", () => {
    expect(validateDepth({ level: 4, parent_id: "p" }, { id: "p", level: 3 })).toBe(
      "Category level must be an integer between 1 and 3."
    );
    expect(validateDepth({ level: "2", parent_id: "p" }, { id: "p", level: 1 })).toBe(
      "Category level must be an integer between 1 and 3."
    );
  });
});

describe("slugify", () => {
  it("matches the seeded path segments", () => {
    expect(slugify("Men's Fashion")).toBe("men-s-fashion");
    expect(slugify("Home & Kitchen")).toBe("home-kitchen");
    expect(slugify("TVs")).toBe("tvs");
  });

  it("lowercases and trims separator runs", () => {
    expect(slugify("  --Hello, World!  ")).toBe("hello-world");
    expect(slugify("electronics/accessories")).toBe("electronics-accessories");
  });

  it("returns an empty string when nothing alphanumeric remains", () => {
    expect(slugify("")).toBe("");
    expect(slugify("!!!")).toBe("");
    expect(slugify("   ")).toBe("");
  });
});
