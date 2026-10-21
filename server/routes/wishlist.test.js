// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("../db.js", () => ({ supabase: { from: mockFrom } }));

import app from "../app.js";
import { signUserToken } from "../middleware/auth.js";

/**
 * Chainable Supabase double. The wishlist routes read with `maybeSingle()`,
 * list by awaiting the builder and write with `insert().select().single()` or
 * `delete()`, so every operation is recorded and answered per table.
 */
function makeDb(handlers = {}) {
  const calls = {
    tables: [],
    select: [],
    eq: [],
    order: [],
    in: [],
    insert: [],
    deleteTables: [],
    maybeSingle: 0,
    single: 0,
  };

  mockFrom.mockReset();
  mockFrom.mockImplementation((table) => {
    calls.tables.push(table);
    const state = { table, op: null, columns: null };

    const query = {
      select(columns) {
        if (state.op === null) state.op = "select";
        state.columns = columns;
        calls.select.push({ table, columns });
        return query;
      },
      eq(column, value) {
        calls.eq.push([table, column, value]);
        return query;
      },
      order(column, options) {
        calls.order.push([table, column, options]);
        return query;
      },
      in(column, values) {
        calls.in.push([table, column, values]);
        return query;
      },
      insert(rows) {
        state.op = "insert";
        calls.insert.push({ table, rows });
        return query;
      },
      delete() {
        state.op = "delete";
        calls.deleteTables.push(table);
        return query;
      },
      maybeSingle() {
        calls.maybeSingle += 1;
        const result = handlers.maybeSingle
          ? handlers.maybeSingle(state, table, calls)
          : { data: null, error: null };
        return Promise.resolve(result);
      },
      single() {
        calls.single += 1;
        const result = handlers.single
          ? handlers.single(state, table, calls)
          : { data: null, error: null };
        return Promise.resolve(result);
      },
      then(onFulfilled, onRejected) {
        const result = handlers[state.op]
          ? handlers[state.op](state, table, calls)
          : { data: [], error: null };
        return Promise.resolve(result).then(onFulfilled, onRejected);
      },
    };

    return query;
  });

  return calls;
}

const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";

const productRow = {
  id: PRODUCT_ID,
  title: "Aurora Headphones",
  price: "2499.00",
  category: "Headphones",
};

const wishlistRow = {
  id: "wishlist-1",
  user_id: "t-user-a",
  product_id: PRODUCT_ID,
  created_at: "2026-10-20T09:00:00.000Z",
};

describe("wishlist API", () => {
  let server;
  let base;
  let userAHeaders;
  let userBHeaders;

  beforeAll(
    () =>
      new Promise((resolve) => {
        server = app.listen(0, () => {
          base = `http://127.0.0.1:${server.address().port}`;
          userAHeaders = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${signUserToken({
              id: "t-user-a",
              email: "a@test.local",
              role: "user",
            })}`,
          };
          userBHeaders = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${signUserToken({
              id: "t-user-b",
              email: "b@test.local",
              role: "user",
            })}`,
          };
          resolve();
        });
      })
  );

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  beforeEach(() => {
    mockFrom.mockReset();
  });

  const get = (path, headers) => fetch(`${base}${path}`, { headers });
  const send = (method, path, body, headers) =>
    fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  it("GET /api/account/wishlist requires auth and queries nothing without a token", async () => {
    const calls = makeDb();

    const res = await get("/api/account/wishlist");

    expect(res.status).toBe(401);
    expect((await res.json()).error).toEqual(expect.any(String));
    expect(calls.tables).toEqual([]);
  });

  it("GET /api/account/wishlist returns the caller's rows with their product", async () => {
    const calls = makeDb({
      select: (state, table) => {
        if (table === "wishlist") return { data: [wishlistRow], error: null };
        if (table === "products") return { data: [productRow], error: null };
        return { data: [], error: null };
      },
    });

    const res = await get("/api/account/wishlist", userAHeaders);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: [
        {
          id: wishlistRow.id,
          product_id: PRODUCT_ID,
          created_at: wishlistRow.created_at,
          product: productRow,
        },
      ],
    });
    expect(calls.eq).toContainEqual(["wishlist", "user_id", "t-user-a"]);
    expect(calls.eq.some(([table, column]) => table === "products" && column === "user_id")).toBe(
      false
    );
    expect(calls.in).toEqual([["products", "id", [PRODUCT_ID]]]);
    expect(calls.order).toContainEqual(["wishlist", "created_at", { ascending: false }]);
  });

  it("scopes each caller to their own rows", async () => {
    const calls = makeDb({ select: () => ({ data: [], error: null }) });

    await get("/api/account/wishlist", userBHeaders);

    expect(calls.eq).toContainEqual(["wishlist", "user_id", "t-user-b"]);
    expect(calls.eq.some(([, column, value]) => column === "user_id" && value === "t-user-a")).toBe(
      false
    );
  });

  it("POST /api/account/wishlist requires auth", async () => {
    const calls = makeDb();

    const res = await send("POST", "/api/account/wishlist", { product_id: PRODUCT_ID });

    expect(res.status).toBe(401);
    expect(calls.insert).toEqual([]);
  });

  it("POST /api/account/wishlist creates the caller's row and ignores a body user_id", async () => {
    const created = { id: "wishlist-new", user_id: "t-user-a", product_id: PRODUCT_ID };
    const calls = makeDb({
      maybeSingle: (state, table) =>
        table === "wishlist"
          ? { data: null, error: null }
          : { data: { id: PRODUCT_ID }, error: null },
      single: () => ({ data: created, error: null }),
    });

    const res = await send(
      "POST",
      "/api/account/wishlist",
      { product_id: PRODUCT_ID, user_id: "someone-else" },
      userAHeaders
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ item: created });
    expect(calls.insert).toEqual([
      { table: "wishlist", rows: [{ user_id: "t-user-a", product_id: PRODUCT_ID }] },
    ]);
  });

  it("POST /api/account/wishlist is idempotent and returns the existing item", async () => {
    const existing = { id: "wishlist-1", user_id: "t-user-a", product_id: PRODUCT_ID };
    const calls = makeDb({
      maybeSingle: () => ({ data: existing, error: null }),
    });

    const res = await send(
      "POST",
      "/api/account/wishlist",
      { product_id: PRODUCT_ID },
      userAHeaders
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ item: existing });
    expect(calls.insert).toEqual([]);
    expect(calls.single).toBe(0);
  });

  it("POST /api/account/wishlist rejects a missing product_id", async () => {
    const calls = makeDb();

    const res = await send("POST", "/api/account/wishlist", {}, userAHeaders);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "product_id is required." });
    expect(calls.insert).toEqual([]);
  });

  it("DELETE /api/account/wishlist/:productId requires auth", async () => {
    const calls = makeDb();

    const res = await send("DELETE", `/api/account/wishlist/${PRODUCT_ID}`);

    expect(res.status).toBe(401);
    expect(calls.deleteTables).toEqual([]);
  });

  it("DELETE /api/account/wishlist/:productId removes only the caller's row and returns 204", async () => {
    const calls = makeDb({
      delete: () => ({ data: null, error: null }),
    });

    const res = await send(
      "DELETE",
      `/api/account/wishlist/${PRODUCT_ID}`,
      undefined,
      userAHeaders
    );

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(calls.deleteTables).toEqual(["wishlist"]);
    expect(calls.eq).toContainEqual(["wishlist", "user_id", "t-user-a"]);
    expect(calls.eq).toContainEqual(["wishlist", "product_id", PRODUCT_ID]);
  });
});
