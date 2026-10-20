// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("../db.js", () => ({ supabase: { from: mockFrom } }));

import app from "../app.js";
import { signUserToken } from "../middleware/auth.js";

/**
 * Chainable Supabase double. Each `from(table)` builder records the calls made
 * on it; awaiting it resolves with the result configured for the operation in
 * play (`select` for reads, `maybeSingle` for single-row lookups, `upsert` /
 * `update` / `delete` for writes).
 */
function makeDb(handlers = {}) {
  const calls = {
    tables: [],
    select: [],
    eq: [],
    order: [],
    upsert: [],
    update: [],
    delete: 0,
    maybeSingle: 0,
  };

  mockFrom.mockReset();
  mockFrom.mockImplementation((table) => {
    calls.tables.push(table);
    const state = { op: null, columns: null };

    const query = {
      select(columns) {
        if (state.op === null) state.op = "select";
        state.columns = columns;
        calls.select.push(columns);
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
      upsert(row) {
        state.op = "upsert";
        state.row = row;
        calls.upsert.push(row);
        return query;
      },
      update(row) {
        state.op = "update";
        state.row = row;
        calls.update.push(row);
        return query;
      },
      delete() {
        state.op = "delete";
        calls.delete += 1;
        return query;
      },
      maybeSingle() {
        calls.maybeSingle += 1;
        const result = handlers.maybeSingle
          ? handlers.maybeSingle(state, table, calls)
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

const category = (overrides) => ({
  is_active: true,
  show_in_nav: true,
  show_in_homepage: false,
  ...overrides,
});

const electronics = category({
  id: "cat-electronics",
  name: "Electronics",
  slug: "electronics",
  parent_id: null,
  level: 1,
  display_order: 0,
});
const mobiles = category({
  id: "cat-mobiles",
  name: "Mobiles",
  slug: "mobiles",
  parent_id: electronics.id,
  level: 2,
  display_order: 0,
});
const smartphones = category({
  id: "cat-smartphones",
  name: "Smartphones",
  slug: "smartphones",
  parent_id: mobiles.id,
  level: 3,
  display_order: 0,
});
const electronicsAccessories = category({
  id: "cat-electronics-accessories",
  name: "Accessories",
  slug: "accessories",
  parent_id: electronics.id,
  level: 2,
  display_order: 1,
});
const watches = category({
  id: "cat-electronics-accessories-watches",
  name: "Watches",
  slug: "watches",
  parent_id: electronicsAccessories.id,
  level: 3,
  display_order: 0,
});
const fashion = category({
  id: "cat-fashion",
  name: "Fashion",
  slug: "fashion",
  parent_id: null,
  level: 1,
  display_order: 1,
});
const accessoriesRoot = category({
  id: "cat-accessories",
  name: "Accessories",
  slug: "accessories",
  parent_id: null,
  level: 1,
  display_order: 2,
});

const allCategories = [
  smartphones,
  watches,
  mobiles,
  fashion,
  electronicsAccessories,
  electronics,
  accessoriesRoot,
];

describe("categories API", () => {
  let server;
  let base;
  let adminHeaders;
  let userHeaders;

  beforeAll(
    () =>
      new Promise((resolve) => {
        server = app.listen(0, () => {
          base = `http://127.0.0.1:${server.address().port}`;
          adminHeaders = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${signUserToken({
              id: "t-cat-admin",
              email: "admin@test.local",
              role: "admin",
            })}`,
          };
          userHeaders = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${signUserToken({
              id: "t-cat-user",
              email: "user@test.local",
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
  const send = (method, path, body, headers = adminHeaders) =>
    fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  it("GET /api/categories returns { categories } filtered to is_active", async () => {
    const calls = makeDb({ select: () => ({ data: [electronics, mobiles], error: null }) });

    const res = await get("/api/categories");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ categories: [electronics, mobiles] });
    expect(calls.tables).toEqual(["categories"]);
    expect(calls.eq).toContainEqual(["is_active", true]);
    expect(calls.order[0]).toEqual(["display_order", { ascending: true }]);
  });

  it("GET /api/categories/tree nests children and orders siblings by display_order", async () => {
    makeDb({ select: () => ({ data: allCategories, error: null }) });

    const res = await get("/api/categories/tree");

    expect(res.status).toBe(200);
    const { categories } = await res.json();
    expect(categories.map((row) => row.id)).toEqual([
      electronics.id,
      fashion.id,
      accessoriesRoot.id,
    ]);
    expect(categories[0].children.map((row) => row.id)).toEqual([
      mobiles.id,
      electronicsAccessories.id,
    ]);
    expect(categories[0].children[0].children.map((row) => row.id)).toEqual([smartphones.id]);
    expect(categories[0].children[1].children.map((row) => row.id)).toEqual([watches.id]);
  });

  it("GET /api/categories/tree returns 500 when the list read fails", async () => {
    makeDb({ select: () => ({ data: null, error: { message: "db list boom" } }) });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await get("/api/categories/tree");

    expect(res.status).toBe(500);
    expect((await res.json()).error).toEqual(expect.any(String));
  });

  it("GET /api/categories/slug/electronics returns the root row with ancestors and descendants", async () => {
    makeDb({ select: () => ({ data: allCategories, error: null }) });

    const res = await get("/api/categories/slug/electronics");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.category.id).toBe(electronics.id);
    expect(body.category.ambiguous).toBe(false);
    expect(body.ancestors).toEqual([]);
    expect(body.descendants.map((row) => row.id).sort()).toEqual(
      [mobiles.id, electronicsAccessories.id, smartphones.id, watches.id].sort()
    );
  });

  it("GET /api/categories/slug/accessories resolves the shallowest match and flags ambiguity", async () => {
    makeDb({ select: () => ({ data: allCategories, error: null }) });

    const res = await get("/api/categories/slug/accessories");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.category.id).toBe(accessoriesRoot.id);
    expect(body.category.ambiguous).toBe(true);
  });

  it("GET /api/categories/path resolves the exact segment walk", async () => {
    makeDb({ select: () => ({ data: allCategories, error: null }) });

    const res = await get("/api/categories/path?path=electronics/mobiles/smartphones");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.category.id).toBe(smartphones.id);
    expect(body.ancestors.map((row) => row.id)).toEqual([electronics.id, mobiles.id]);
    expect(body.descendants).toEqual([]);
  });

  it("GET /api/categories/path distinguishes a root slug from a child with the same slug", async () => {
    makeDb({ select: () => ({ data: allCategories, error: null }) });

    const root = await (await get("/api/categories/path?path=accessories")).json();
    const child = await (await get("/api/categories/path?path=electronics/accessories")).json();

    expect(root.category.id).toBe(accessoriesRoot.id);
    expect(child.category.id).toBe(electronicsAccessories.id);
  });

  it.each([
    "electronics/accessories/watches/extra",
    "electronics/mobiles/nope",
    "electronics//mobiles",
    " electronics",
  ])("GET /api/categories/path returns 404 for %s", async (path) => {
    makeDb({ select: () => ({ data: allCategories, error: null }) });

    const res = await get(`/api/categories/path?path=${encodeURIComponent(path)}`);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: `No category found for path '${path}'.`,
    });
  });

  it("POST /api/categories returns 201 with the persisted row", async () => {
    const saved = category({
      id: "cat-new",
      name: "X",
      slug: "x",
      parent_id: null,
      level: 1,
      display_order: 0,
    });
    const calls = makeDb({ upsert: () => ({ data: [saved], error: null }) });

    const res = await send("POST", "/api/categories", { name: "X", slug: "x" });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.category).toEqual(saved);
    expect(body.message).toEqual(expect.any(String));
    expect(calls.upsert).toEqual([{ name: "X", slug: "x", level: 1 }]);
  });

  it("POST /api/categories rejects a level-3 row whose parent is level 1", async () => {
    const calls = makeDb({
      maybeSingle: (state) =>
        state.columns === "id, level"
          ? { data: { id: electronics.id, level: 1 }, error: null }
          : { data: null, error: null },
    });

    const res = await send("POST", "/api/categories", {
      name: "Deep",
      slug: "deep",
      level: 3,
      parent_id: electronics.id,
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(
      "Parent category must be at level 2 for a level 3 category."
    );
    expect(calls.upsert).toEqual([]);
  });

  it("POST /api/categories rejects a parent on a level-1 row", async () => {
    const calls = makeDb({
      maybeSingle: () => ({ data: { id: electronics.id, level: 1 }, error: null }),
    });

    const res = await send("POST", "/api/categories", {
      name: "Root",
      slug: "root",
      level: 1,
      parent_id: electronics.id,
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Level 1 categories must not have a parent_id.",
    });
    expect(calls.upsert).toEqual([]);
  });

  it("POST /api/categories rejects a parent that does not exist", async () => {
    const calls = makeDb({ maybeSingle: () => ({ data: null, error: null }) });

    const res = await send("POST", "/api/categories", {
      name: "Orphan",
      slug: "orphan",
      parent_id: "ghost",
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Parent category not found." });
    expect(calls.upsert).toEqual([]);
  });

  it("PATCH /api/categories/:id with { name } writes only name", async () => {
    const calls = makeDb({
      maybeSingle: (state) =>
        state.columns === "*" ? { data: mobiles, error: null } : { data: null, error: null },
      update: () => ({ data: [{ ...mobiles, name: "New" }], error: null }),
    });

    const res = await send("PATCH", `/api/categories/${mobiles.id}`, { name: "New" });

    expect(res.status).toBe(200);
    expect((await res.json()).category.name).toBe("New");
    expect(calls.update).toEqual([{ name: "New" }]);
  });

  it("PATCH /api/categories/:id derives level from a new parent", async () => {
    const calls = makeDb({
      maybeSingle: (state) => {
        if (state.columns === "id, level") {
          return { data: { id: electronics.id, level: 1 }, error: null };
        }
        return { data: mobiles, error: null };
      },
      update: () => ({
        data: [{ ...mobiles, parent_id: electronics.id, level: 2 }],
        error: null,
      }),
    });

    const res = await send("PATCH", `/api/categories/${mobiles.id}`, {
      parent_id: electronics.id,
    });

    expect(res.status).toBe(200);
    expect(calls.update).toEqual([{ parent_id: electronics.id, level: 2 }]);
  });

  it("PATCH /api/categories/reorder renumbers one sibling group to 0..n-1", async () => {
    const siblings = [mobileRow("cat-a", 0), mobileRow("cat-b", 1), mobileRow("cat-c", 2)];
    const calls = makeDb({ select: () => ({ data: siblings, error: null }) });

    const res = await send("PATCH", "/api/categories/reorder", {
      orders: [
        { id: "cat-c", display_order: 9 },
        { id: "cat-a", display_order: 9 },
        { id: "cat-b", display_order: 9 },
      ],
    });

    expect(res.status).toBe(200);
    expect((await res.json()).message).toEqual(expect.any(String));
    expect(calls.update).toEqual([
      { display_order: 0 },
      { display_order: 1 },
      { display_order: 2 },
    ]);
    expect(calls.eq).toEqual(
      expect.arrayContaining([
        ["id", "cat-c"],
        ["id", "cat-a"],
        ["id", "cat-b"],
      ])
    );
  });

  it("PATCH /api/categories/reorder rejects a partial list and persists nothing", async () => {
    const siblings = [mobileRow("cat-a", 0), mobileRow("cat-b", 1)];
    const calls = makeDb({ select: () => ({ data: siblings, error: null }) });

    const res = await send("PATCH", "/api/categories/reorder", {
      orders: [{ id: "cat-a", display_order: 0 }],
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Reorder must include every item in the scope.",
    });
    expect(calls.update).toEqual([]);
  });

  it("PATCH /api/categories/reorder rejects a body that mixes parents", async () => {
    const rows = [
      mobileRow("cat-a", 0),
      mobileRow("cat-b", 1),
      mobileRow("cat-c", 0, "other-parent"),
    ];
    const calls = makeDb({ select: () => ({ data: rows, error: null }) });

    const res = await send("PATCH", "/api/categories/reorder", {
      orders: [{ id: "cat-a" }, { id: "cat-c" }],
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Reorder must include every item in the scope.",
    });
    expect(calls.update).toEqual([]);
  });

  it("DELETE /api/categories/:id returns 200 { message }", async () => {
    const calls = makeDb({
      maybeSingle: () => ({ data: { id: mobiles.id }, error: null }),
      delete: () => ({ data: null, error: null }),
    });

    const res = await send("DELETE", `/api/categories/${mobiles.id}`);

    expect(res.status).toBe(200);
    expect((await res.json()).message).toEqual(expect.any(String));
    expect(calls.delete).toBe(1);
  });

  it("GET /api/categories/slug/:slug on an unknown slug is 404 with the shared spelling", async () => {
    makeDb({ select: () => ({ data: allCategories, error: null }) });

    const res = await get("/api/categories/slug/ghost");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "category not found." });
  });

  describe("includeInactive on the hand-rolled list routes", () => {
    const listPaths = [
      "/api/categories/tree",
      "/api/categories/path?path=electronics",
      "/api/categories/slug/electronics",
    ];
    const withInactive = (path) => `${path}${path.includes("?") ? "&" : "?"}includeInactive=1`;

    it.each(listPaths)(
      "%s?includeInactive=1 without a token is 401 and does not query",
      async (path) => {
        makeDb();

        const res = await get(withInactive(path));

        expect(res.status).toBe(401);
        expect(mockFrom).not.toHaveBeenCalled();
      }
    );

    it.each(listPaths)(
      "%s?includeInactive=1 with a user token is 403 and does not query",
      async (path) => {
        makeDb();

        const res = await get(withInactive(path), userHeaders);

        expect(res.status).toBe(403);
        expect(mockFrom).not.toHaveBeenCalled();
      }
    );

    it.each(listPaths)(
      "%s?includeInactive=1 with an admin token includes inactive rows",
      async (path) => {
        const calls = makeDb({
          select: () => ({ data: [electronics, { ...fashion, is_active: false }], error: null }),
        });

        const res = await get(withInactive(path), adminHeaders);

        expect(res.status).toBe(200);
        expect(calls.eq.map(([column]) => column)).not.toContain("is_active");
      }
    );
  });

  it("POST /api/categories rejects a null display_order instead of coercing it to 0", async () => {
    const calls = makeDb();

    const res = await send("POST", "/api/categories", {
      name: "X",
      slug: "x",
      display_order: null,
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "order_index must be an integer." });
    expect(calls.upsert).toEqual([]);
  });

  it("POST /api/categories rejects a non-integer display_order before the database", async () => {
    const calls = makeDb();

    const res = await send("POST", "/api/categories", {
      name: "X",
      slug: "x",
      display_order: "01",
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "order_index must be an integer." });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(calls.upsert).toEqual([]);
  });

  it("PATCH /api/categories/:id rejects a non-integer display_order", async () => {
    const calls = makeDb();

    const res = await send("PATCH", `/api/categories/${mobiles.id}`, { display_order: "1.5" });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "order_index must be an integer." });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(calls.update).toEqual([]);
  });

  const writeRoutes = [
    ["POST", "/api/categories", { name: "X", slug: "x" }],
    ["PATCH", "/api/categories/cat-a", { name: "X" }],
    ["PATCH", "/api/categories/reorder", { orders: [] }],
    ["DELETE", "/api/categories/cat-a", undefined],
  ];

  it.each(writeRoutes)(
    "%s %s without a token is 401 and never touches the db",
    async (method, path, body) => {
      makeDb();

      const res = await fetch(`${base}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      expect(res.status).toBe(401);
      expect(mockFrom).not.toHaveBeenCalled();
    }
  );

  it.each(writeRoutes)(
    "%s %s with a user token is 403 and never touches the db",
    async (method, path, body) => {
      makeDb();

      const res = await send(method, path, body, userHeaders);

      expect(res.status).toBe(403);
      expect(mockFrom).not.toHaveBeenCalled();
    }
  );
});

function mobileRow(id, display_order, parent_id = "parent-1") {
  return category({ id, name: id, slug: id, parent_id, level: 2, display_order });
}
