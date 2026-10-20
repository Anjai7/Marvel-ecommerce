// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("../db.js", () => ({ supabase: { from: mockFrom } }));

import app from "../app.js";
import { signUserToken } from "../middleware/auth.js";

/**
 * Supabase double that records every write. It never resolves a read with rows:
 * the point of this suite is that a rejected write must never reach the builder
 * at all, so a 401/403 with `mockFrom` untouched is the strongest signal.
 */
function makeDb() {
  const calls = { upsert: [], update: [], insert: [], delete: 0 };

  mockFrom.mockReset();
  mockFrom.mockImplementation(() => {
    const query = {
      select: () => query,
      eq: () => query,
      in: () => query,
      order: () => query,
      single: () => Promise.resolve({ data: null, error: null }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      upsert: (row) => {
        calls.upsert.push(row);
        return query;
      },
      insert: (row) => {
        calls.insert.push(row);
        return query;
      },
      update: (row) => {
        calls.update.push(row);
        return query;
      },
      delete: () => {
        calls.delete += 1;
        return query;
      },
      then: (onFulfilled, onRejected) =>
        Promise.resolve({ data: [], error: null }).then(onFulfilled, onRejected),
    };
    return query;
  });

  return calls;
}

/**
 * Every write route in the content surface. `PATCH .../reorder` routes are
 * included for the footer section and link scopes as well as hero, banners,
 * categories and menu — the spec's §8.1 item 8 lists "both reorders".
 *
 * The `products`, `orders` and `GET /api/users` write surfaces are deliberately
 * NOT here: they are out of this plan's security scope (§8.2) and are asserted
 * nowhere, because a test claiming they are protected would fail.
 */
const writeRoutes = [
  ["POST", "/api/categories", { name: "X", slug: "x" }],
  ["PATCH", "/api/categories/c1", { name: "X" }],
  ["DELETE", "/api/categories/c1", undefined],
  ["PATCH", "/api/categories/reorder", { orders: [] }],
  ["POST", "/api/content/hero", { title: "X" }],
  ["PATCH", "/api/content/hero/h1", { title: "X" }],
  ["DELETE", "/api/content/hero/h1", undefined],
  ["PATCH", "/api/content/hero/reorder", { orders: [] }],
  ["POST", "/api/content/banners", { title: "X", placement: "promo_strip" }],
  ["PATCH", "/api/content/banners/b1", { title: "X" }],
  ["DELETE", "/api/content/banners/b1", undefined],
  ["PATCH", "/api/content/banners/reorder", { orders: [] }],
  ["POST", "/api/content/footer/sections", { heading: "X" }],
  ["PATCH", "/api/content/footer/sections/s1", { heading: "X" }],
  ["DELETE", "/api/content/footer/sections/s1", undefined],
  ["PATCH", "/api/content/footer/sections/reorder", { orders: [] }],
  ["POST", "/api/content/footer/links", { section_id: "s1", label: "X", href: "/x" }],
  ["PATCH", "/api/content/footer/links/l1", { label: "X" }],
  ["DELETE", "/api/content/footer/links/l1", undefined],
  ["PATCH", "/api/content/footer/links/reorder", { orders: [] }],
  ["POST", "/api/menu", { title: "X", path: "/x" }],
  ["PATCH", "/api/menu/m1", { title: "X" }],
  ["DELETE", "/api/menu/m1", undefined],
  ["PATCH", "/api/menu/reorder", { orders: [] }],
  ["POST", "/api/upload", { folder: "marvel_content" }],
];

const JSON_HEADERS = { "Content-Type": "application/json" };

describe("content write authorization", () => {
  let server;
  let base;
  let userHeaders;

  beforeAll(
    () =>
      new Promise((resolve) => {
        server = app.listen(0, () => {
          base = `http://127.0.0.1:${server.address().port}`;
          userHeaders = {
            ...JSON_HEADERS,
            Authorization: `Bearer ${signUserToken({
              id: "t-authz-user",
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

  const send = (method, path, body, headers) =>
    fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  it.each(writeRoutes)(
    "%s %s without a token is 401 and never touches the db",
    async (method, path, body) => {
      const calls = makeDb();

      const res = await send(method, path, body, JSON_HEADERS);

      expect(res.status).toBe(401);
      const payload = await res.json();
      expect(payload).toHaveProperty("error");
      expect(calls.upsert).toEqual([]);
      expect(calls.update).toEqual([]);
      expect(calls.insert).toEqual([]);
      expect(calls.delete).toBe(0);
      expect(mockFrom).not.toHaveBeenCalled();
    }
  );

  it.each(writeRoutes)(
    "%s %s with a user token is 403 and never touches the db",
    async (method, path, body) => {
      const calls = makeDb();

      const res = await send(method, path, body, userHeaders);

      expect(res.status).toBe(403);
      const payload = await res.json();
      expect(payload).toHaveProperty("error");
      expect(calls.upsert).toEqual([]);
      expect(calls.update).toEqual([]);
      expect(calls.insert).toEqual([]);
      expect(calls.delete).toBe(0);
      expect(mockFrom).not.toHaveBeenCalled();
    }
  );

  it.each(writeRoutes)(
    "%s %s with an admin token is not blocked by the guard",
    async (method, path, body) => {
      const adminHeaders = {
        ...JSON_HEADERS,
        Authorization: `Bearer ${signUserToken({
          id: "t-authz-admin",
          email: "admin@test.local",
          role: "admin",
        })}`,
      };
      makeDb();

      const res = await send(method, path, body, adminHeaders);

      // The guard must pass for an admin; whatever the handler answers next
      // (validation, a missing row, a successful write) is that route's business.
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    }
  );
});
