// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("../db.js", () => ({ supabase: { from: mockFrom } }));

import app from "../app.js";
import { signUserToken } from "../middleware/auth.js";

/**
 * Chainable Supabase double.
 *
 * Every builder records the call it received, so a test can assert exactly
 * which rows were written and which filters were sent. Awaiting the builder
 * resolves with the result the test configured for the operation in play
 * (`select` for reads, `maybeSingle`/`single` for one-row lookups,
 * `insert`/`update`/`delete`/`upsert` for writes).
 */
function makeDb(handlers = {}) {
  const calls = {
    tables: [],
    select: [],
    eq: [],
    ilike: [],
    in: [],
    or: [],
    order: [],
    limit: [],
    range: [],
    insert: [],
    update: [],
    upsert: [],
    delete: 0,
    maybeSingle: 0,
    single: 0,
  };

  mockFrom.mockReset();
  mockFrom.mockImplementation((table) => {
    calls.tables.push(table);
    const state = { op: null, columns: null, options: null, row: null, filters: [] };

    function resolve(op, currentState, currentTable) {
      const handler = handlers[op];
      return handler ? handler(currentState, currentTable, calls) : { data: [], error: null };
    }

    const query = {
      select(columns, options) {
        if (state.op === null) state.op = "select";
        state.columns = columns;
        state.options = options ?? null;
        calls.select.push(columns);
        return query;
      },
      eq(column, value) {
        calls.eq.push([column, value]);
        state.filters.push(["eq", column, value]);
        return query;
      },
      ilike(column, value) {
        calls.ilike.push([column, value]);
        state.filters.push(["ilike", column, value]);
        return query;
      },
      in(column, values) {
        calls.in.push([column, values]);
        state.filters.push(["in", column, values]);
        return query;
      },
      or(filter) {
        calls.or.push(filter);
        state.filters.push(["or", null, filter]);
        return query;
      },
      order(column, options) {
        calls.order.push([column, options]);
        return query;
      },
      limit(count) {
        calls.limit.push(count);
        return query;
      },
      range(from, to) {
        calls.range.push([from, to]);
        return query;
      },
      upsert(row) {
        state.op = "upsert";
        state.row = row;
        calls.upsert.push(row);
        return query;
      },
      insert(row) {
        state.op = "insert";
        state.row = row;
        for (const entry of Array.isArray(row) ? row : [row]) calls.insert.push(entry);
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
        return Promise.resolve(resolve("maybeSingle", state, table));
      },
      single() {
        calls.single += 1;
        return Promise.resolve(resolve("single", state, table));
      },
      then(onFulfilled, onRejected) {
        return Promise.resolve(resolve(state.op, state, table)).then(onFulfilled, onRejected);
      },
    };

    return query;
  });

  return calls;
}

/** The id a builder filtered on, for the handlers that need to echo it back. */
function filteredId(state) {
  const filter = state.filters.find(([, column]) => column === "id");
  return filter ? filter[2] : null;
}

const HOUR = 60 * 60 * 1000;
const NOW = Date.now();
const FUTURE = new Date(NOW + HOUR).toISOString();
const PAST = new Date(NOW - HOUR).toISOString();

const page = (overrides = {}) => ({
  id: "page-1",
  slug: "diwali-sale",
  title: "Diwali Sale",
  description: "The big sale.",
  kind: "campaign",
  template: "landing",
  status: "published",
  published_at: "2026-10-01T00:00:00.000Z",
  scheduled_at: null,
  expired_at: null,
  category_id: null,
  seo: {},
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-01T00:00:00.000Z",
  ...overrides,
});

const section = (overrides = {}) => ({
  id: "sec-1",
  page_id: "page-1",
  type: "hero",
  position: 0,
  enabled: true,
  data: { heading: "Hello" },
  style: {},
  ...overrides,
});

/** The sections read, split by the table the builder was made for. */
const sectionsHandler = (rows) => (state, table) =>
  table === "page_sections" ? { data: rows, error: null } : { data: [], error: null };

describe("pages API", () => {
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
              id: "t-page-admin",
              email: "admin@test.local",
              role: "admin",
            })}`,
          };
          userHeaders = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${signUserToken({
              id: "t-page-user",
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

  it("unauthenticated POST /api/pages answers 401 and never touches the db", async () => {
    const calls = makeDb();

    const res = await fetch(`${base}/api/pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "new-page", title: "New" }),
    });

    expect(res.status).toBe(401);
    expect((await res.json()).error).toEqual(expect.any(String));
    expect(mockFrom).not.toHaveBeenCalled();
    expect(calls.insert).toEqual([]);
  });

  it("customer token POST /api/pages answers 403 and never touches the db", async () => {
    const calls = makeDb();

    const res = await send("POST", "/api/pages", { slug: "new-page", title: "New" }, userHeaders);

    expect(res.status).toBe(403);
    expect((await res.json()).error).toEqual(expect.any(String));
    expect(mockFrom).not.toHaveBeenCalled();
    expect(calls.insert).toEqual([]);
  });

  it("admin token POST /api/pages is not blocked by the guard", async () => {
    makeDb({
      single: (state) => ({ data: { id: "page-new", ...state.row }, error: null }),
    });

    const res = await send("POST", "/api/pages", { slug: "new-page", title: "New" });

    expect(res.status).toBe(201);
    expect((await res.json()).page.slug).toBe("new-page");
  });

  it("POST /api/pages rejects a reserved slug", async () => {
    const calls = makeDb();

    const res = await send("POST", "/api/pages", { slug: "admin", title: "x" });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toEqual(expect.any(String));
    expect(calls.insert).toEqual([]);
  });

  it("POST /api/pages rejects a duplicate slug", async () => {
    const calls = makeDb({
      single: () => ({
        data: null,
        error: {
          code: "23505",
          message: 'duplicate key value violates unique constraint "pages_slug_unique"',
        },
      }),
    });

    const res = await send("POST", "/api/pages", { slug: "diwali-sale", title: "Again" });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "A page with this slug already exists." });
    expect(calls.insert.length).toBe(1);
  });

  it("POST /api/pages creates a draft by default", async () => {
    const calls = makeDb({
      single: (state) => ({ data: { id: "page-new", ...state.row }, error: null }),
    });

    const res = await send("POST", "/api/pages", { slug: "new-page", title: "New" });

    expect(res.status).toBe(201);
    expect(calls.insert[0].status).toBe("draft");
    // The sections live in their own table, never in a column of the page.
    expect(Object.hasOwn(calls.insert[0], "sections")).toBe(false);
    // Only the whitelisted columns are written.
    expect(Object.keys(calls.insert[0]).sort()).toEqual(["slug", "status", "title"]);
  });

  it("GET /api/pages/category/:categoryId returns null when the category has no page", async () => {
    makeDb({ maybeSingle: () => ({ data: null, error: null }) });

    const res = await get("/api/pages/category/cat-1");

    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it("GET /api/pages/category/:categoryId returns the page bound to the category", async () => {
    const bound = page({ id: "page-cat", category_id: "cat-1" });
    makeDb({
      maybeSingle: () => ({ data: bound, error: null }),
      select: sectionsHandler([]),
    });

    const res = await get("/api/pages/category/cat-1");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.category_id).toBe("cat-1");
    expect(body.id).toBe("page-cat");
  });

  it("GET /api/pages/category/:categoryId answers 404 for a draft without an admin token", async () => {
    makeDb({ maybeSingle: () => ({ data: page({ status: "draft" }), error: null }) });

    const res = await get("/api/pages/category/cat-1");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Page not found." });
  });

  it("GET /api/pages/category/:categoryId with ?preview=1 and an admin token returns a draft", async () => {
    const draft = page({ status: "draft" });
    makeDb({
      maybeSingle: () => ({ data: draft, error: null }),
      select: sectionsHandler([]),
    });

    const res = await get("/api/pages/category/cat-1?preview=1", adminHeaders);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(draft.id);
    expect(body.status).toBe("draft");
  });

  it("GET /api/pages/slug/:slug answers 404 for an unknown slug", async () => {
    makeDb({ maybeSingle: () => ({ data: null, error: null }) });

    const res = await get("/api/pages/slug/ghost");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Page not found." });
  });

  it("GET /api/pages/slug/:slug answers 404 for a draft page", async () => {
    makeDb({ maybeSingle: () => ({ data: page({ status: "draft" }), error: null }) });

    const res = await get("/api/pages/slug/diwali-sale");

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "Page not found." });
    // The title of a hidden page must not leak.
    expect(JSON.stringify(body)).not.toContain("Diwali Sale");
  });

  it("GET /api/pages/slug/:slug answers 404 for a scheduled page before its time", async () => {
    makeDb({
      maybeSingle: () => ({
        data: page({ status: "scheduled", scheduled_at: FUTURE }),
        error: null,
      }),
    });

    const res = await get("/api/pages/slug/diwali-sale");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Page not found." });
  });

  it("GET /api/pages/slug/:slug answers 404 for an expired page", async () => {
    makeDb({
      maybeSingle: () => ({
        data: page({ status: "published", expired_at: PAST }),
        error: null,
      }),
    });

    const res = await get("/api/pages/slug/diwali-sale");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Page not found." });
  });

  it("GET /api/pages/slug/:slug returns the page and its ordered sections", async () => {
    const published = page();
    const sections = [
      section({ id: "sec-1", position: 0 }),
      section({ id: "sec-2", position: 1, type: "richtext" }),
      section({ id: "sec-3", position: 2, type: "cta" }),
    ];
    const calls = makeDb({
      maybeSingle: () => ({ data: published, error: null }),
      select: sectionsHandler(sections),
    });

    const res = await get("/api/pages/slug/diwali-sale");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.page).toEqual(published);
    expect(body.sections.map((row) => row.id)).toEqual(["sec-1", "sec-2", "sec-3"]);
    expect(calls.order).toContainEqual(["position", { ascending: true }]);
  });

  it("GET /api/pages/slug/:slug returns only enabled sections", async () => {
    const sections = [
      section({ id: "sec-1", position: 0 }),
      section({ id: "sec-2", position: 1, enabled: false }),
    ];
    makeDb({
      maybeSingle: () => ({ data: page(), error: null }),
      select: sectionsHandler(sections),
    });

    const res = await get("/api/pages/slug/diwali-sale");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sections.map((row) => row.id)).toEqual(["sec-1"]);
  });

  it("GET /api/pages/slug/:slug with ?preview=1 and an admin token returns a draft", async () => {
    const draft = page({ status: "draft" });
    makeDb({
      maybeSingle: () => ({ data: draft, error: null }),
      select: sectionsHandler([]),
    });

    const res = await get("/api/pages/slug/diwali-sale?preview=1", adminHeaders);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.page.id).toBe(draft.id);
    expect(body.status).toBe("draft");
  });

  it("GET /api/pages/slug/:slug with ?preview=1 and no token answers 404", async () => {
    makeDb({ maybeSingle: () => ({ data: page({ status: "draft" }), error: null }) });

    const res = await get("/api/pages/slug/diwali-sale?preview=1");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Page not found." });
  });

  it("GET /api/pages/slug/:slug with ?preview=1 and a customer token answers 404", async () => {
    makeDb({ maybeSingle: () => ({ data: page({ status: "draft" }), error: null }) });

    const res = await get("/api/pages/slug/diwali-sale?preview=1", userHeaders);

    // Not a 403: an unauthorised preview must look like a missing page.
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Page not found." });
  });

  it("PUT /api/pages/:id/sections rejects a section with an unknown type", async () => {
    const calls = makeDb();

    const res = await send("PUT", "/api/pages/page-1/sections", {
      sections: [{ type: "nope", data: {} }],
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toEqual(expect.any(String));
    expect(calls.update).toEqual([]);
    expect(calls.insert).toEqual([]);
  });

  it("PUT /api/pages/:id/sections rejects a section with a javascript href", async () => {
    const calls = makeDb();

    const res = await send("PUT", "/api/pages/page-1/sections", {
      sections: [{ type: "hero", data: { heading: "x", cta_href: "javascript:alert(1)" } }],
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toEqual(expect.any(String));
    expect(calls.update).toEqual([]);
    expect(calls.insert).toEqual([]);
  });

  it("PUT /api/pages/:id/sections rejects more than the section cap", async () => {
    const calls = makeDb();
    const sections = Array.from({ length: 25 }, (_, index) => ({
      type: "hero",
      data: { heading: `Heading ${index}` },
    }));

    const res = await send("PUT", "/api/pages/page-1/sections", { sections });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toEqual(expect.any(String));
    expect(calls.update).toEqual([]);
    expect(calls.insert).toEqual([]);
  });

  it("PUT /api/pages/:id/sections writes the sections in the submitted order", async () => {
    const calls = makeDb({
      select: sectionsHandler([]),
      single: (state) => ({
        data: { id: `sec-new-${state.row.position}`, page_id: state.row.page_id, ...state.row },
        error: null,
      }),
    });

    const res = await send("PUT", "/api/pages/page-1/sections", {
      sections: [
        { type: "hero", data: { heading: "One" } },
        { type: "richtext", data: { body: "Two" } },
        { type: "cta", data: { heading: "Three" } },
      ],
    });

    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe("Sections saved.");
    expect(calls.insert).toHaveLength(3);
    expect(calls.insert.map((row) => row.position)).toEqual([0, 1, 2]);
    expect(calls.insert.map((row) => row.type)).toEqual(["hero", "richtext", "cta"]);
  });

  it("PUT /api/pages/:id/sections keeps an existing section id", async () => {
    const calls = makeDb({
      select: sectionsHandler([section({ id: "sec-1", position: 0 })]),
      single: (state) => ({ data: { id: filteredId(state), ...state.row }, error: null }),
    });

    const res = await send("PUT", "/api/pages/page-1/sections", {
      sections: [{ id: "sec-1", type: "hero", data: { heading: "One" } }],
    });

    expect(res.status).toBe(200);
    // The row was updated, not inserted again.
    expect(calls.insert).toEqual([]);
    expect(calls.update.length).toBeGreaterThan(0);
    expect(calls.update[calls.update.length - 1]).toEqual(
      expect.objectContaining({ type: "hero", position: 0 })
    );
    expect(calls.eq).toContainEqual(["id", "sec-1"]);
  });

  it("PUT /api/pages/:id/sections removes a section that is no longer submitted", async () => {
    const calls = makeDb({
      select: sectionsHandler([
        section({ id: "sec-1", position: 0 }),
        section({ id: "sec-2", position: 1 }),
        section({ id: "sec-3", position: 2 }),
      ]),
      single: (state) => ({ data: { id: filteredId(state), ...state.row }, error: null }),
    });

    const res = await send("PUT", "/api/pages/page-1/sections", {
      sections: [
        { id: "sec-1", type: "hero", data: { heading: "One" } },
        { id: "sec-2", type: "hero", data: { heading: "Two" } },
      ],
    });

    expect(res.status).toBe(200);
    expect(calls.delete).toBe(1);
    expect(calls.in).toContainEqual(["id", ["sec-3"]]);
  });

  it("POST /api/pages/:id/publish sets status published and published_at", async () => {
    const calls = makeDb({
      single: (state) => ({ data: { id: "page-1", ...state.row }, error: null }),
    });

    const res = await send("POST", "/api/pages/page-1/publish", {});

    expect(res.status).toBe(200);
    expect(calls.update[0].status).toBe("published");
    expect(calls.update[0].published_at).toEqual(expect.any(String));
    expect((await res.json()).scheduled).toBe(false);
  });

  it("POST /api/pages/:id/publish with a future scheduled_at stays published and reports scheduled", async () => {
    const calls = makeDb({
      single: (state) => ({ data: { id: "page-1", ...state.row }, error: null }),
    });

    const res = await send("POST", "/api/pages/page-1/publish", { scheduled_at: FUTURE });

    expect(res.status).toBe(200);
    // The schedule is a timestamp, not a status: nothing has to flip the page
    // back when the clock passes it.
    expect(calls.update[0].status).toBe("published");
    expect(calls.update[0].scheduled_at).toBe(FUTURE);
    expect((await res.json()).scheduled).toBe(true);
  });

  it("POST /api/pages/:id/unpublish sets status draft", async () => {
    const calls = makeDb({
      single: (state) => ({ data: { id: "page-1", ...state.row }, error: null }),
    });

    const res = await send("POST", "/api/pages/page-1/unpublish", {});

    expect(res.status).toBe(200);
    expect(calls.update[0].status).toBe("draft");
    expect(calls.update[0].published_at).toBeNull();
  });

  it("customer token POST /api/pages/:id/publish answers 403 and never touches the db", async () => {
    const calls = makeDb();

    const res = await send("POST", "/api/pages/page-1/publish", {}, userHeaders);

    expect(res.status).toBe(403);
    expect((await res.json()).error).toEqual(expect.any(String));
    expect(mockFrom).not.toHaveBeenCalled();
    expect(calls.update).toEqual([]);
  });

  it("GET /api/pages applies the public visibility predicate to a public request", async () => {
    const calls = makeDb({ select: () => ({ data: [page()], error: null }) });

    const res = await get("/api/pages");

    expect(res.status).toBe(200);
    expect((await res.json()).pages).toHaveLength(1);
    expect(calls.eq).toContainEqual(["status", "published"]);
    expect(calls.or).toHaveLength(2);
    expect(calls.or[0]).toMatch(/^scheduled_at\.is\.null,scheduled_at\.lte\./);
    expect(calls.or[1]).toMatch(/^expired_at\.is\.null,expired_at\.gt\./);
    expect(calls.order).toContainEqual(["created_at", { ascending: false }]);
  });

  it("GET /api/pages with an admin token does not apply the public visibility predicate", async () => {
    const calls = makeDb({ select: () => ({ data: [page({ status: "draft" })], error: null }) });

    const res = await get("/api/pages", adminHeaders);

    expect(res.status).toBe(200);
    expect((await res.json()).pages).toHaveLength(1);
    expect(calls.eq.map(([column]) => column)).not.toContain("status");
    expect(calls.or).toEqual([]);
  });

  it("GET /api/pages/:id requires an admin token", async () => {
    makeDb({
      maybeSingle: () => ({ data: page(), error: null }),
      select: sectionsHandler([section()]),
    });

    const anonymous = await get("/api/pages/page-1");
    expect(anonymous.status).toBe(401);

    const res = await get("/api/pages/page-1", adminHeaders);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.page.id).toBe("page-1");
    expect(body.sections.map((row) => row.id)).toEqual(["sec-1"]);
  });

  it("PATCH /api/pages/:id writes only the whitelisted columns", async () => {
    const calls = makeDb({
      maybeSingle: () => ({ data: page(), error: null }),
      single: (state) => ({ data: { id: "page-1", ...state.row }, error: null }),
    });

    const res = await send("PATCH", "/api/pages/page-1", {
      title: "New title",
      id: "page-9",
      created_at: "2020-01-01T00:00:00.000Z",
      updated_at: "2020-01-01T00:00:00.000Z",
      is_active: true,
      sections: [],
    });

    expect(res.status).toBe(200);
    expect(calls.update).toEqual([{ title: "New title" }]);
  });
});
