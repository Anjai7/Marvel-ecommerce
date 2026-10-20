import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  apiFetchHeroSlides,
  apiSaveHeroSlide,
  apiUpdateCategory,
  apiFetchCategoryByPath,
  apiFetchCategoryBySlug,
  apiFetchMenuItems,
  apiFetchBanners,
  apiFetchFooter,
  apiReorderFooterLinks,
  apiUploadImage,
} from "./contentApi.js";

function jsonResponse(body, { status = 200 } = {}) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

let mockFetch;

beforeEach(() => {
  localStorage.removeItem("marvel_jwt_token");
  mockFetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.removeItem("marvel_jwt_token");
});

describe("content transport", () => {
  it("GETs the wrapped hero list and returns the body unchanged", async () => {
    const body = { slides: [{ id: "h1", title: "One" }] };
    mockFetch.mockResolvedValue(jsonResponse(body));

    await expect(apiFetchHeroSlides()).resolves.toEqual(body);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/content/hero");
    expect(options.method).toBe("GET");
  });

  it("asks for inactive hero slides only when requested", async () => {
    await apiFetchHeroSlides({ includeInactive: true });

    expect(mockFetch.mock.calls[0][0]).toBe("/api/content/hero?includeInactive=1");
  });

  it("POSTs a hero slide as JSON", async () => {
    await apiSaveHeroSlide({ title: "One", is_active: true });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/content/hero");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ title: "One", is_active: true });
  });

  it("PATCHes a category by id", async () => {
    await apiUpdateCategory("cat-1", { is_active: false });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/categories/cat-1");
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body)).toEqual({ is_active: false });
  });

  it("looks a category up by its exact ancestor path", async () => {
    await apiFetchCategoryByPath("electronics/mobiles");

    expect(mockFetch.mock.calls[0][0]).toBe("/api/categories/path?path=electronics%2Fmobiles");
  });

  it("looks a category up by slug", async () => {
    await apiFetchCategoryBySlug("watches");

    expect(mockFetch.mock.calls[0][0]).toBe("/api/categories/slug/watches");
  });

  it("returns the bare menu array and sends role plus includeInactive", async () => {
    const menu = [{ id: "m1", title: "Home" }];
    mockFetch.mockResolvedValue(jsonResponse(menu));

    await expect(apiFetchMenuItems()).resolves.toEqual(menu);
    expect(mockFetch.mock.calls[0][0]).toBe("/api/menu?role=user");

    await apiFetchMenuItems("admin", { includeInactive: true });
    expect(mockFetch.mock.calls[1][0]).toBe("/api/menu?role=admin&includeInactive=1");
  });

  it("narrows banners by placement", async () => {
    await apiFetchBanners({ placement: "home_promo_carousel" });

    expect(mockFetch.mock.calls[0][0]).toBe("/api/content/banners?placement=home_promo_carousel");
  });

  it("GETs the footer sections and links together", async () => {
    await apiFetchFooter();

    expect(mockFetch.mock.calls[0][0]).toBe("/api/content/footer");
  });

  it("PATCHes a footer link reorder with an orders array", async () => {
    const list = [{ id: "l1", display_order: 0 }];
    await apiReorderFooterLinks(list);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/content/footer/links/reorder");
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body)).toEqual({ orders: list });
  });

  it("uploads multipart without a Content-Type header", async () => {
    const file = new File(["pixels"], "hero.png", { type: "image/png" });
    mockFetch.mockResolvedValue(jsonResponse({ url: "https://cdn.test/hero.png" }));

    const data = await apiUploadImage(file, "marvel_content");

    expect(data).toEqual({ url: "https://cdn.test/hero.png" });
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/upload");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBeUndefined();
    expect(options.body.get("image")).toBe(file);
    expect(options.body.get("folder")).toBe("marvel_content");
  });

  it("propagates a transport failure instead of returning an empty list", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ error: "Could not load content." }, { status: 500 })
    );

    await expect(apiFetchBanners()).rejects.toThrow("Could not load content.");
  });
});
