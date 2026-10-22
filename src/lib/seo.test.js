// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { applySeo } from "./seo";

/** The head tags `applySeo` owns, so one test never leaks into the next. */
const MANAGED = [
  'meta[name="description"]',
  'meta[name="robots"]',
  'meta[property="og:title"]',
  'meta[property="og:description"]',
  'meta[property="og:image"]',
  'meta[property="og:url"]',
  'link[rel="canonical"]',
];

describe("applySeo", () => {
  beforeEach(() => {
    document.title = "Marvel";
    for (const selector of MANAGED) {
      for (const tag of document.head.querySelectorAll(selector)) tag.remove();
    }
  });

  it("sets the document title", () => {
    applySeo({ title: "Diwali Sale" });

    expect(document.title).toBe("Diwali Sale");
  });

  it("sets the description meta and creates it when absent", () => {
    expect(document.head.querySelector('meta[name="description"]')).toBeNull();

    applySeo({ description: "The big sale." });

    const meta = document.head.querySelector('meta[name="description"]');
    expect(meta).not.toBeNull();
    expect(meta.getAttribute("content")).toBe("The big sale.");

    applySeo({ description: "An even bigger sale." });
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(document.head.querySelector('meta[name="description"]').getAttribute("content")).toBe(
      "An even bigger sale."
    );
  });

  it("sets the canonical link", () => {
    applySeo({ canonical: "https://example.com/pages/diwali-sale" });

    const link = document.head.querySelector('link[rel="canonical"]');
    expect(link).not.toBeNull();
    expect(link.getAttribute("href")).toBe("https://example.com/pages/diwali-sale");

    // The link is updated, not duplicated.
    applySeo({ canonical: "https://example.com/pages/diwali-sale-2" });
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.head.querySelector('link[rel="canonical"]').getAttribute("href")).toBe(
      "https://example.com/pages/diwali-sale-2"
    );
  });

  it("sets the open graph title, description and image", () => {
    applySeo({
      title: "Diwali Sale",
      description: "The big sale.",
      ogImage: "https://example.com/sale.png",
    });

    expect(document.head.querySelector('meta[property="og:title"]').getAttribute("content")).toBe(
      "Diwali Sale"
    );
    expect(
      document.head.querySelector('meta[property="og:description"]').getAttribute("content")
    ).toBe("The big sale.");
    expect(document.head.querySelector('meta[property="og:image"]').getAttribute("content")).toBe(
      "https://example.com/sale.png"
    );
  });

  it("adds a noindex robots meta when noindex is true", () => {
    applySeo({ title: "Draft", noindex: true });

    const meta = document.head.querySelector('meta[name="robots"]');
    expect(meta).not.toBeNull();
    expect(meta.getAttribute("content")).toBe("noindex,nofollow");
  });

  it("removes the noindex robots meta when noindex is false", () => {
    applySeo({ title: "Draft", noindex: true });
    expect(document.head.querySelector('meta[name="robots"]')).not.toBeNull();

    applySeo({ title: "Published", noindex: false });

    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });

  it("does nothing when title is absent", () => {
    applySeo({});

    expect(document.title).toBe("Marvel");
    expect(document.head.querySelector('meta[name="description"]')).toBeNull();
    expect(document.head.querySelector('meta[property="og:title"]')).toBeNull();
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });
});
