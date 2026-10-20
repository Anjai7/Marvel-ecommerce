// @vitest-environment node
import express from "express";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("../db.js", () => ({ supabase: { from: mockFrom } }));

import { createCrudRouter, applyReorder } from "./crudRouter.js";
import { signUserToken } from "../middleware/auth.js";
import { validateHeroSlide } from "./validation.js";

/**
 * Minimal chainable Supabase double.
 *
 * Each `from()` call returns a builder that records the calls made on it and,
 * when awaited, resolves with the result configured for the operation in play:
 * `select` for list reads, `maybeSingle` for single-row lookups, `upsert`,
 * `update` and `delete` for writes.
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
    const state = { op: null };

    const query = {
      select(columns) {
        if (state.op === null) state.op = "select";
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
        calls.upsert.push(row);
        return query;
      },
      update(row) {
        state.op = "update";
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
          ? handlers.maybeSingle(state)
          : { data: null, error: null };
        return Promise.resolve(result);
      },
      then(onFulfilled, onRejected) {
        const result = handlers[state.op] ? handlers[state.op](state) : { data: [], error: null };
        return Promise.resolve(result).then(onFulfilled, onRejected);
      },
    };

    return query;
  });

  return calls;
}

function defaultConfig(overrides = {}) {
  return {
    table: "widgets",
    fields: ["title", "sort_order", "is_active"],
    orderColumn: "sort_order",
    validate: (body, ctx = {}) => {
      if (ctx.partial === true && body.title === undefined) return null;
      return typeof body.title === "string" && body.title.trim() !== ""
        ? null
        : "Widget title is required.";
    },
    resourceKey: "widget",
    listKey: "widgets",
    ...overrides,
  };
}

function buildApp(overrides = {}) {
  const app = express();
  app.use(express.json());
  app.use("/api/widgets", createCrudRouter(defaultConfig(overrides)));
  return app;
}

async function listen(app) {
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function withServer(app, run) {
  const server = await listen(app);
  try {
    return await run(server.base);
  } finally {
    await server.close();
  }
}

function adminHeaders() {
  const token = signUserToken({ id: "admin-1", email: "admin@test.local", role: "admin" });
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

function userHeaders() {
  const token = signUserToken({ id: "user-1", email: "user@test.local", role: "user" });
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

beforeEach(() => {
  mockFrom.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createCrudRouter — configuration", () => {
  it("throws when toPayload is supplied but is not a function, naming the key", () => {
    expect(() => createCrudRouter(defaultConfig({ toPayload: { title: "x" } }))).toThrow(TypeError);
    expect(() => createCrudRouter(defaultConfig({ toPayload: "title" }))).toThrow(/toPayload/);
  });

  it("names a missing required key in the constructor error", () => {
    expect(() => createCrudRouter(defaultConfig({ validate: undefined }))).toThrow(/validate/);
    expect(() => createCrudRouter(defaultConfig({ table: undefined }))).toThrow(/table/);
  });

  it("allows an omitted toPayload and falls back to the body-present keys", () => {
    expect(() => createCrudRouter(defaultConfig())).not.toThrow();
  });
});

describe("createCrudRouter — POST", () => {
  it("returns 400 with the validator's message and never touches the database", async () => {
    const calls = makeDb();
    const app = buildApp();

    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/widgets`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ sort_order: 1 }),
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Widget title is required." });
    });

    expect(calls.tables).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it.each(["1.5", "01", "1e3"])(
    "validates the raw body before coercing (%s is rejected)",
    async (orderIndex) => {
      makeDb();
      const app = buildApp({
        table: "hero_slides",
        fields: ["title", "order_index"],
        orderColumn: "order_index",
        validate: validateHeroSlide,
        toPayload: (body) => ({ title: body.title, order_index: Number(body.order_index ?? 0) }),
        resourceKey: "slide",
        listKey: "slides",
      });

      await withServer(app, async (base) => {
        const res = await fetch(`${base}/api/widgets`, {
          method: "POST",
          headers: adminHeaders(),
          body: JSON.stringify({ title: "Deal", order_index: orderIndex }),
        });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "order_index must be an integer." });
      });

      expect(mockFrom).not.toHaveBeenCalled();
    }
  );

  it("returns 201 with the persisted row and omits id when the body has none", async () => {
    const stored = { id: "generated-uuid", title: "Deal", sort_order: 2 };
    const calls = makeDb({ upsert: () => ({ data: [stored], error: null }) });
    const app = buildApp();

    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/widgets`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ title: "Deal", sort_order: 2 }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.message).toEqual(expect.any(String));
      expect(body.widget).toEqual(stored);
    });

    // The default payload builder writes only body-present keys.
    expect(calls.upsert).toEqual([{ title: "Deal", sort_order: 2 }]);
    expect(calls.tables).toEqual(["widgets"]);
  });

  it("includes id in the upsert when the body supplies one", async () => {
    const stored = { id: "fixed-id", title: "Deal" };
    const calls = makeDb({ upsert: () => ({ data: [stored], error: null }) });
    const app = buildApp();

    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/widgets`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ id: "fixed-id", title: "Deal" }),
      });
      expect(res.status).toBe(201);
    });

    expect(calls.upsert[0]).toEqual({ id: "fixed-id", title: "Deal" });
  });

  it("surfaces a database write error as 500", async () => {
    makeDb({ upsert: () => ({ data: null, error: { message: "db write boom" } }) });
    const app = buildApp();

    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/widgets`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ title: "Deal" }),
      });
      expect(res.status).toBe(500);
      expect((await res.json()).error).toMatch(/db write boom/);
    });
  });

  it("rejects a write without an admin token before touching the database", async () => {
    makeDb();
    const app = buildApp();

    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/widgets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Deal" }),
      });
      expect(res.status).toBe(401);
    });

    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe("createCrudRouter — PATCH", () => {
  it("writes only the keys the client sent (default payload builder)", async () => {
    const calls = makeDb({
      maybeSingle: () => ({
        data: { id: "w1", title: "Old", sort_order: 5, is_active: true },
        error: null,
      }),
      update: () => ({
        data: [{ id: "w1", title: "New", sort_order: 5, is_active: true }],
        error: null,
      }),
    });
    const app = buildApp();

    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/widgets/w1`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ title: "New" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toEqual(expect.any(String));
      expect(body.widget.title).toBe("New");
    });

    expect(calls.update).toEqual([{ title: "New" }]);
    expect(calls.update[0]).not.toHaveProperty("sort_order");
    expect(calls.update[0]).not.toHaveProperty("is_active");
    expect(calls.eq).toContainEqual(["id", "w1"]);
  });

  it("returns 404 on a missing id and never calls update", async () => {
    const calls = makeDb({ maybeSingle: () => ({ data: null, error: null }) });
    const app = buildApp();

    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/widgets/missing`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ title: "New" }),
      });
      expect(res.status).toBe(404);
      expect((await res.json()).error).toEqual(expect.any(String));
    });

    expect(calls.update).toEqual([]);
  });

  it("returns 400 on a partial validation failure and never touches the database", async () => {
    makeDb();
    const app = buildApp();

    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/widgets/w1`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ title: "   " }),
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Widget title is required." });
    });

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("short-circuits an empty writable patch with 200 and the existing row", async () => {
    const existing = { id: "w1", title: "Old", sort_order: 5, is_active: true };
    const calls = makeDb({ maybeSingle: () => ({ data: existing, error: null }) });
    const app = buildApp();

    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/widgets/w1`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ metadata: "ignored" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toEqual(expect.any(String));
      expect(body.widget).toEqual(existing);
    });

    expect(calls.update).toEqual([]);
  });

  it("surfaces a database update error as 500", async () => {
    makeDb({
      maybeSingle: () => ({ data: { id: "w1", title: "Old" }, error: null }),
      update: () => ({ data: null, error: { message: "db update boom" } }),
    });
    const app = buildApp();

    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/widgets/w1`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ title: "New" }),
      });
      expect(res.status).toBe(500);
      expect((await res.json()).error).toMatch(/db update boom/);
    });
  });
});

describe("createCrudRouter — write set is the payload builder's output", () => {
  it("writes a column renamed by toPayload even though the client sent another key", async () => {
    const calls = makeDb({
      maybeSingle: () => ({ data: { id: "w1", title: "Old" }, error: null }),
      update: () => ({ data: [{ id: "w1", title: "Renamed" }], error: null }),
    });
    const app = buildApp({
      fields: ["title"],
      validate: (body, ctx = {}) => {
        if (ctx.partial === true && body.name === undefined) return null;
        return typeof body.name === "string" && body.name.trim() !== ""
          ? null
          : "Name is required.";
      },
      toPayload: (body) => ({ title: body.name }),
    });

    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/widgets/w1`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ name: "Renamed" }),
      });
      expect(res.status).toBe(200);
      expect((await res.json()).widget.title).toBe("Renamed");
    });

    expect(calls.update).toEqual([{ title: "Renamed" }]);
  });

  it("writes a field toPayload derives from a key the client sent", async () => {
    const calls = makeDb({
      maybeSingle: () => ({
        data: { id: "w1", title: "Cat", parent_id: "p1", level: 1 },
        error: null,
      }),
      update: () => ({
        data: [{ id: "w1", title: "Cat", parent_id: "p2", level: 2 }],
        error: null,
      }),
    });
    const app = buildApp({
      fields: ["title", "parent_id", "level"],
      validate: (body, ctx = {}) => {
        if (ctx.partial === true && body.parent_id === undefined) return null;
        return typeof body.parent_id === "string" ? null : "parent_id is required.";
      },
      toPayload: (body) => ({
        title: body.title,
        parent_id: body.parent_id,
        level: body.parent_id === undefined ? body.level : 2,
      }),
    });

    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/widgets/w1`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ parent_id: "p2" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.widget.parent_id).toBe("p2");
      expect(body.widget.level).toBe(2);
    });

    expect(calls.update).toEqual([{ parent_id: "p2", level: 2 }]);
  });

  it("drops undefined values so an absent field never overwrites a stored value", async () => {
    const calls = makeDb({
      maybeSingle: () => ({
        data: { id: "w1", title: "Old", sort_order: 5, is_active: true },
        error: null,
      }),
      update: () => ({
        data: [{ id: "w1", title: "New", sort_order: 5, is_active: true }],
        error: null,
      }),
    });
    const app = buildApp({
      toPayload: (body) => ({
        title: body.title,
        sort_order: body.sort_order,
        is_active: body.is_active,
      }),
    });

    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/widgets/w1`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ title: "New" }),
      });
      expect(res.status).toBe(200);
    });

    expect(calls.update).toEqual([{ title: "New" }]);
  });
});

describe("createCrudRouter — GET", () => {
  it("returns the list under listKey, filters to is_active and orders by orderColumn then created_at", async () => {
    const rows = [{ id: "a", title: "A" }];
    const calls = makeDb({ select: () => ({ data: rows, error: null }) });
    const app = buildApp();

    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/widgets`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ widgets: rows });
    });

    expect(calls.tables).toEqual(["widgets"]);
    expect(calls.eq).toContainEqual(["is_active", true]);
    expect(calls.order).toEqual([
      ["sort_order", { ascending: true }],
      ["created_at", { ascending: true }],
    ]);
  });

  it("defaults listKey to resourceKey", async () => {
    makeDb({ select: () => ({ data: [], error: null }) });
    const app = buildApp({ listKey: undefined });

    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/widgets`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ widget: [] });
    });
  });

  it("with includeInactive=1 and an admin token includes inactive rows", async () => {
    const rows = [{ id: "a" }, { id: "b", is_active: false }];
    const calls = makeDb({ select: () => ({ data: rows, error: null }) });
    const app = buildApp();

    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/widgets?includeInactive=1`, {
        headers: adminHeaders(),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ widgets: rows });
    });

    expect(calls.eq.map(([column]) => column)).not.toContain("is_active");
    expect(calls.order).toEqual([
      ["sort_order", { ascending: true }],
      ["created_at", { ascending: true }],
    ]);
  });

  it("rejects includeInactive=1 without a token as 401 and does not query", async () => {
    makeDb();
    const app = buildApp();

    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/widgets?includeInactive=1`);
      expect(res.status).toBe(401);
      expect((await res.json()).error).toEqual(expect.any(String));
    });

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("rejects includeInactive=1 for a signed-in non-admin as 403 and does not query", async () => {
    makeDb();
    const app = buildApp();

    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/widgets?includeInactive=1`, {
        headers: userHeaders(),
      });
      expect(res.status).toBe(403);
      expect((await res.json()).error).toEqual(expect.any(String));
    });

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("surfaces a list read database error as a generic 500 without the database text", async () => {
    makeDb({ select: () => ({ data: null, error: { message: "db list boom" } }) });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = buildApp();

    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/widgets`);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: "Could not load content." });
      expect(JSON.stringify(body)).not.toMatch(/db list boom/);
    });

    expect(consoleSpy).toHaveBeenCalledWith(expect.any(String), "db list boom");
  });

  it("surfaces a thrown list read as a generic 500 without the exception text", async () => {
    makeDb({
      select: () => {
        throw new Error("connection reset");
      },
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = buildApp();

    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/widgets`);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: "Could not load content." });
      expect(JSON.stringify(body)).not.toMatch(/connection reset/);
    });

    expect(consoleSpy).toHaveBeenCalledWith(expect.any(String), "connection reset");
  });

  it("returns a single row under resourceKey", async () => {
    const row = { id: "w1", title: "One" };
    makeDb({ maybeSingle: () => ({ data: row, error: null }) });
    const app = buildApp();

    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/widgets/w1`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ widget: row });
    });
  });

  it("returns 404 with an error key for a missing single row", async () => {
    makeDb({ maybeSingle: () => ({ data: null, error: null }) });
    const app = buildApp();

    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/widgets/missing`);
      expect(res.status).toBe(404);
      expect((await res.json()).error).toEqual(expect.any(String));
    });
  });

  it("surfaces a single row read error as a generic 500 without the database text", async () => {
    makeDb({ maybeSingle: () => ({ data: null, error: { message: "single read boom" } }) });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = buildApp();

    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/widgets/w1`);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: "Could not load content." });
      expect(JSON.stringify(body)).not.toMatch(/single read boom/);
    });

    expect(consoleSpy).toHaveBeenCalledWith(expect.any(String), "single read boom");
  });
});

describe("createCrudRouter — DELETE", () => {
  it("deletes an existing row and returns a message", async () => {
    const calls = makeDb({
      maybeSingle: () => ({ data: { id: "w1" }, error: null }),
      delete: () => ({ data: null, error: null }),
    });
    const app = buildApp();

    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/widgets/w1`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      expect(res.status).toBe(200);
      expect((await res.json()).message).toEqual(expect.any(String));
    });

    expect(calls.delete).toBe(1);
  });

  it("returns 404 on a missing id and never calls delete", async () => {
    const calls = makeDb({ maybeSingle: () => ({ data: null, error: null }) });
    const app = buildApp();

    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/widgets/missing`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      expect(res.status).toBe(404);
      expect((await res.json()).error).toEqual(expect.any(String));
    });

    expect(calls.delete).toBe(0);
  });

  it("surfaces a database delete error as 500", async () => {
    makeDb({
      maybeSingle: () => ({ data: { id: "w1" }, error: null }),
      delete: () => ({ data: null, error: { message: "db delete boom" } }),
    });
    const app = buildApp();

    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/widgets/w1`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      expect(res.status).toBe(500);
      expect((await res.json()).error).toMatch(/db delete boom/);
    });
  });
});

describe("applyReorder", () => {
  const SCOPE_ERROR = "Reorder must include every item in the scope.";

  it("renumbers a complete ordered list to display_order 0..n-1 in array order", () => {
    const result = applyReorder(
      ["a", "b", "c"],
      [{ id: "c", display_order: 42 }, { id: "a", display_order: 7 }, { id: "b" }]
    );

    expect(result).toEqual({
      renumbered: [
        { id: "c", display_order: 0 },
        { id: "a", display_order: 1 },
        { id: "b", display_order: 2 },
      ],
    });
  });

  it("rejects a partial list", () => {
    const result = applyReorder(["a", "b", "c"], [{ id: "a" }, { id: "b" }]);

    expect(result).toEqual({ error: SCOPE_ERROR });
  });

  it("rejects an id outside the scope", () => {
    const result = applyReorder(["a", "b"], [{ id: "a" }, { id: "b" }, { id: "c" }]);

    expect(result).toEqual({ error: SCOPE_ERROR });
  });

  it("rejects a repeated id", () => {
    const result = applyReorder(["a", "b"], [{ id: "a" }, { id: "a" }, { id: "b" }]);

    expect(result).toEqual({ error: SCOPE_ERROR });
  });

  it("rejects an entry with no id", () => {
    const result = applyReorder(["a", "b"], [{ id: "a" }, { display_order: 1 }]);

    expect(result).toEqual({ error: SCOPE_ERROR });
  });
});
