import { describe, expect, it } from "vitest";
import { getHashRoute, menuPathToCategoryPath } from "./App";

describe("getHashRoute", () => {
  it("carries the whole category ancestor path, not just the first segment", () => {
    window.location.hash = "#/category/electronics/mobiles/smartphones";

    expect(getHashRoute()).toMatchObject({
      page: "category",
      path: "electronics/mobiles/smartphones",
      id: "electronics/mobiles/smartphones",
    });
  });

  it("URL-decodes the category path and strips a trailing slash", () => {
    window.location.hash = "#/category/home-kitchen/cook%20ware/";

    expect(getHashRoute()).toMatchObject({
      page: "category",
      path: "home-kitchen/cook ware",
    });
  });

  it("keeps the product route's single id", () => {
    window.location.hash = "#/product/42";

    expect(getHashRoute()).toMatchObject({ page: "product", id: "42", path: null });
  });

  it("treats an empty hash as the home page", () => {
    window.location.hash = "";

    expect(getHashRoute()).toMatchObject({ page: "home", id: null, full: "" });
  });
});

describe("menuPathToCategoryPath", () => {
  it("strips the leading /category/ from a menu path", () => {
    expect(menuPathToCategoryPath("/category/electronics/mobiles")).toBe("electronics/mobiles");
  });

  it("accepts the hash-route form allowed by the content spec", () => {
    expect(menuPathToCategoryPath("#/category/electronics/mobiles")).toBe("electronics/mobiles");
  });

  it("accepts the bare category root without bouncing home", () => {
    expect(menuPathToCategoryPath("/category")).toBe("");
    expect(menuPathToCategoryPath("#/category")).toBe("");
  });

  it("ignores paths that are not under /category/", () => {
    expect(menuPathToCategoryPath("/products")).toBeNull();
    expect(menuPathToCategoryPath("/vendor-dashboard")).toBeNull();
  });
});
