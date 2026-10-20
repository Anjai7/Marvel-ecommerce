// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("../db.js", () => ({ supabase: { from: mockFrom } }));

import app from "../app.js";

/**
 * Chainable Supabase double. Every query is recorded; a test asserts the exact
 * `.in()` / `.ilike()` / `.or()` filter and the exact insert/update payload.
 */
function makeDb(handlers = {}) {
  const calls = {
    tables: [],
    select: [],
    eq: [],
    order: [],
    in: [],
    or: [],
    ilike: [],
    insert: [],
    update: [],
    maybeSingle: 0,
    single: 0,
  };

  mockFrom.mockReset();
  mockFrom.mockImplementation((table) => {
    calls.tables.push(table);
    const state = { op: null, columns: null, table };

    const query = {
      select(columns) {
        if (state.op === null) state.op = "select";
        state.columns = columns;
        calls.select.push({ table, columns });
        return query;
      },
      eq(column, value) {
        calls.eq.push([column, value]);
        return query;
      },
      order(column, options) {
        calls.order.push([column, options]);
        return query;
      },
      in(column, values) {
        calls.in.push([column, values]);
        return query;
      },
      or(value) {
        calls.or.push(value);
        return query;
      },
      ilike(column, value) {
        calls.ilike.push([column, value]);
        return query;
      },
      insert(rows) {
        state.op = "insert";
        calls.insert.push(rows);
        return query;
      },
      update(row) {
        state.op = "update";
        calls.update.push(row);
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

const electronics = {
  id: "cat-electronics",
  name: "Electronics",
  slug: "electronics",
  parent_id: null,
  level: 1,
};
const mobiles = {
  id: "cat-mobiles",
  name: "Mobiles",
  slug: "mobiles",
  parent_id: electronics.id,
  level: 2,
};
const smartphones = {
  id: "cat-smartphones",
  name: "Smartphones",
  slug: "smartphones",
  parent_id: mobiles.id,
  level: 3,
};
const fashion = {
  id: "cat-fashion",
  name: "Fashion",
  slug: "fashion",
  parent_id: null,
  level: 1,
};
const allCategories = [electronics, mobiles, smartphones, fashion];

const product = (overrides = {}) => ({
  id: "prod-1",
  title: "Aurora Phone",
  price: "49999",
  category: "Mobiles",
  category_id: mobiles.id,
  stock: "5",
  image_url: "https://example.com/phone.jpg",
  created_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("products API category binding", () => {
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

  const get = (path) => fetch(`${base}${path}`);
  const send = (method, path, body) =>
    fetch(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  it("GET /api/products?categoryPath resolves the path and filters category_id with the descendant ids", async () => {
    const calls = makeDb({
      select: (state) =>
        state.table === "categories"
          ? { data: allCategories, error: null }
          : { data: [product()], error: null },
    });

    const res = await get("/api/products?categoryPath=electronics");

    expect(res.status).toBe(200);
    expect(res.headers.get("x-category-not-found")).toBeNull();
    const body = await res.json();
    expect(body.map((row) => row.id)).toEqual(["prod-1"]);
    expect(calls.in).toEqual([["category_id", [electronics.id, mobiles.id, smartphones.id]]]);
    expect(calls.ilike).toEqual([]);
    expect(calls.select.map((entry) => entry.table)).toContain("categories");
  });

  it("GET /api/products?categoryPath rejects a deeper path than the taxonomy has", async () => {
    const calls = makeDb({
      select: () => ({ data: allCategories, error: null }),
    });

    const res = await get("/api/products?categoryPath=electronics/mobiles/smartphones/extra");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(res.headers.get("x-category-not-found")).toBe("true");
    expect(calls.tables).toEqual(["categories"]);
  });

  it("GET /api/products?categoryPath for an unknown path returns 200 [] plus the not-found header", async () => {
    const calls = makeDb({
      select: () => ({ data: allCategories, error: null }),
    });

    const res = await get("/api/products?categoryPath=does/not/exist");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(res.headers.get("x-category-not-found")).toBe("true");
    expect(calls.tables).toEqual(["categories"]);
    expect(calls.in).toEqual([]);
  });

  it("GET /api/products?categoryId expands the id to its descendants", async () => {
    const calls = makeDb({
      select: (state) =>
        state.table === "categories"
          ? { data: allCategories, error: null }
          : { data: [product()], error: null },
    });

    const res = await get(`/api/products?categoryId=${mobiles.id}`);

    expect(res.status).toBe(200);
    expect(calls.in).toEqual([["category_id", [mobiles.id, smartphones.id]]]);
  });

  it("GET /api/products?categoryId for an unknown id returns 200 [] plus the not-found header", async () => {
    makeDb({ select: () => ({ data: allCategories, error: null }) });

    const res = await get("/api/products?categoryId=ghost-category");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(res.headers.get("x-category-not-found")).toBe("true");
  });

  it("GET /api/products?category (free text) keeps ilike and never queries categories", async () => {
    const calls = makeDb({ select: () => ({ data: [product()], error: null }) });

    const res = await get("/api/products?category=Electronics");

    expect(res.status).toBe(200);
    expect(calls.ilike).toEqual([["category", "Electronics"]]);
    expect(calls.tables).toEqual(["products"]);
    expect(calls.in).toEqual([]);
  });

  it("GET /api/products with no category parameter never queries categories", async () => {
    const calls = makeDb({ select: () => ({ data: [product()], error: null }) });

    const res = await get("/api/products");

    expect(res.status).toBe(200);
    expect(calls.tables).toEqual(["products"]);
    expect(calls.ilike).toEqual([]);
    expect(calls.in).toEqual([]);
  });

  it("GET /api/products escapes search operators before interpolating into .or()", async () => {
    const calls = makeDb({ select: () => ({ data: [product()], error: null }) });

    const res = await get(`/api/products?search=${encodeURIComponent("a,b.c(d)e")}`);

    expect(res.status).toBe(200);
    expect(calls.or).toEqual(["title.ilike.%a b c d e%,description.ilike.%a b c d e%"]);
    expect(calls.tables).toEqual(["products"]);
  });

  it("GET /api/products surfaces a list database error as 500, never an empty list", async () => {
    makeDb({ select: () => ({ data: null, error: { message: "db list boom" } }) });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await get("/api/products");

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toEqual(expect.any(String));
    expect(body.error).not.toContain("db list boom");
  });

  it("POST /api/products fills category from the category name when only category_id is sent", async () => {
    const saved = product({ category: "Mobiles", category_id: mobiles.id });
    const calls = makeDb({
      maybeSingle: () => ({ data: { id: mobiles.id, name: mobiles.name }, error: null }),
      single: (state) =>
        state.op === "insert" ? { data: saved, error: null } : { data: null, error: null },
    });

    const res = await send("POST", "/api/products", {
      title: "Aurora Phone",
      price: 49999,
      category_id: mobiles.id,
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.product.category).toBe("Mobiles");
    expect(calls.insert).toHaveLength(1);
    expect(calls.insert[0][0]).toMatchObject({
      title: "Aurora Phone",
      category: "Mobiles",
      category_id: mobiles.id,
    });
  });

  it("POST /api/products with both category and category_id keeps the sent label", async () => {
    const calls = makeDb({
      maybeSingle: () => ({ data: { id: mobiles.id, name: mobiles.name }, error: null }),
      single: () => ({ data: product({ category: "Phones" }), error: null }),
    });

    const res = await send("POST", "/api/products", {
      title: "Aurora Phone",
      price: 49999,
      category: "Phones",
      category_id: mobiles.id,
    });

    expect(res.status).toBe(201);
    expect(calls.insert[0][0].category).toBe("Phones");
  });

  it("POST /api/products with an unknown category_id is 400 and writes nothing", async () => {
    const calls = makeDb({ maybeSingle: () => ({ data: null, error: null }) });

    const res = await send("POST", "/api/products", {
      title: "Aurora Phone",
      price: 49999,
      category_id: "ghost-category",
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Category not found." });
    expect(calls.insert).toEqual([]);
  });

  it("PUT /api/products/:id fills category from category_id when no label is sent", async () => {
    const calls = makeDb({
      maybeSingle: () => ({ data: { id: mobiles.id, name: mobiles.name }, error: null }),
      single: () => ({ data: product(), error: null }),
    });

    const res = await send("PUT", "/api/products/prod-1", {
      category_id: mobiles.id,
      stock: 3,
    });

    expect(res.status).toBe(200);
    expect(calls.update).toEqual([{ category_id: mobiles.id, stock: 3, category: "Mobiles" }]);
  });

  it("PUT /api/products/:id with an unknown category_id is 400 and writes nothing", async () => {
    const calls = makeDb({ maybeSingle: () => ({ data: null, error: null }) });

    const res = await send("PUT", "/api/products/prod-1", {
      category_id: "ghost-category",
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Category not found." });
    expect(calls.update).toEqual([]);
  });
});
