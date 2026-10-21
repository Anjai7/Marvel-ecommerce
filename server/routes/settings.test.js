// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("../db.js", () => ({ supabase: { from: mockFrom } }));

import app from "../app.js";

/**
 * Chainable Supabase double. `site_settings` is read with a single awaited
 * `select("key, value")`, so the handler answers that operation.
 */
function makeDb(handler) {
  const calls = { tables: [], select: [] };

  mockFrom.mockReset();
  mockFrom.mockImplementation((table) => {
    calls.tables.push(table);
    const state = { table, columns: null };

    const query = {
      select(columns) {
        state.columns = columns;
        calls.select.push({ table, columns });
        return query;
      },
      eq() {
        return query;
      },
      order() {
        return query;
      },
      then(onFulfilled, onRejected) {
        const result = handler ? handler(state, table, calls) : { data: [], error: null };
        return Promise.resolve(result).then(onFulfilled, onRejected);
      },
    };

    return query;
  });

  return calls;
}

describe("settings API", () => {
  let server;
  let base;

  beforeAll(
    () =>
      new Promise((resolve) => {
        server = app.listen(0, () => {
          base = `http://127.0.0.1:${server.address().port}`;
          resolve();
        });
      })
  );

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  beforeEach(() => {
    mockFrom.mockReset();
  });

  const get = (path, headers) => fetch(`${base}${path}`, { headers });

  it("GET /api/settings returns the stored key -> value map without auth", async () => {
    const rows = [
      {
        key: "currency",
        value: { code: "INR", symbol: "₹", locale: "en-IN" },
      },
      {
        key: "store",
        value: { name: "Marvel", tagline: "Everything store", country: "IN" },
      },
    ];
    const calls = makeDb(() => ({ data: rows, error: null }));

    const res = await get("/api/settings");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      settings: {
        currency: { code: "INR", symbol: "₹", locale: "en-IN" },
        store: { name: "Marvel", tagline: "Everything store", country: "IN" },
      },
    });
    expect(calls.tables).toEqual(["site_settings"]);
    expect(calls.select).toEqual([{ table: "site_settings", columns: "key, value" }]);
  });

  it("omits keys with no stored row and returns an empty map for an empty table", async () => {
    makeDb(() => ({ data: [{ key: "reviews", value: { allow_write: true } }], error: null }));

    const first = await get("/api/settings");
    expect(await first.json()).toEqual({ settings: { reviews: { allow_write: true } } });

    makeDb(() => ({ data: [], error: null }));
    const second = await get("/api/settings");
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ settings: {} });
  });

  it("passes a stored JSON null through instead of inventing a value", async () => {
    makeDb(() => ({ data: [{ key: "shipping", value: null }], error: null }));

    const res = await get("/api/settings");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ settings: { shipping: null } });
  });

  it("surfaces a read error as 500", async () => {
    makeDb(() => ({ data: null, error: { message: "db boom" } }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await get("/api/settings");

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Could not load settings." });
  });
});
