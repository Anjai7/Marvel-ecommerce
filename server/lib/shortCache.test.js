import { describe, expect, it, vi } from "vitest";
import { CATALOGUE_TTL_MS, cacheSize, cached, clearCache } from "./shortCache";

describe("the short cache", () => {
  it("answers a second call without loading again", async () => {
    clearCache();
    const loader = vi.fn().mockResolvedValue({ items: [1, 2, 3] });

    const first = await cached("catalogue", CATALOGUE_TTL_MS, loader);
    const second = await cached("catalogue", CATALOGUE_TTL_MS, loader);

    expect(second).toEqual({ items: [1, 2, 3] });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(cacheSize()).toBe(1);
  });

  it("loads again once the entry has expired", async () => {
    clearCache();
    const loader = vi.fn().mockResolvedValue("fresh");
    const ttl = 5;

    await cached("catalogue", ttl, loader);
    await new Promise((resolve) => setTimeout(resolve, ttl + 5));
    await cached("catalogue", ttl, loader);

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("does not keep a load that failed", async () => {
    clearCache();
    const loader = vi.fn().mockRejectedValue(new Error("db boom"));

    await expect(cached("catalogue", CATALOGUE_TTL_MS, loader)).rejects.toThrow("db boom");
    expect(cacheSize()).toBe(0);

    // The next request tries again instead of remembering the failure.
    loader.mockResolvedValue("recovered");
    await expect(cached("catalogue", CATALOGUE_TTL_MS, loader)).resolves.toBe("recovered");
  });

  it("keeps different keys apart", async () => {
    clearCache();
    const loader = vi.fn(async (key) => key);

    await cached("a", CATALOGUE_TTL_MS, () => loader("a"));
    await cached("b", CATALOGUE_TTL_MS, () => loader("b"));

    expect(cacheSize()).toBe(2);
  });

  it("empties on clear", async () => {
    clearCache();
    const loader = vi.fn().mockResolvedValue(1);

    await cached("a", CATALOGUE_TTL_MS, loader);
    expect(cacheSize()).toBe(1);

    clearCache();
    await cached("a", CATALOGUE_TTL_MS, loader);

    expect(loader).toHaveBeenCalledTimes(2);
    expect(cacheSize()).toBe(1);
  });
});
