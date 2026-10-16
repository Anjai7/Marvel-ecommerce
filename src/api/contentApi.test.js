import { describe, it, expect, vi, afterEach } from "vitest";
import { apiFetchHeroSlides, apiFetchSiteCategories, apiSaveHeroSlide } from "./backendApi.js";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.removeItem("marvel_jwt_token");
});

describe("content api client", () => {
  it("returns [] on network failure instead of throwing", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("down")));
    const res = await apiFetchHeroSlides();
    expect(res).toEqual([]);
  });

  it("returns [] for categories on network failure instead of throwing", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("down")));
    const res = await apiFetchSiteCategories();
    expect(res).toEqual([]);
  });

  it("save without token throws/401", async () => {
    localStorage.removeItem("marvel_jwt_token");
    vi.stubGlobal("fetch", () =>
      Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Access denied. No authorization header provided." }),
      })
    );
    await expect(apiSaveHeroSlide({ title: "Test slide", order_index: 0 })).rejects.toThrow(
      "Access denied"
    );
  });
});
