import { describe, it, expect, vi } from "vitest";
import { toAppHref, followStoredLink } from "./linkTarget";

describe("toAppHref", () => {
  it("normalises a hash route into a clean path", () => {
    expect(toAppHref("#/category/electronics")).toBe("/category/electronics");
  });

  it("keeps a clean bare path", () => {
    expect(toAppHref("/help")).toBe("/help");
  });

  it("keeps an absolute https URL", () => {
    expect(toAppHref("https://example.com/x")).toBe("https://example.com/x");
  });

  it("falls back to the app root for anything else", () => {
    expect(toAppHref("")).toBe("/");
    expect(toAppHref(null)).toBe("/");
    expect(toAppHref(undefined)).toBe("/");
    expect(toAppHref("javascript:alert(1)")).toBe("/");
    expect(toAppHref("mailto:a@b.c")).toBe("/");
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

  it("uses history pushState for an in-app link without hash", () => {
    const pushSpy = vi.spyOn(window.history, "pushState");
    try {
      followStoredLink("/help");
      expect(pushSpy).toHaveBeenCalledWith({ route: "help" }, "", "/help");

      followStoredLink("#/cart");
      expect(pushSpy).toHaveBeenCalledWith({ route: "cart" }, "", "/cart");
    } finally {
      pushSpy.mockRestore();
    }
  });

  it("does nothing for an empty link", () => {
    const pushSpy = vi.spyOn(window.history, "pushState");
    try {
      followStoredLink("");
      expect(pushSpy).not.toHaveBeenCalled();
    } finally {
      pushSpy.mockRestore();
    }
  });
});
