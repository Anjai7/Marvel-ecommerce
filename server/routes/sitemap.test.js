// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("../db.js", () => ({ supabase: { from: mockFrom } }));

import app from "../app.js";

/**
 * One `or` clause of a PostgREST filter: `column.operator.operand`.
 *
 * The sitemap expresses the visibility rule as three filters — an equality on
 * the status and two `or` clauses for the schedule and the expiry — so the
 * double has to understand them to answer like the database does.
 */
function matchPart(row, part) {
  const [column, operator, ...rest] = part.split(".");
  const operand = rest.join(".");
  const value = row[column] ?? null;

  if (operator === "is") {
    if (operand === "null") return value === null || value === undefined;
    return String(value) === operand;
  }
  if (operator === "lte") {
    if (value === null) return false;
    return Date.parse(value) <= Date.parse(operand);
  }
  if (operator === "gt") {
    if (value === null) return false;
    return Date.parse(value) > Date.parse(operand);
  }
  return true;
}

/** The rows the recorded filters allow, the way PostgREST would answer. */
function applyFilters(rows, filters) {
  return rows.filter((row) =>
    filters.every(([kind, column, value]) => {
      if (kind === "eq") return String(row[column]) === String(value);
      if (kind === "or") return value.split(",").some((part) => matchPart(row, part.trim()));
      return true;
    })
  );
}

/**
 * A chainable Supabase double.
 *
 * Every filter the router sends is recorded and applied, so the visibility
 * rule is exercised rather than merely recorded.
 */
function makeDb(rows = []) {
  const calls = { tables: [], filters: [] };

  mockFrom.mockReset();
  mockFrom.mockImplementation((table) => {
    calls.tables.push(table);
    const filters = [];

    const query = {
      select() {
        return query;
      },
      eq(column, value) {
        filters.push(["eq", column, value]);
        return query;
      },
      or(filter) {
        filters.push(["or", null, filter]);
        return query;
      },
      order() {
        return query;
      },
      then(onFulfilled, onRejected) {
        calls.filters = filters;
        return Promise.resolve({ data: applyFilters(rows, filters), error: null }).then(
          onFulfilled,
          onRejected
        );
      },
    };

    return query;
  });

  return calls;
}

const published = {
  id: "page-1",
  slug: "diwali-sale",
  title: "Diwali Sale",
  status: "published",
  scheduled_at: null,
  expired_at: null,
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-02T00:00:00.000Z",
};

const draft = {
  id: "page-2",
  slug: "secret-draft",
  title: "Secret Draft",
  status: "draft",
  scheduled_at: null,
  expired_at: null,
  created_at: "2026-10-03T00:00:00.000Z",
  updated_at: "2026-10-03T00:00:00.000Z",
};

describe("the sitemap and the robots file", () => {
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

  it("GET /api/sitemap.xml lists only published pages", async () => {
    makeDb([published, draft]);

    const res = await fetch(`${base}/api/sitemap.xml`);
    const xml = await res.text();

    expect(res.status).toBe(200);
    expect(xml).toContain("/pages/diwali-sale");
    expect(xml).not.toContain("secret-draft");
  });

  it("GET /api/sitemap.xml answers a well-formed document", async () => {
    makeDb([published]);

    const res = await fetch(`${base}/api/sitemap.xml`);
    const xml = await res.text();

    expect(xml.startsWith("<?xml")).toBe(true);
    expect(xml).toContain("</urlset>");
    expect(res.headers.get("content-type")).toContain("application/xml");
    expect(res.headers.get("cache-control")).toContain("max-age=300");
  });

  it("GET /api/robots.txt points at the sitemap", async () => {
    const res = await fetch(`${base}/api/robots.txt`);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain("Sitemap:");
    expect(body).toContain("Disallow: /admin");
  });
});
