// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("../db.js", () => ({ supabase: { from: mockFrom } }));

import app from "../app.js";

/**
 * Chainable Supabase double. The detail route reads the product with
 * `maybeSingle()` and then awaits four filtered, ordered list queries, so the
 * handler answers per table.
 */
function makeDb(handlers = {}) {
  const calls = {
    tables: [],
    select: [],
    eq: [],
    order: [],
    maybeSingle: 0,
  };

  mockFrom.mockReset();
  mockFrom.mockImplementation((table) => {
    calls.tables.push(table);
    const state = { table, columns: null };

    const query = {
      select(columns) {
        state.columns = columns;
        calls.select.push({ table, columns });
        return query;
      },
      eq(column, value) {
        calls.eq.push([table, column, value]);
        return query;
      },
      order(column, options) {
        calls.order.push([table, column, options]);
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
        const result = handlers.select
          ? handlers.select(state, table, calls)
          : { data: [], error: null };
        return Promise.resolve(result).then(onFulfilled, onRejected);
      },
    };

    return query;
  });

  return calls;
}

const product = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Aurora Headphones",
  price: "2499.00",
  category: "Headphones",
  brand: "Marvel Audio",
  sku: "MRV-HEADP-ABC123",
  highlights: ["Hybrid active noise cancellation"],
  specifications: [{ category: "Audio", items: [{ label: "Driver", value: "40 mm" }] }],
  offer_ends_at: null,
};

const offers = [
  {
    id: "offer-emi-6",
    product_id: product.id,
    kind: "emi",
    title: "6-month No Cost EMI",
    bank: null,
    code: null,
    description: "Pay ₹416.5 per month for 6 months.",
    months: 6,
    amount: "416.50",
    interest: "No Cost",
    position: 1,
    is_active: true,
  },
  {
    id: "offer-bank",
    product_id: product.id,
    kind: "bank",
    title: "HDFC Bank Credit Card Offer",
    bank: "HDFC Bank",
    code: "HDFC10",
    description: "10% instant discount up to ₹1,500.",
    months: null,
    amount: null,
    interest: null,
    position: 4,
    is_active: true,
  },
];

// Newest first, as the reviews query asks the database for.
const reviews = [
  {
    id: "review-3",
    product_id: product.id,
    author_name: "Ananya Iyer",
    author_avatar: null,
    rating: 5,
    title: "Excellent purchase",
    body: "Works exactly as described.",
    is_verified: true,
    created_at: "2026-10-19T10:00:00.000Z",
  },
  {
    id: "review-2",
    product_id: product.id,
    author_name: "Rohan Mehta",
    author_avatar: null,
    rating: 4,
    title: "Good value",
    body: "Does what it promises.",
    is_verified: true,
    created_at: "2026-10-15T10:00:00.000Z",
  },
  {
    id: "review-1",
    product_id: product.id,
    author_name: "Priya Nair",
    author_avatar: null,
    rating: 5,
    title: "Great sound",
    body: "Very comfortable for long sessions.",
    is_verified: false,
    created_at: "2026-10-11T10:00:00.000Z",
  },
  {
    id: "review-0",
    product_id: product.id,
    author_name: "Karan Malhotra",
    author_avatar: null,
    rating: 3,
    title: "Decent, with caveats",
    body: "The finish could be better.",
    is_verified: true,
    created_at: "2026-10-07T10:00:00.000Z",
  },
];

const variants = [
  {
    id: "variant-color-0",
    product_id: product.id,
    kind: "color",
    label: "Midnight Black",
    value: "#111827",
    position: 0,
    is_active: true,
  },
  {
    id: "variant-size-0",
    product_id: product.id,
    kind: "size",
    label: "Standard",
    value: "Standard",
    position: 3,
    is_active: true,
  },
  {
    id: "variant-color-1",
    product_id: product.id,
    kind: "color",
    label: "Cloud White",
    value: "#f1f5f9",
    position: 1,
    is_active: true,
  },
];

const media = [
  {
    id: "media-hero",
    product_id: product.id,
    url: "https://images.example.com/hero.jpg",
    kind: "hero",
    position: 0,
    is_active: true,
  },
];

const listHandlers = (overrides = {}) => ({
  maybeSingle: () => ({ data: product, error: null }),
  select: (state, table) => {
    if (overrides[table]) return overrides[table];
    if (table === "product_offers") return { data: offers, error: null };
    if (table === "product_reviews") return { data: reviews, error: null };
    if (table === "product_variants") return { data: variants, error: null };
    if (table === "product_media") return { data: media, error: null };
    return { data: [], error: null };
  },
});

describe("product details API", () => {
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

  it("GET /api/products/:id/details returns the product, offers, stored reviews, variants and media", async () => {
    makeDb(listHandlers());

    const res = await get(`/api/products/${product.id}/details`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      product,
      offers: [
        {
          kind: "emi",
          title: "6-month No Cost EMI",
          bank: null,
          code: null,
          description: "Pay ₹416.5 per month for 6 months.",
          months: 6,
          amount: 416.5,
          interest: "No Cost",
        },
        {
          kind: "bank",
          title: "HDFC Bank Credit Card Offer",
          bank: "HDFC Bank",
          code: "HDFC10",
          description: "10% instant discount up to ₹1,500.",
          months: null,
          amount: null,
          interest: null,
        },
      ],
      reviews: {
        overall: 4.3,
        total: 4,
        breakdown: { 3: 1, 4: 1, 5: 2 },
        items: reviews.map((row) => ({
          id: row.id,
          author_name: row.author_name,
          author_avatar: null,
          rating: row.rating,
          title: row.title,
          body: row.body,
          is_verified: row.is_verified,
          created_at: row.created_at,
        })),
      },
      variants: {
        colors: [
          { id: "variant-color-0", label: "Midnight Black", value: "#111827" },
          { id: "variant-color-1", label: "Cloud White", value: "#f1f5f9" },
        ],
        sizes: [{ id: "variant-size-0", label: "Standard", value: "Standard" }],
      },
      media: [{ id: "media-hero", url: "https://images.example.com/hero.jpg", kind: "hero" }],
    });
  });

  it("aggregates the stored rows: average rounded to one decimal, count, breakdown and newest first", async () => {
    const calls = makeDb(listHandlers());

    const res = await get(`/api/products/${product.id}/details`);
    const body = await res.json();

    // (5 + 4 + 5 + 3) / 4 = 4.25 -> 4.3, not products.rating.
    expect(body.reviews.overall).toBe(4.3);
    expect(body.reviews.total).toBe(4);
    expect(body.reviews.breakdown).toEqual({ 3: 1, 4: 1, 5: 2 });
    expect(body.reviews.items.map((item) => item.id)).toEqual([
      "review-3",
      "review-2",
      "review-1",
      "review-0",
    ]);

    expect(calls.order).toContainEqual(["product_reviews", "created_at", { ascending: false }]);
    expect(calls.order).toContainEqual(["product_offers", "position", { ascending: true }]);
    expect(calls.order).toContainEqual(["product_variants", "position", { ascending: true }]);
    expect(calls.order).toContainEqual(["product_media", "position", { ascending: true }]);
    expect(calls.eq).toContainEqual(["product_offers", "is_active", true]);
    expect(calls.eq).toContainEqual(["product_variants", "is_active", true]);
    expect(calls.eq).toContainEqual(["product_media", "is_active", true]);
  });

  it("returns empty reviews (overall null) when the product has no stored rows", async () => {
    makeDb(listHandlers({ product_reviews: { data: [], error: null } }));

    const res = await get(`/api/products/${product.id}/details`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.reviews).toEqual({ overall: null, total: 0, breakdown: {}, items: [] });
    expect(body.offers).toHaveLength(2);
    expect(body.variants.colors).toHaveLength(2);
  });

  it("returns 404 { error: 'Product not found.' } for a missing product and reads no child table", async () => {
    const calls = makeDb({ maybeSingle: () => ({ data: null, error: null }) });

    const res = await get("/api/products/does-not-exist/details");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Product not found." });
    expect(calls.tables).toEqual(["products"]);
  });

  it("surfaces a product read error as 500", async () => {
    makeDb({ maybeSingle: () => ({ data: null, error: { message: "db boom" } }) });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await get(`/api/products/${product.id}/details`);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Could not load product details." });
  });

  it("surfaces a child table read error as 500", async () => {
    makeDb(listHandlers({ product_media: { data: null, error: { message: "media boom" } } }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await get(`/api/products/${product.id}/details`);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Could not load product details." });
  });
});
