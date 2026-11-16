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
    upsert: [],
    delete: [],
    writes: [],
    maybeSingle: 0,
    single: 0,
  };

  mockFrom.mockReset();
  mockFrom.mockImplementation((table) => {
    calls.tables.push(table);
    const state = { op: null, columns: null, table, filters: [] };

    const query = {
      select(columns) {
        if (state.op === null) state.op = "select";
        state.columns = columns;
        calls.select.push({ table, columns });
        return query;
      },
      eq(column, value) {
        state.filters.push([column, value]);
        calls.eq.push([column, value]);
        return query;
      },
      order(column, options) {
        calls.order.push([column, options]);
        return query;
      },
      in(column, values) {
        state.filters.push([column, values]);
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
        calls.writes.push({ op: "insert", table, rows });
        return query;
      },
      upsert(rows, options) {
        state.op = "upsert";
        calls.upsert.push({ table, rows, options });
        calls.writes.push({ op: "upsert", table, rows, options });
        return query;
      },
      update(row) {
        state.op = "update";
        calls.update.push(row);
        calls.writes.push({ op: "update", table, row });
        return query;
      },
      delete() {
        state.op = "delete";
        calls.delete.push({ table, filters: state.filters });
        calls.writes.push({ op: "delete", table, filters: state.filters });
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

  it("GET /api/products?category=All disables the free-text filter", async () => {
    const calls = makeDb({ select: () => ({ data: [product()], error: null }) });

    const res = await get("/api/products?category=All");

    expect(res.status).toBe(200);
    expect(calls.ilike).toEqual([]);
    expect(calls.tables).toEqual(["products"]);
  });

  it("GET /api/products lets the taxonomy parameter win over free text", async () => {
    const calls = makeDb({
      select: (state) =>
        state.table === "categories"
          ? { data: allCategories, error: null }
          : { data: [product()], error: null },
    });

    const res = await get(`/api/products?categoryId=${mobiles.id}&category=Electronics`);

    expect(res.status).toBe(200);
    expect(calls.in).toEqual([["category_id", [mobiles.id, smartphones.id]]]);
    expect(calls.ilike).toEqual([]);
  });

  it("GET /api/products?categoryPath returns a level-3 product under its level-1 ancestor", async () => {
    const deepProduct = product({ id: "prod-deep", category_id: smartphones.id });
    const calls = makeDb({
      select: (state) =>
        state.table === "categories"
          ? { data: allCategories, error: null }
          : { data: [deepProduct], error: null },
    });

    const res = await get("/api/products?categoryPath=electronics");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.map((row) => row.id)).toEqual(["prod-deep"]);
    expect(body[0].category_id).toBe(smartphones.id);
    expect(calls.in[0][1]).toContain(smartphones.id);
  });

  it("GET /api/products/:id maps a database error to a fixed 500", async () => {
    makeDb({ maybeSingle: () => ({ data: null, error: { message: "db read boom" } }) });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await get("/api/products/prod-1");

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Could not load product.");
    expect(body.error).not.toContain("db read boom");
  });

  it("GET /api/products/:id is 404 only when the row is missing", async () => {
    makeDb({ maybeSingle: () => ({ data: null, error: null }) });

    const res = await get("/api/products/ghost");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Product not found." });
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
      description: "Flagship phone",
      image_url: "https://example.com/phone.jpg",
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
      description: "Flagship phone",
      image_url: "https://example.com/phone.jpg",
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
      description: "Flagship phone",
      image_url: "https://example.com/phone.jpg",
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
      description: "Flagship phone",
      image_url: "https://example.com/phone.jpg",
      category_id: "ghost-category",
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Category not found." });
    expect(calls.insert).toEqual([]);
  });

  it("POST /api/products validates mandatory title, price, description, and image_url", async () => {
    const calls = makeDb({});

    // Missing description
    let res = await send("POST", "/api/products", {
      title: "Aurora Phone",
      price: 49999,
      image_url: "https://example.com/phone.jpg",
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Product description is required." });

    // Empty description after trim
    res = await send("POST", "/api/products", {
      title: "Aurora Phone",
      price: 49999,
      description: "   ",
      image_url: "https://example.com/phone.jpg",
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Product description is required." });

    // Missing image_url
    res = await send("POST", "/api/products", {
      title: "Aurora Phone",
      price: 49999,
      description: "Flagship phone",
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Product image is required." });

    // Empty image_url after trim
    res = await send("POST", "/api/products", {
      title: "Aurora Phone",
      price: 49999,
      description: "Flagship phone",
      image_url: "   ",
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Product image is required." });

    // Missing title
    res = await send("POST", "/api/products", {
      price: 49999,
      description: "Flagship phone",
      image_url: "https://example.com/phone.jpg",
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Product title and price are required." });

    expect(calls.insert).toEqual([]);
  });

  it("PUT /api/products/:id validates that title, price, description, image_url cannot be set to empty", async () => {
    const calls = makeDb({});

    let res = await send("PUT", "/api/products/prod-1", { title: "   " });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Product title cannot be empty." });

    res = await send("PUT", "/api/products/prod-1", { price: "" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Product price cannot be empty." });

    res = await send("PUT", "/api/products/prod-1", { description: "   " });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Product description cannot be empty." });

    res = await send("PUT", "/api/products/prod-1", { image_url: "   " });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Product image cannot be empty." });

    expect(calls.update).toEqual([]);
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

  // ─── Options and variants ──────────────────────────────────────────────

  const insertsInto = (calls, table) =>
    calls.writes.filter((write) => write.op === "insert" && write.table === table);
  const deletesFrom = (calls, table) =>
    calls.writes.filter((write) => write.op === "delete" && write.table === table);

  const newProduct = (overrides = {}) => ({
    title: "Aurora Phone",
    price: 49999,
    description: "Flagship phone",
    image_url: "https://example.com/phone.jpg",
    ...overrides,
  });

  it("POST /api/products stores the variants and the combinations of the new product", async () => {
    const calls = makeDb({
      single: () => ({ data: product(), error: null }),
      select: (state, table) =>
        table === "product_option_values"
          ? { data: [{ id: "catalogue-blue" }], error: null }
          : { data: [], error: null },
    });

    const res = await send(
      "POST",
      "/api/products",
      newProduct({
        variants: [
          { kind: "color", label: "Blue", value: "#2563eb", option_value_id: "catalogue-blue" },
          { kind: "size", label: "M", value: "M", option_value_id: null },
        ],
        combinations: [
          {
            sku: "PHONE-BLUE-M",
            price: 49999,
            stock: 12,
            image_url: "https://example.com/blue.jpg",
            options: [
              { kind: "color", label: "Blue", value: "#2563eb" },
              { kind: "size", label: "M", value: "M" },
            ],
          },
        ],
      })
    );

    expect(res.status).toBe(201);

    expect(insertsInto(calls, "product_variants")[0].rows).toEqual([
      {
        product_id: "prod-1",
        kind: "color",
        label: "Blue",
        value: "#2563eb",
        option_value_id: "catalogue-blue",
        position: 0,
        is_active: true,
      },
      {
        product_id: "prod-1",
        kind: "size",
        label: "M",
        value: "M",
        option_value_id: null,
        position: 1,
        is_active: true,
      },
    ]);

    expect(insertsInto(calls, "product_variant_combinations")[0].rows).toEqual([
      {
        product_id: "prod-1",
        sku: "PHONE-BLUE-M",
        price: 49999,
        stock: 12,
        image_url: "https://example.com/blue.jpg",
        options: [
          { kind: "color", label: "Blue", value: "#2563eb" },
          { kind: "size", label: "M", value: "M" },
        ],
        position: 0,
        is_active: true,
      },
    ]);
  });

  it("POST /api/products stores an option_value_id the catalogue does not know as null", async () => {
    const calls = makeDb({
      single: () => ({ data: product(), error: null }),
      select: (state, table) =>
        table === "product_option_values"
          ? { data: [{ id: "catalogue-blue" }], error: null }
          : { data: [], error: null },
    });

    const res = await send(
      "POST",
      "/api/products",
      newProduct({
        variants: [{ kind: "color", label: "Blue", option_value_id: "catalogue-ghost" }],
      })
    );

    expect(res.status).toBe(201);
    expect(insertsInto(calls, "product_variants")[0].rows[0].option_value_id).toBeNull();
  });

  it("PUT /api/products/:id replaces the variants and the combinations it is sent", async () => {
    const calls = makeDb({
      single: () => ({ data: product(), error: null }),
      select: () => ({ data: [], error: null }),
    });

    const res = await send("PUT", "/api/products/prod-1", {
      title: "Aurora Phone",
      variants: [{ kind: "size", label: "L", value: "L" }],
      combinations: [{ sku: "PHONE-L", price: 100, stock: 3, options: [] }],
    });

    expect(res.status).toBe(200);

    // The option fields are not columns of `products`: the product row is
    // never asked to carry them.
    expect(calls.update).toEqual([{ title: "Aurora Phone" }]);

    // The product's own rows are deleted before the new ones are inserted.
    expect(deletesFrom(calls, "product_variants")[0].filters).toContainEqual([
      "product_id",
      "prod-1",
    ]);
    expect(deletesFrom(calls, "product_variant_combinations")[0].filters).toContainEqual([
      "product_id",
      "prod-1",
    ]);

    expect(insertsInto(calls, "product_variants")[0].rows).toEqual([
      {
        product_id: "prod-1",
        kind: "size",
        label: "L",
        value: "L",
        option_value_id: null,
        position: 0,
        is_active: true,
      },
    ]);
    expect(insertsInto(calls, "product_variant_combinations")[0].rows).toEqual([
      {
        product_id: "prod-1",
        sku: "PHONE-L",
        price: 100,
        stock: 3,
        image_url: null,
        options: [],
        position: 0,
        is_active: true,
      },
    ]);
  });

  it("PUT /api/products/:id with an empty variants array clears the product's rows", async () => {
    const calls = makeDb({ single: () => ({ data: product(), error: null }) });

    const res = await send("PUT", "/api/products/prod-1", { variants: [] });

    expect(res.status).toBe(200);
    expect(deletesFrom(calls, "product_variants")).toHaveLength(1);
    expect(insertsInto(calls, "product_variants")).toEqual([]);
  });

  it("POST /api/products without the option fields leaves the product's rows alone", async () => {
    const calls = makeDb({ single: () => ({ data: product(), error: null }) });

    const res = await send("POST", "/api/products", newProduct());

    expect(res.status).toBe(201);
    expect(deletesFrom(calls, "product_variants")).toEqual([]);
    expect(deletesFrom(calls, "product_variant_combinations")).toEqual([]);
    expect(insertsInto(calls, "product_variants")).toEqual([]);
    expect(insertsInto(calls, "product_variant_combinations")).toEqual([]);
  });

  it("PUT /api/products/:id without the option fields leaves the product's rows alone", async () => {
    const calls = makeDb({ single: () => ({ data: product(), error: null }) });

    const res = await send("PUT", "/api/products/prod-1", { title: "Aurora Phone" });

    expect(res.status).toBe(200);
    expect(deletesFrom(calls, "product_variants")).toEqual([]);
    expect(deletesFrom(calls, "product_variant_combinations")).toEqual([]);
    expect(insertsInto(calls, "product_variants")).toEqual([]);
    expect(insertsInto(calls, "product_variant_combinations")).toEqual([]);
  });

  it("POST /api/products rejects a variant with an unknown kind and writes nothing", async () => {
    const calls = makeDb({});

    const res = await send(
      "POST",
      "/api/products",
      newProduct({ variants: [{ kind: "colour", label: "Blue" }] })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("kind");
    expect(body.error).toContain("color");
    expect(calls.insert).toEqual([]);
    expect(calls.writes).toEqual([]);
  });

  it("POST /api/products rejects a variant without a label and writes nothing", async () => {
    const calls = makeDb({});

    const res = await send(
      "POST",
      "/api/products",
      newProduct({ variants: [{ kind: "color", value: "#2563eb" }] })
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("label");
    expect(calls.insert).toEqual([]);
  });

  it("POST /api/products rejects a combination with a negative price or a fractional stock", async () => {
    const calls = makeDb({});

    let res = await send(
      "POST",
      "/api/products",
      newProduct({ combinations: [{ sku: "PHONE-BLUE", price: -1 }] })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("price");

    res = await send(
      "POST",
      "/api/products",
      newProduct({ combinations: [{ sku: "PHONE-BLUE", stock: 1.5 }] })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("stock");

    expect(calls.insert).toEqual([]);
  });

  it("PUT /api/products/:id rejects a combination option with an unknown kind and writes nothing", async () => {
    const calls = makeDb({});

    const res = await send("PUT", "/api/products/prod-1", {
      combinations: [{ sku: "PHONE-BLUE", options: [{ kind: "colour", label: "Blue" }] }],
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("kind");
    expect(calls.update).toEqual([]);
    expect(calls.writes).toEqual([]);
  });

  it("POST /api/products answers 500 when the variants cannot be written", async () => {
    const calls = makeDb({
      single: () => ({ data: product(), error: null }),
      insert: (state, table) =>
        table === "product_variants"
          ? { data: null, error: { message: "variants boom" } }
          : { data: [], error: null },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await send(
      "POST",
      "/api/products",
      newProduct({ variants: [{ kind: "color", label: "Blue" }] })
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toEqual(expect.any(String));
    expect(body.error).not.toContain("variants boom");
    // The product row is written first, then the variants are attempted.
    expect(insertsInto(calls, "product_variants")).toHaveLength(1);
  });
});
