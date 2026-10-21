// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("../db.js", () => ({ supabase: { from: mockFrom } }));

import app from "../app.js";
import { signUserToken } from "../middleware/auth.js";

/** A signed-in admin token, as `server/middleware/auth.js` expects one. */
const adminToken = () =>
  signUserToken({ id: "t-settings-admin", email: "admin@test.local", role: "admin" });

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

  describe("PUT /api/settings", () => {
    /** A signed-in admin token, as `server/middleware/auth.js` expects one. */
    const adminHeaders = { Authorization: `Bearer ${adminToken()}` };

    it("refuses an unauthenticated write", async () => {
      makeDb(() => ({ data: [], error: null }));

      const res = await fetch(`${base}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { store: { name: "X" } } }),
      });

      expect(res.status).toBe(401);
    });

    it("rejects a key the store does not know, so a typo cannot create a dead row", async () => {
      makeDb(() => ({ data: [], error: null }));

      const res = await fetch(`${base}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...adminHeaders },
        body: JSON.stringify({ settings: { nonsense: { a: 1 } } }),
      });

      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("Unknown settings key.");
    });

    it("upserts a known key and returns the stored map", async () => {
      const upserts = [];
      const calls = makeDb((state, table) => {
        if (state.op === "upsert") return { data: [], error: null };
        return { data: [{ key: "store", value: { name: "Marvel India" } }], error: null };
      });
      mockFrom.mockImplementation((table) => {
        const state = { op: null, rows: null };
        const query = {
          select() {
            state.op = state.op || "select";
            return query;
          },
          eq() {
            return query;
          },
          upsert(rows) {
            state.op = "upsert";
            state.rows = rows;
            upserts.push({ table, rows });
            return query;
          },
          delete() {
            state.op = "delete";
            return query;
          },
          then(onFulfilled, onRejected) {
            const result =
              state.op === "upsert"
                ? { data: [], error: null }
                : { data: [{ key: "store", value: { name: "Marvel India" } }], error: null };
            return Promise.resolve(result).then(onFulfilled, onRejected);
          },
        };
        return query;
      });

      const res = await fetch(`${base}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...adminHeaders },
        body: JSON.stringify({ settings: { store: { name: "Marvel India" } } }),
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ settings: { store: { name: "Marvel India" } } });
      expect(upserts).toHaveLength(1);
      expect(upserts[0].table).toBe("site_settings");
      expect(upserts[0].rows[0]).toMatchObject({ key: "store" });
      expect(calls).toBeDefined();
    });

    it("removes the row when a value is null", async () => {
      const deletes = [];
      mockFrom.mockImplementation((table) => {
        const state = { op: null };
        const query = {
          select() {
            return query;
          },
          eq() {
            return query;
          },
          upsert() {
            state.op = "upsert";
            return query;
          },
          delete() {
            state.op = "delete";
            deletes.push(table);
            return query;
          },
          then(onFulfilled, onRejected) {
            const result =
              state.op === "delete" ? { data: [], error: null } : { data: [], error: null };
            return Promise.resolve(result).then(onFulfilled, onRejected);
          },
        };
        return query;
      });

      const res = await fetch(`${base}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...adminHeaders },
        body: JSON.stringify({ settings: { trust: null } }),
      });

      expect(res.status).toBe(200);
      expect(deletes).toEqual(["site_settings"]);
    });
  });
});
