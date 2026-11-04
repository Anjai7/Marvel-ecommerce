import { describe, expect, it, vi } from "vitest";
import {
  getHashRoute,
  navigateToPath,
  resolveMenuNavigation,
  getDashboardRouteForRole,
  getAuthRedirectRoute,
  isStorefrontRoute,
  isAdminRoute,
  isSuperAdminRoute,
  isStandaloneAdminView,
  isPageRoute,
  pageSlugFromPath,
} from "./routes";

describe("routes module", () => {
  describe("getHashRoute with override parameter", () => {
    it("handles root and category routes", () => {
      expect(getHashRoute("#/category/fashion/shoes")).toMatchObject({
        page: "category",
        path: "fashion/shoes",
      });
      expect(getHashRoute("")).toMatchObject({ page: "home", id: null });
      expect(getHashRoute("#/product/p-100")).toMatchObject({
        page: "product",
        id: "p-100",
      });
    });

    it("reads a page route", () => {
      expect(getHashRoute("#/pages/diwali-sale")).toMatchObject({
        page: "pages",
        id: "diwali-sale",
      });
    });

    it("reads a clean page path when there is no hash", () => {
      const pathname = vi
        .spyOn(window.location, "pathname", "get")
        .mockReturnValue("/pages/diwali-sale");
      try {
        expect(getHashRoute("")).toMatchObject({ page: "pages", id: "diwali-sale" });
        expect(pageSlugFromPath("/pages/diwali-sale")).toBe("diwali-sale");
        expect(pageSlugFromPath("/pages/diwali-sale/")).toBe("diwali-sale");
        expect(pageSlugFromPath("/category/electronics")).toBeNull();
        expect(pageSlugFromPath("/")).toBeNull();

        // An explicit "#/" is a navigation to the home page and wins over the
        // clean path.
        expect(getHashRoute("#/")).toMatchObject({ page: "home", id: null });
      } finally {
        pathname.mockRestore();
      }
    });

    it("resolves clean browser routes without hash requirement", () => {
      expect(getHashRoute("/login")).toMatchObject({ page: "login", id: null });
      expect(getHashRoute("/signup")).toMatchObject({ page: "signup", id: null });
      expect(getHashRoute("/admin")).toMatchObject({ page: "admin", id: null });
      expect(getHashRoute("/vendor")).toMatchObject({ page: "vendor", id: null });
      expect(getHashRoute("/account")).toMatchObject({ page: "account", id: null });
      expect(getHashRoute("/cart")).toMatchObject({ page: "cart", id: null });
      expect(getHashRoute("/product/101")).toMatchObject({ page: "product", id: "101" });
      expect(getHashRoute("/category/electronics/phones")).toMatchObject({
        page: "category",
        path: "electronics/phones",
      });
    });

    it("resolves clean routes from window.location.pathname when hash is empty", () => {
      const pathnameSpy = vi.spyOn(window.location, "pathname", "get");
      try {
        pathnameSpy.mockReturnValue("/login");
        expect(getHashRoute("")).toMatchObject({ page: "login" });

        pathnameSpy.mockReturnValue("/admin");
        expect(getHashRoute("")).toMatchObject({ page: "admin" });

        pathnameSpy.mockReturnValue("/cart");
        expect(getHashRoute("")).toMatchObject({ page: "cart" });

        pathnameSpy.mockReturnValue("/product/55");
        expect(getHashRoute("")).toMatchObject({ page: "product", id: "55" });

        pathnameSpy.mockReturnValue("/");
        expect(getHashRoute("")).toMatchObject({ page: "home" });
      } finally {
        pathnameSpy.mockRestore();
      }
    });

    it("strips hashtag from #/login and replaces URL with clean /login", () => {
      const replaceStateSpy = vi.spyOn(window.history, "replaceState");
      const hashSpy = vi.spyOn(window.location, "hash", "get").mockReturnValue("#/login");
      try {
        const route = getHashRoute();
        expect(route).toMatchObject({ page: "login" });
        expect(replaceStateSpy).toHaveBeenCalledWith(null, "", "/login");
      } finally {
        hashSpy.mockRestore();
        replaceStateSpy.mockRestore();
      }
    });

    it("rewrites /login#/admin to /#/admin to prevent pathname collision after login", () => {
      const replaceStateSpy = vi.spyOn(window.history, "replaceState");
      const pathnameSpy = vi.spyOn(window.location, "pathname", "get").mockReturnValue("/login");
      const hashSpy = vi.spyOn(window.location, "hash", "get").mockReturnValue("#/admin");
      try {
        const route = getHashRoute();
        expect(route).toMatchObject({ page: "admin" });
        expect(replaceStateSpy).toHaveBeenCalledWith(null, "", "/#/admin");
      } finally {
        pathnameSpy.mockRestore();
        hashSpy.mockRestore();
        replaceStateSpy.mockRestore();
      }
    });

    it("navigateToPath updates browser history or hash cleanly", () => {
      const pushSpy = vi.spyOn(window.history, "pushState");
      try {
        navigateToPath("/login");
        expect(pushSpy).toHaveBeenCalledWith({ route: "login" }, "", "/login");

        navigateToPath("cart");
        expect(pushSpy).toHaveBeenCalledWith({ route: "cart" }, "", "/cart");
      } finally {
        pushSpy.mockRestore();
      }
    });
  });

  describe("resolveMenuNavigation", () => {
    it("routes unauthenticated users to login with role prefill", () => {
      expect(resolveMenuNavigation("vendor", false)).toEqual({
        route: "login",
        role: "vendor",
      });
      expect(resolveMenuNavigation("admin-portal", false)).toEqual({
        route: "login",
        role: "admin",
      });
      expect(resolveMenuNavigation("super-admin", false)).toEqual({
        route: "login",
        role: "super_admin",
      });
      expect(resolveMenuNavigation("account", false)).toEqual({
        route: "login",
        role: "user",
      });
    });

    it("routes authenticated users directly to portals", () => {
      expect(resolveMenuNavigation("vendor", true)).toEqual({ route: "vendor" });
      expect(resolveMenuNavigation("admin", true)).toEqual({ route: "admin" });
      expect(resolveMenuNavigation("superadmin", true)).toEqual({ route: "super-admin" });
      expect(resolveMenuNavigation("customer-portal", true)).toEqual({ route: "account" });
    });

    it("handles products and categories", () => {
      expect(resolveMenuNavigation("product", false)).toEqual({ route: "product" });
      expect(resolveMenuNavigation("/category/electronics", false)).toEqual({
        route: "category/electronics",
      });
      expect(resolveMenuNavigation("unknown", false)).toEqual({ route: "" });
    });

    it("maps a page path to the pages route", () => {
      expect(resolveMenuNavigation("pages/diwali-sale", true)).toEqual({
        route: "pages/diwali-sale",
      });
    });

    it("maps a hash page path to the pages route", () => {
      expect(resolveMenuNavigation("#/pages/diwali-sale", true)).toEqual({
        route: "pages/diwali-sale",
      });
    });

    it("still maps a category path to the category route", () => {
      expect(resolveMenuNavigation("category/electronics", true)).toEqual({
        route: "category/electronics",
      });
      expect(resolveMenuNavigation("#/category/electronics", true)).toEqual({
        route: "category/electronics",
      });
    });
  });

  describe("getDashboardRouteForRole", () => {
    it("returns correct dashboard route", () => {
      expect(getDashboardRouteForRole("super_admin")).toBe("super-admin");
      expect(getDashboardRouteForRole("admin")).toBe("admin");
      expect(getDashboardRouteForRole("vendor")).toBe("vendor");
      expect(getDashboardRouteForRole("user")).toBe("account");
      expect(getDashboardRouteForRole(null)).toBe("account");
    });
  });

  describe("getAuthRedirectRoute", () => {
    it("returns correct redirect on auth", () => {
      expect(getAuthRedirectRoute("vendor")).toBe("vendor");
      expect(getAuthRedirectRoute("admin")).toBe("admin");
      expect(getAuthRedirectRoute("super_admin")).toBe("super-admin");
      expect(getAuthRedirectRoute("user")).toBe("");
    });
  });

  describe("route checkers", () => {
    it("identifies storefront routes", () => {
      expect(isStorefrontRoute("")).toBe(true);
      expect(isStorefrontRoute("home")).toBe(true);
      expect(isStorefrontRoute("product")).toBe(false);
    });

    it("identifies admin portal views", () => {
      expect(isAdminRoute("admin")).toBe(true);
      expect(isAdminRoute("admin-portal")).toBe(true);
      expect(isSuperAdminRoute("super-admin")).toBe(true);
      expect(isSuperAdminRoute("superadmin-dashboard")).toBe(true);
      expect(isStandaloneAdminView("admin")).toBe(true);
      expect(isStandaloneAdminView("super-admin")).toBe(true);
      expect(isStandaloneAdminView("home")).toBe(false);
    });

    it("isPageRoute is true for pages and page", () => {
      expect(isPageRoute("pages")).toBe(true);
      expect(isPageRoute("page")).toBe(true);
    });

    it("isPageRoute is false for category and product", () => {
      expect(isPageRoute("category")).toBe(false);
      expect(isPageRoute("product")).toBe(false);
      expect(isPageRoute("home")).toBe(false);
    });
  });
});
