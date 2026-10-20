// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("../db.js", () => ({ supabase: { from: mockFrom } }));

import app from "../app.js";
import { signUserToken } from "../middleware/auth.js";

/**
 * Chainable Supabase double. `from(table)` returns a builder that records every
 * call and, when awaited, resolves with the handler configured for the current
 * operation (`select`, `upsert`, `update`, `delete`) or `maybeSingle`.
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
    const state = { op: null, columns: null, row: null };

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

const heroOne = { id: "h1", title: "Deal", subtitle: "Old", order_index: 0, is_active: true };
const heroTwo = { id: "h2", title: "New", subtitle: null, order_index: 1, is_active: true };
const heroThree = { id: "h3", title: "Third", subtitle: null, order_index: 2, is_active: true };

const bannerOne = {
  id: "b1",
  placement: "home_promo_carousel",
  title: "Sale",
  display_order: 0,
  is_active: true,
};
const bannerTwo = {
  id: "b2",
  placement: "promo_strip",
  title: "Strip",
  display_order: 0,
  is_active: true,
};

const supportSection = {
  id: "s1",
  heading: "Customer Support",
  section_type: "links",
  column_index: 0,
  display_order: 0,
  is_active: true,
};
const popularSection = {
  id: "s2",
  heading: "Popular Searches",
  section_type: "tags",
  column_index: 1,
  display_order: 1,
  is_active: true,
};
const helpLink = {
  id: "l1",
  section_id: "s1",
  label: "Help Center",
  href: "/help",
  display_order: 0,
  is_active: true,
};
const returnsLink = {
  id: "l2",
  section_id: "s1",
  label: "Returns",
  href: "/returns",
  display_order: 1,
  is_active: true,
};
const shoesLink = {
  id: "l3",
  section_id: "s2",
  label: "Shoes",
  href: "/search?q=shoes",
  display_order: 0,
  is_active: true,
};

const footerLinks = [returnsLink, shoesLink, helpLink];

describe("content API", () => {
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
              id: "t-content-admin",
              email: "admin@test.local",
              role: "admin",
            })}`,
          };
          userHeaders = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${signUserToken({
              id: "t-content-user",
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

  describe("hero slides", () => {
    it("GET /api/content/hero returns { slides } filtered to active rows", async () => {
      const calls = makeDb({ select: () => ({ data: [heroOne, heroTwo], error: null }) });

      const res = await get("/api/content/hero");

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ slides: [heroOne, heroTwo] });
      expect(calls.eq).toContainEqual(["is_active", true]);
      expect(calls.order[0]).toEqual(["order_index", { ascending: true }]);
    });

    it("GET /api/content/hero?includeInactive=1 with an admin token does not filter is_active", async () => {
      const calls = makeDb({
        select: () => ({ data: [heroOne, { ...heroTwo, is_active: false }], error: null }),
      });

      const res = await get("/api/content/hero?includeInactive=1", adminHeaders);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.slides).toHaveLength(2);
      expect(calls.eq.map(([column]) => column)).not.toContain("is_active");
    });

    it("GET /api/content/hero?includeInactive=1 without a token is 401 and does not query", async () => {
      makeDb();

      const res = await get("/api/content/hero?includeInactive=1");

      expect(res.status).toBe(401);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("GET /api/content/hero surfaces a list read error as 500", async () => {
      makeDb({ select: () => ({ data: null, error: { message: "db list boom" } }) });
      vi.spyOn(console, "error").mockImplementation(() => {});

      const res = await get("/api/content/hero");

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Could not load content." });
    });

    it("POST /api/content/hero returns 201 with the persisted row", async () => {
      const saved = { ...heroOne, id: "h-new" };
      const calls = makeDb({ upsert: () => ({ data: [saved], error: null }) });

      const res = await send("POST", "/api/content/hero", { title: "Deal", order_index: 0 });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.message).toEqual(expect.any(String));
      expect(body.slide).toEqual(saved);
      expect(calls.upsert).toEqual([{ title: "Deal", order_index: 0 }]);
    });

    it("POST /api/content/hero surfaces a Supabase write error as 500", async () => {
      makeDb({ upsert: () => ({ data: null, error: { message: "db write boom" } }) });

      const res = await send("POST", "/api/content/hero", { title: "Sale", order_index: 0 });

      expect(res.status).toBe(500);
      expect((await res.json()).error).toMatch(/db write boom/);
    });

    it("PATCH /api/content/hero/:id writes only the keys the client sent", async () => {
      const calls = makeDb({
        maybeSingle: () => ({ data: heroOne, error: null }),
        update: () => ({ data: [{ ...heroOne, subtitle: "New" }], error: null }),
      });

      const res = await send("PATCH", `/api/content/hero/${heroOne.id}`, { subtitle: "New" });

      expect(res.status).toBe(200);
      expect((await res.json()).slide.subtitle).toBe("New");
      expect(calls.update).toEqual([{ subtitle: "New" }]);
      expect(calls.update[0]).not.toHaveProperty("order_index");
    });

    it("PATCH /api/content/hero/:id on a missing id is 404 and never updates", async () => {
      const calls = makeDb({ maybeSingle: () => ({ data: null, error: null }) });

      const res = await send("PATCH", "/api/content/hero/missing", { subtitle: "New" });

      expect(res.status).toBe(404);
      expect((await res.json()).error).toEqual(expect.any(String));
      expect(calls.update).toEqual([]);
    });

    it("PATCH /api/content/hero/reorder renumbers order_index to 0..n-1", async () => {
      const calls = makeDb({
        select: () => ({
          data: [{ id: heroOne.id }, { id: heroTwo.id }, { id: heroThree.id }],
          error: null,
        }),
      });

      const res = await send("PATCH", "/api/content/hero/reorder", {
        orders: [
          { id: heroThree.id, display_order: 5 },
          { id: heroOne.id, display_order: 5 },
          { id: heroTwo.id, display_order: 5 },
        ],
      });

      expect(res.status).toBe(200);
      expect((await res.json()).message).toEqual(expect.any(String));
      expect(calls.update).toEqual([{ order_index: 0 }, { order_index: 1 }, { order_index: 2 }]);
      expect(calls.update.some((patch) => "display_order" in patch)).toBe(false);
    });

    it("PATCH /api/content/hero/reorder rejects a partial list and persists nothing", async () => {
      const calls = makeDb({
        select: () => ({ data: [{ id: heroOne.id }, { id: heroTwo.id }], error: null }),
      });

      const res = await send("PATCH", "/api/content/hero/reorder", {
        orders: [{ id: heroOne.id }],
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "Reorder must include every item in the scope.",
      });
      expect(calls.update).toEqual([]);
    });

    it("DELETE /api/content/hero/:id returns 200 { message }", async () => {
      const calls = makeDb({
        maybeSingle: () => ({ data: { id: heroOne.id }, error: null }),
        delete: () => ({ data: null, error: null }),
      });

      const res = await send("DELETE", `/api/content/hero/${heroOne.id}`);

      expect(res.status).toBe(200);
      expect((await res.json()).message).toEqual(expect.any(String));
      expect(calls.delete).toBe(1);
    });
  });

  describe("banners", () => {
    it("GET /api/content/banners?placement= filters by placement", async () => {
      const calls = makeDb({
        select: (state, table, recorded) => {
          const placement = recorded.eq.find(([column]) => column === "placement")?.[1];
          const rows = [bannerOne, bannerTwo].filter((row) => row.placement === placement);
          return { data: rows, error: null };
        },
      });

      const res = await get("/api/content/banners?placement=home_promo_carousel");

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ banners: [bannerOne] });
      expect(calls.tables).toEqual(["promo_banners"]);
      expect(calls.eq).toContainEqual(["placement", "home_promo_carousel"]);
    });

    it("GET /api/content/banners with an unknown placement returns an empty list", async () => {
      makeDb({
        select: (state, table, recorded) => {
          const placement = recorded.eq.find(([column]) => column === "placement")?.[1];
          return {
            data: [bannerOne, bannerTwo].filter((row) => row.placement === placement),
            error: null,
          };
        },
      });

      const res = await get("/api/content/banners?placement=not_a_placement");

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ banners: [] });
    });

    it("POST /api/content/banners without a placement is 400 and never touches the db", async () => {
      makeDb();

      const res = await send("POST", "/api/content/banners", { title: "Sale" });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Banner placement is required." });
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("POST /api/content/banners validates gallery entries as https URLs", async () => {
      makeDb();

      const res = await send("POST", "/api/content/banners", {
        title: "Sale",
        placement: "home_promo_carousel",
        gallery: ["ftp://example.com/a.jpg"],
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "gallery entries must be https URLs." });
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("POST /api/content/banners returns 201 with the persisted row", async () => {
      const saved = { ...bannerOne, id: "b-new" };
      const calls = makeDb({ upsert: () => ({ data: [saved], error: null }) });

      const res = await send("POST", "/api/content/banners", {
        placement: "home_promo_carousel",
        title: "Sale",
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.banner).toEqual(saved);
      expect(calls.upsert).toEqual([{ placement: "home_promo_carousel", title: "Sale" }]);
    });

    it("PATCH /api/content/banners/:id writes only the keys the client sent", async () => {
      const calls = makeDb({
        maybeSingle: () => ({ data: bannerOne, error: null }),
        update: () => ({ data: [{ ...bannerOne, subtitle: "New" }], error: null }),
      });

      const res = await send("PATCH", `/api/content/banners/${bannerOne.id}`, {
        subtitle: "New",
      });

      expect(res.status).toBe(200);
      expect(calls.update).toEqual([{ subtitle: "New" }]);
    });

    it("PATCH /api/content/banners/reorder renumbers one placement to 0..n-1", async () => {
      const rows = [bannerOne, bannerTwo, { ...bannerOne, id: "b3" }];
      const calls = makeDb({ select: () => ({ data: rows, error: null }) });

      const res = await send("PATCH", "/api/content/banners/reorder", {
        orders: [{ id: "b3" }, { id: bannerOne.id }],
      });

      expect(res.status).toBe(200);
      expect(calls.update).toEqual([{ display_order: 0 }, { display_order: 1 }]);
    });

    it("PATCH /api/content/banners/reorder rejects a body mixing placements", async () => {
      const calls = makeDb({ select: () => ({ data: [bannerOne, bannerTwo], error: null }) });

      const res = await send("PATCH", "/api/content/banners/reorder", {
        orders: [{ id: bannerOne.id }, { id: bannerTwo.id }],
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "Reorder must include every item in the scope.",
      });
      expect(calls.update).toEqual([]);
    });

    it("DELETE /api/content/banners/:id returns 200 { message }", async () => {
      makeDb({
        maybeSingle: () => ({ data: { id: bannerOne.id }, error: null }),
        delete: () => ({ data: null, error: null }),
      });

      const res = await send("DELETE", `/api/content/banners/${bannerOne.id}`);

      expect(res.status).toBe(200);
    });
  });

  describe("footer", () => {
    const footerDb = (overrides = {}) =>
      makeDb({
        select: (state, table) => {
          if (table === "footer_sections") {
            return { data: [popularSection, supportSection], error: null };
          }
          return { data: footerLinks, error: null };
        },
        ...overrides,
      });

    it("GET /api/content/footer nests links under their section and returns the flat list", async () => {
      const calls = footerDb();

      const res = await get("/api/content/footer");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.links.map((row) => row.id).sort()).toEqual(["l1", "l2", "l3"]);
      expect(body.sections.map((row) => row.id)).toEqual(["s1", "s2"]);
      expect(body.sections[0].links.map((row) => row.id)).toEqual(["l1", "l2"]);
      expect(body.sections[1].links.map((row) => row.id)).toEqual(["l3"]);
      expect(calls.tables).toEqual(["footer_sections", "footer_links"]);
      expect(calls.order[0]).toEqual(["display_order", { ascending: true }]);
      expect(calls.order).toContainEqual(["column_index", { ascending: true }]);
    });

    it("GET /api/content/footer surfaces a read error as 500", async () => {
      makeDb({ select: () => ({ data: null, error: { message: "db footer boom" } }) });
      vi.spyOn(console, "error").mockImplementation(() => {});

      const res = await get("/api/content/footer");

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Could not load content." });
    });

    it("POST /api/content/footer/sections rejects an invalid section_type", async () => {
      makeDb();

      const res = await send("POST", "/api/content/footer/sections", {
        heading: "Support",
        section_type: "bogus",
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "section_type must be one of: links, tags.",
      });
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("POST /api/content/footer/sections returns 201 with the persisted row", async () => {
      const saved = { ...supportSection, id: "s-new" };
      const calls = makeDb({ upsert: () => ({ data: [saved], error: null }) });

      const res = await send("POST", "/api/content/footer/sections", { heading: "Support" });

      expect(res.status).toBe(201);
      expect((await res.json()).section).toEqual(saved);
      expect(calls.upsert).toEqual([{ heading: "Support" }]);
    });

    it("POST /api/content/footer/links requires section_id", async () => {
      makeDb();

      const res = await send("POST", "/api/content/footer/links", {
        label: "Help",
        href: "/help",
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "section_id is required." });
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("PATCH /api/content/footer/links/:id rejects clearing section_id", async () => {
      makeDb();

      const res = await send("PATCH", "/api/content/footer/links/l1", { section_id: null });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "section_id is required." });
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("POST /api/content/footer/links returns 201 with the persisted row", async () => {
      const saved = { ...helpLink, id: "l-new" };
      const calls = makeDb({ upsert: () => ({ data: [saved], error: null }) });

      const res = await send("POST", "/api/content/footer/links", {
        section_id: "s1",
        label: "Help Center",
        href: "/help",
      });

      expect(res.status).toBe(201);
      expect((await res.json()).link).toEqual(saved);
      expect(calls.upsert).toEqual([{ section_id: "s1", label: "Help Center", href: "/help" }]);
    });

    it("PATCH /api/content/footer/links/reorder renumbers one section to 0..n-1", async () => {
      const calls = makeDb({ select: () => ({ data: footerLinks, error: null }) });

      const res = await send("PATCH", "/api/content/footer/links/reorder", {
        orders: [{ id: "l2" }, { id: "l1" }],
      });

      expect(res.status).toBe(200);
      expect(calls.update).toEqual([{ display_order: 0 }, { display_order: 1 }]);
      expect(calls.eq).toEqual(
        expect.arrayContaining([
          ["id", "l2"],
          ["id", "l1"],
        ])
      );
    });

    it("PATCH /api/content/footer/sections/reorder renumbers every section", async () => {
      const calls = makeDb({
        select: () => ({ data: [supportSection, popularSection], error: null }),
      });

      const res = await send("PATCH", "/api/content/footer/sections/reorder", {
        orders: [{ id: "s2" }, { id: "s1" }],
      });

      expect(res.status).toBe(200);
      expect(calls.update).toEqual([{ display_order: 0 }, { display_order: 1 }]);
    });

    it("DELETE /api/content/footer/sections/:id returns 200 { message }", async () => {
      makeDb({
        maybeSingle: () => ({ data: { id: "s1" }, error: null }),
        delete: () => ({ data: null, error: null }),
      });

      const res = await send("DELETE", "/api/content/footer/sections/s1");

      expect(res.status).toBe(200);
    });

    it("DELETE /api/content/footer/links/:id returns 200 { message }", async () => {
      makeDb({
        maybeSingle: () => ({ data: { id: "l1" }, error: null }),
        delete: () => ({ data: null, error: null }),
      });

      const res = await send("DELETE", "/api/content/footer/links/l1");

      expect(res.status).toBe(200);
    });
  });

  describe("write authorization", () => {
    const writeRoutes = [
      ["POST", "/api/content/hero", { title: "X" }],
      ["PATCH", "/api/content/hero/h1", { title: "X" }],
      ["PATCH", "/api/content/hero/reorder", { orders: [] }],
      ["DELETE", "/api/content/hero/h1", undefined],
      ["POST", "/api/content/banners", { title: "X", placement: "promo_strip" }],
      ["PATCH", "/api/content/banners/b1", { title: "X" }],
      ["PATCH", "/api/content/banners/reorder", { orders: [] }],
      ["DELETE", "/api/content/banners/b1", undefined],
      ["POST", "/api/content/footer/sections", { heading: "X" }],
      ["PATCH", "/api/content/footer/sections/s1", { heading: "X" }],
      ["PATCH", "/api/content/footer/sections/reorder", { orders: [] }],
      ["DELETE", "/api/content/footer/sections/s1", undefined],
      ["POST", "/api/content/footer/links", { section_id: "s1", label: "X", href: "/x" }],
      ["PATCH", "/api/content/footer/links/l1", { label: "X" }],
      ["PATCH", "/api/content/footer/links/reorder", { orders: [] }],
      ["DELETE", "/api/content/footer/links/l1", undefined],
    ];

    it.each(writeRoutes)(
      "%s %s without a token is 401 and never touches the db",
      async (method, path, body) => {
        makeDb();

        const res = await send(method, path, body, { "Content-Type": "application/json" });

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
});
