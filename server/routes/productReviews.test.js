// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("../db.js", () => ({ supabase: { from: mockFrom } }));

import app from "../app.js";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

const VALID = {
  author_name: "  Asha Rao  ",
  rating: 5,
  title: "  Great fit  ",
  body: "  Comfortable on long runs.  ",
};

/**
 * Chainable Supabase double for the write route: `products` answers the
 * existence check with `maybeSingle()`, `product_reviews` records the insert and
 * answers `.select().single()` with the stored row.
 */
function makeDb({ product = { id: PRODUCT_ID }, productError = null, insertError = null } = {}) {
  const calls = { tables: [], productSelects: [], inserts: [] };

  mockFrom.mockReset();
  mockFrom.mockImplementation((table) => {
    calls.tables.push(table);

    if (table === "products") {
      const query = {
        select(columns) {
          calls.productSelects.push(columns);
          return query;
        },
        eq() {
          return query;
        },
        maybeSingle: () => Promise.resolve({ data: product, error: productError }),
      };
      return query;
    }

    if (table === "product_reviews") {
      return {
        insert(row) {
          calls.inserts.push(row);
          return {
            select() {
              return {
                single: () =>
                  Promise.resolve({
                    data: insertError
                      ? null
                      : {
                          id: "review-new",
                          created_at: "2026-11-21T10:00:00.000Z",
                          ...row,
                        },
                    error: insertError,
                  }),
              };
            },
          };
        },
      };
    }

    throw new Error(`Unexpected table read: ${table}`);
  });

  return calls;
}

describe("product reviews API", () => {
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

  const post = (productId, body) =>
    fetch(`${base}/api/products/${productId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  it("rejects a missing or blank name with 400 and writes nothing", async () => {
    for (const author_name of [undefined, "", "   "]) {
      const calls = makeDb();

      const res = await post(PRODUCT_ID, { ...VALID, author_name });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Name is required." });
      expect(calls.tables).toEqual([]);
      expect(calls.inserts).toHaveLength(0);
    }
  });

  it("rejects a rating that is not a whole number from 1 to 5", async () => {
    for (const rating of [undefined, null, 0, 6, 2.5, "five"]) {
      const calls = makeDb();

      const res = await post(PRODUCT_ID, { ...VALID, rating });

      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("Rating must be a whole number from 1 to 5.");
      expect(calls.inserts).toHaveLength(0);
    }
  });

  it("rejects a missing or blank review body with 400 and writes nothing", async () => {
    for (const body of [undefined, "", "   "]) {
      const calls = makeDb();

      const res = await post(PRODUCT_ID, { ...VALID, body });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Review text is required." });
      expect(calls.tables).toEqual([]);
      expect(calls.inserts).toHaveLength(0);
    }
  });

  it("returns 404 when the product does not exist", async () => {
    const calls = makeDb({ product: null });

    const res = await post(PRODUCT_ID, VALID);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Product not found." });
    expect(calls.productSelects).toEqual(["id"]);
    expect(calls.inserts).toHaveLength(0);
  });

  it("inserts an unverified review and returns the stored row in the details shape", async () => {
    const calls = makeDb();

    const res = await post(PRODUCT_ID, VALID);

    expect(res.status).toBe(201);
    expect(calls.inserts).toEqual([
      {
        product_id: PRODUCT_ID,
        author_name: "Asha Rao",
        rating: 5,
        title: "Great fit",
        body: "Comfortable on long runs.",
        is_verified: false,
      },
    ]);
    // `created_at` is left to the database default.
    expect(calls.inserts[0]).not.toHaveProperty("created_at");

    expect(await res.json()).toEqual({
      id: "review-new",
      author_name: "Asha Rao",
      author_avatar: null,
      rating: 5,
      title: "Great fit",
      body: "Comfortable on long runs.",
      is_verified: false,
      created_at: "2026-11-21T10:00:00.000Z",
    });
  });

  it("stores an omitted title as null", async () => {
    const calls = makeDb();

    const res = await post(PRODUCT_ID, { ...VALID, title: "   " });

    expect(res.status).toBe(201);
    expect(calls.inserts[0].title).toBeNull();
    expect((await res.json()).title).toBeNull();
  });

  it("surfaces a product read error as 500", async () => {
    const calls = makeDb({ productError: { message: "db boom" } });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await post(PRODUCT_ID, VALID);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Could not save review." });
    expect(calls.inserts).toHaveLength(0);
  });

  it("surfaces an insert error as 500", async () => {
    makeDb({ insertError: { message: "insert boom" } });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await post(PRODUCT_ID, VALID);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Could not save review." });
  });
});
