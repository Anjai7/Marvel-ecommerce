import { describe, it, expect } from "vitest";
import { toAppHref, followStoredLink } from "./linkTarget";

describe("toAppHref", () => {
  it("keeps a hash route as it is", () => {
    expect(toAppHref("#/category/electronics")).toBe("#/category/electronics");
  });

  it("normalises a bare path into a hash route", () => {
    // `/help` is not a route in this hash-routed app: left alone it causes a
    // full page load and a 404.
    expect(toAppHref("/help")).toBe("#/help");
  });

  it("keeps an absolute https URL", () => {
    expect(toAppHref("https://example.com/x")).toBe("https://example.com/x");
  });

  it("falls back to the app root for anything else", () => {
    expect(toAppHref("")).toBe("#/");
    expect(toAppHref(null)).toBe("#/");
    expect(toAppHref(undefined)).toBe("#/");
    expect(toAppHref("javascript:alert(1)")).toBe("#/");
    expect(toAppHref("mailto:a@b.c")).toBe("#/");
  });
});

describe("followStoredLink", () => {
  it("navigates away for an absolute https URL", () => {
    const original = window.location;
    delete window.location;
    window.location = { href: "", hash: "" };

    followStoredLink("https://example.com/x");

    expect(window.location.href).toBe("https://example.com/x");
    window.location = original;
  });

  it("uses the hash for an in-app link", () => {
    const original = window.location;
    delete window.location;
    window.location = { href: "", hash: "" };

    followStoredLink("/help");
    expect(window.location.hash).toBe("#/help");

    followStoredLink("#/cart");
    expect(window.location.hash).toBe("#/cart");

    window.location = original;
  });

  it("does nothing for an empty link", () => {
    const original = window.location;
    delete window.location;
    window.location = { href: "", hash: "" };

    followStoredLink("");

    expect(window.location.hash).toBe("");
    window.location = original;
  });
});
