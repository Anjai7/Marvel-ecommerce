// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("../db.js", () => ({ supabase: { from: mockFrom } }));

import app from "../app.js";

/**
 * Chainable Supabase double. The detail route reads the product with
 * `maybeSingle()` and then awaits five filtered, ordered list queries, so the
 * handler answers per table.
 */
function makeDb(handlers = {}) {
  const calls = {
    tables: [],
    select: [],
    eq: [],
    order: [],
    in: [],
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
      in(column, values) {
        calls.in.push([table, column, values]);
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

// The option values of the product, in the order the route returns them:
// the position order.
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
    id: "variant-color-1",
    product_id: product.id,
    kind: "color",
    label: "Cloud White",
    value: "#f1f5f9",
    position: 1,
    is_active: true,
  },
  {
    id: "variant-capacity-0",
    product_id: product.id,
    kind: "capacity",
    label: "256 GB",
    value: "256",
    position: 2,
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
];

// The sellable combinations of the product.
const combinations = [
  {
    id: "combination-0",
    product_id: product.id,
    sku: "MRV-HEADP-BLACK",
    price: "2499.00",
    stock: 12,
    image_url: null,
    options: [
      { kind: "color", label: "Midnight Black", value: "#111827" },
      { kind: "size", label: "Standard", value: "Standard" },
    ],
    position: 0,
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
    if (table === "product_variant_combinations") return { data: combinations, error: null };
    if (table === "product_option_values") return { data: [], error: null };
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
        options: [
          {
            id: "variant-color-0",
            kind: "color",
            label: "Midnight Black",
            value: "#111827",
            position: 0,
            option_value_id: null,
          },
          {
            id: "variant-color-1",
            kind: "color",
            label: "Cloud White",
            value: "#f1f5f9",
            position: 1,
            option_value_id: null,
          },
          {
            id: "variant-capacity-0",
            kind: "capacity",
            label: "256 GB",
            value: "256",
            position: 2,
            option_value_id: null,
          },
          {
            id: "variant-size-0",
            kind: "size",
            label: "Standard",
            value: "Standard",
            position: 3,
            option_value_id: null,
          },
        ],
        colors: [
          { id: "variant-color-0", label: "Midnight Black", value: "#111827" },
          { id: "variant-color-1", label: "Cloud White", value: "#f1f5f9" },
        ],
        sizes: [{ id: "variant-size-0", label: "Standard", value: "Standard" }],
      },
      combinations: [
        {
          id: "combination-0",
          sku: "MRV-HEADP-BLACK",
          price: 2499,
          stock: 12,
          image_url: null,
          options: [
            { kind: "color", label: "Midnight Black", value: "#111827" },
            { kind: "size", label: "Standard", value: "Standard" },
          ],
          position: 0,
        },
      ],
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

  // ─── Options and combinations ──────────────────────────────────────────

  it("returns every option value of the product, whatever its kind, ordered by position", async () => {
    const calls = makeDb(listHandlers());

    const res = await get(`/api/products/${product.id}/details`);
    const body = await res.json();

    expect(body.variants.options.map((option) => option.id)).toEqual([
      "variant-color-0",
      "variant-color-1",
      "variant-capacity-0",
      "variant-size-0",
    ]);
    expect(body.variants.options.map((option) => option.kind)).toEqual([
      "color",
      "color",
      "capacity",
      "size",
    ]);
    expect(body.variants.options.map((option) => option.position)).toEqual([0, 1, 2, 3]);

    // The colours and the sizes are still there, unchanged.
    expect(body.variants.colors).toHaveLength(2);
    expect(body.variants.sizes).toHaveLength(1);

    expect(calls.order).toContainEqual(["product_variants", "position", { ascending: true }]);
  });

  it("returns the sellable combinations of the product", async () => {
    makeDb(listHandlers());

    const res = await get(`/api/products/${product.id}/details`);
    const body = await res.json();

    expect(body.combinations).toEqual([
      {
        id: "combination-0",
        sku: "MRV-HEADP-BLACK",
        price: 2499,
        stock: 12,
        image_url: null,
        options: [
          { kind: "color", label: "Midnight Black", value: "#111827" },
          { kind: "size", label: "Standard", value: "Standard" },
        ],
        position: 0,
      },
    ]);
  });

  it("returns empty options and empty combinations for a product that has none", async () => {
    makeDb(
      listHandlers({
        product_variants: { data: [], error: null },
        product_variant_combinations: { data: [], error: null },
      })
    );

    const res = await get(`/api/products/${product.id}/details`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.variants.options).toEqual([]);
    expect(body.variants.colors).toEqual([]);
    expect(body.variants.sizes).toEqual([]);
    expect(body.combinations).toEqual([]);
  });

  it("takes the label and the value of the catalogue row an option value links to", async () => {
    makeDb(
      listHandlers({
        product_variants: {
          data: [
            {
              id: "variant-color-0",
              product_id: product.id,
              kind: "color",
              label: "Black",
              value: "#111827",
              option_value_id: "catalogue-black",
              position: 0,
              is_active: true,
            },
          ],
          error: null,
        },
        product_option_values: {
          data: [{ id: "catalogue-black", label: "Obsidian Black", value: "#0b0b0f" }],
          error: null,
        },
      })
    );

    const res = await get(`/api/products/${product.id}/details`);
    const body = await res.json();

    // The rename in the catalogue is the one the customer reads.
    expect(body.variants.options[0]).toEqual({
      id: "variant-color-0",
      kind: "color",
      label: "Obsidian Black",
      value: "#0b0b0f",
      position: 0,
      option_value_id: "catalogue-black",
    });
    expect(body.variants.colors[0]).toEqual({
      id: "variant-color-0",
      label: "Obsidian Black",
      value: "#0b0b0f",
    });
  });

  it("surfaces a catalogue read error as 500", async () => {
    makeDb(
      listHandlers({
        product_option_values: { data: null, error: { message: "catalogue boom" } },
        product_variants: {
          data: [
            {
              id: "variant-color-0",
              product_id: product.id,
              kind: "color",
              label: "Black",
              value: "#111827",
              option_value_id: "catalogue-black",
              position: 0,
              is_active: true,
            },
          ],
          error: null,
        },
      })
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await get(`/api/products/${product.id}/details`);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Could not load product details." });
  });
});
