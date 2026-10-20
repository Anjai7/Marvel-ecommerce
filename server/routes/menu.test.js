// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("../db.js", () => ({ supabase: { from: mockFrom } }));

import app from "../app.js";
import { signUserToken } from "../middleware/auth.js";

/**
 * Chainable Supabase double, modelled on categories.test.js. It records every
 * call so a test can assert the exact write payload and that a rejected request
 * never reached the database.
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
        calls.in = calls.in ?? [];
        calls.in.push([column, values]);
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

const ALL_ROLES = ["user", "vendor", "admin", "super_admin"];

const root = {
  id: "menu-root",
  title: "Electronics",
  path: "/category/electronics",
  icon: "Cpu",
  level: 1,
  parent_id: null,
  order_index: 0,
  is_active: true,
  roles_allowed: ALL_ROLES,
};
const child = {
  id: "menu-child",
  title: "Mobiles",
  path: "/category/electronics/mobiles",
  icon: "Layers",
  level: 2,
  parent_id: root.id,
  order_index: 0,
  is_active: true,
  roles_allowed: ALL_ROLES,
};
const inactive = {
  id: "menu-off",
  title: "Retired",
  path: "/retired",
  icon: "Layers",
  level: 1,
  parent_id: null,
  order_index: 1,
  is_active: false,
  roles_allowed: ALL_ROLES,
};

describe("menu API", () => {
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
              id: "t-menu-admin",
              email: "admin@test.local",
              role: "admin",
            })}`,
          };
          userHeaders = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${signUserToken({
              id: "t-menu-user",
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

  it("GET /api/menu returns a bare array (not a wrapped object)", async () => {
    const calls = makeDb({ select: () => ({ data: [root, child], error: null }) });

    const res = await get("/api/menu");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(root.id);
    expect(body[0].children.map((node) => node.id)).toEqual([child.id]);
    expect(calls.eq).toContainEqual(["is_active", true]);
    expect(calls.order[0]).toEqual(["order_index", { ascending: true }]);
  });

  it("GET /api/menu/:id returns { item }", async () => {
    makeDb({ maybeSingle: () => ({ data: root, error: null }) });

    const res = await get(`/api/menu/${root.id}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ item: root });
  });

  it("PATCH /api/menu/:id with { title } writes only title", async () => {
    const calls = makeDb({
      maybeSingle: (state) =>
        state.table === "menu_items" && state.columns === "*"
          ? { data: root, error: null }
          : { data: null, error: null },
      update: () => ({ data: [{ ...root, title: "New" }], error: null }),
    });

    const res = await send("PATCH", `/api/menu/${root.id}`, { title: "New" });

    expect(res.status).toBe(200);
    expect((await res.json()).item.title).toBe("New");
    expect(calls.update).toEqual([{ title: "New" }]);
  });

  it("PATCH /api/menu/:id validates hierarchy when a level is sent alone", async () => {
    const calls = makeDb({
      maybeSingle: (state) =>
        state.table === "menu_items" ? { data: root, error: null } : { data: null, error: null },
    });

    const res = await send("PATCH", `/api/menu/${root.id}`, { level: 2 });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("parent_id is required for menu items below level 1.");
    expect(calls.update).toEqual([]);
  });

  it("PATCH /api/menu/reorder renumbers the sibling group to 0..n-1 on order_index", async () => {
    const siblings = [
      { id: "menu-a", parent_id: "parent-1", level: 2 },
      { id: "menu-b", parent_id: "parent-1", level: 2 },
      { id: "menu-c", parent_id: "parent-1", level: 2 },
    ];
    const calls = makeDb({
      select: () => ({ data: siblings, error: null }),
      update: () => ({ data: null, error: null }),
    });

    const res = await send("PATCH", "/api/menu/reorder", {
      orders: [
        { id: "menu-c", display_order: 9 },
        { id: "menu-a", display_order: 9 },
        { id: "menu-b", display_order: 9 },
      ],
    });

    expect(res.status).toBe(200);
    expect((await res.json()).message).toEqual(expect.any(String));
    expect(calls.update).toEqual([{ order_index: 0 }, { order_index: 1 }, { order_index: 2 }]);
    expect(calls.update.some((row) => Object.hasOwn(row, "display_order"))).toBe(false);
    expect(calls.eq).toEqual(
      expect.arrayContaining([
        ["id", "menu-c"],
        ["id", "menu-a"],
        ["id", "menu-b"],
      ])
    );
  });

  it("PATCH /api/menu/reorder rejects a partial list and persists nothing", async () => {
    const siblings = [
      { id: "menu-a", parent_id: "parent-1", level: 2 },
      { id: "menu-b", parent_id: "parent-1", level: 2 },
    ];
    const calls = makeDb({
      select: () => ({ data: siblings, error: null }),
      update: () => ({ data: null, error: null }),
    });

    const res = await send("PATCH", "/api/menu/reorder", {
      orders: [{ id: "menu-a", display_order: 0 }],
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Reorder must include every item in the scope.",
    });
    expect(calls.update).toEqual([]);
  });

  it("PATCH /api/menu/reorder rejects a body that mixes parents", async () => {
    const rows = [
      { id: "menu-a", parent_id: "parent-1", level: 2 },
      { id: "menu-c", parent_id: "parent-2", level: 2 },
    ];
    const calls = makeDb({
      select: () => ({ data: rows, error: null }),
      update: () => ({ data: null, error: null }),
    });

    const res = await send("PATCH", "/api/menu/reorder", {
      orders: [{ id: "menu-a" }, { id: "menu-c" }],
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Reorder must include every item in the scope.",
    });
    expect(calls.update).toEqual([]);
  });

  it("PATCH /api/menu/reorder rejects a repeated id", async () => {
    const rows = [
      { id: "menu-a", parent_id: "parent-1", level: 2 },
      { id: "menu-b", parent_id: "parent-1", level: 2 },
    ];
    const calls = makeDb({
      select: () => ({ data: rows, error: null }),
      update: () => ({ data: null, error: null }),
    });

    const res = await send("PATCH", "/api/menu/reorder", {
      orders: [{ id: "menu-a" }, { id: "menu-a" }],
    });

    expect(res.status).toBe(400);
    expect(calls.update).toEqual([]);
  });

  it("POST /api/menu returns the persisted row", async () => {
    const saved = { ...root, id: "menu-new", title: "T", path: "/p", category_id: "cat-1" };
    const calls = makeDb({
      maybeSingle: () => ({ data: { id: "cat-1", name: "Electronics" }, error: null }),
      single: (state) =>
        state.op === "upsert" ? { data: saved, error: null } : { data: null, error: null },
    });

    const res = await send("POST", "/api/menu", {
      title: "T",
      path: "/p",
      category_id: "cat-1",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item).toEqual(saved);
    expect(body.message).toEqual(expect.any(String));
    expect(calls.upsert).toHaveLength(1);
    expect(calls.upsert[0]).toMatchObject({
      title: "T",
      path: "/p",
      level: 1,
      icon: "Layers",
      category_id: "cat-1",
      roles_allowed: ALL_ROLES,
    });
    expect(calls.upsert[0]).not.toHaveProperty("display_order");
  });

  it("POST /api/menu surfaces a Supabase error as 500 instead of a silent 200", async () => {
    makeDb({
      single: () => ({ data: null, error: { message: "db save boom" } }),
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await send("POST", "/api/menu", { title: "T", path: "/p" });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toEqual(expect.any(String));
    expect(body.error).not.toContain("db save boom");
  });

  it("POST /api/menu requires a parent for a level-2 item", async () => {
    const calls = makeDb();

    const res = await send("POST", "/api/menu", { title: "T", path: "/p", level: 2 });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("parent_id is required for menu items below level 1.");
    expect(calls.upsert).toEqual([]);
  });

  it("POST /api/menu rejects an unknown category_id before writing", async () => {
    const calls = makeDb({ maybeSingle: () => ({ data: null, error: null }) });

    const res = await send("POST", "/api/menu", {
      title: "T",
      path: "/p",
      category_id: "ghost-category",
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Category not found." });
    expect(calls.upsert).toEqual([]);
  });

  it("DELETE /api/menu/:id returns 200 { message }", async () => {
    const calls = makeDb({ delete: () => ({ data: null, error: null }) });

    const res = await send("DELETE", `/api/menu/${root.id}`);

    expect(res.status).toBe(200);
    expect((await res.json()).message).toEqual(expect.any(String));
    expect(calls.delete).toBe(1);
  });

  describe("includeInactive on GET /api/menu", () => {
    it("without a token is 401 and does not query", async () => {
      makeDb();

      const res = await get("/api/menu?includeInactive=1");

      expect(res.status).toBe(401);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("with a user token is 403 and does not query", async () => {
      makeDb();

      const res = await get("/api/menu?includeInactive=1", userHeaders);

      expect(res.status).toBe(403);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("with an admin token returns inactive rows", async () => {
      const calls = makeDb({ select: () => ({ data: [root, inactive], error: null }) });

      const res = await get("/api/menu?includeInactive=1", adminHeaders);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.map((node) => node.id)).toContain(inactive.id);
      expect(calls.eq.map(([column]) => column)).not.toContain("is_active");
    });
  });

  const writeRoutes = [
    ["POST", "/api/menu", { title: "T", path: "/p" }],
    ["PATCH", "/api/menu/menu-root", { title: "T" }],
    ["PATCH", "/api/menu/reorder", { orders: [] }],
    ["DELETE", "/api/menu/menu-root", undefined],
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
