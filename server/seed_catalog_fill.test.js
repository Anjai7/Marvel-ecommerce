// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The fill seeds run against a mocked `server/db.js`, like the other seeds.
 * The mock records every upsert payload and counts any delete call, which is
 * how "idempotent and non-destructive" becomes a testable claim.
 */
const { db, mockFrom } = vi.hoisted(() => {
  const state = {
    categoryRows: [],
    productRows: [],
    customerRows: [],
    upserts: [],
    deletes: 0,
  };
  return { db: state, mockFrom: vi.fn() };
});

vi.mock("./db.js", () => ({ supabase: { from: mockFrom } }));

import {
  buildCatalogFill,
  buildOrderSeeds,
  catalogFillId,
  fillCatalog,
  orderSeedId,
} from "./seed_catalog_fill.js";

const UUID_LITERAL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const CATEGORIES = [
  {
    id: "d1c00000-0000-4000-8000-000000000001",
    name: "Electronics",
    parent_id: null,
    level: 1,
    display_order: 1,
    image_url: "https://images.unsplash.com/photo-1?w=600",
  },
  {
    id: "d2c00000-0000-4000-8000-000000000001",
    name: "Mobiles",
    parent_id: "d1c00000-0000-4000-8000-000000000001",
    level: 2,
    display_order: 1,
    image_url: "https://images.unsplash.com/photo-2?w=600",
  },
  {
    id: "d3c00000-0000-4000-8000-000000000001",
    name: "Smartphones",
    parent_id: "d2c00000-0000-4000-8000-000000000001",
    level: 3,
    display_order: 1,
    image_url: "https://images.unsplash.com/photo-3?w=600",
  },
];

const PRODUCTS = [
  {
    id: "e1000000-0000-4000-8000-000000000001",
    title: "Electronics / Mobiles / Smartphones Classic",
    price: 1499.99,
    image_url: "https://res.cloudinary.com/x/image/upload/a.png",
    category_id: "d3c00000-0000-4000-8000-000000000001",
    vendor_id: "e25bcc00-38a9-4217-9c89-a1c6a8ee70ae",
  },
  {
    id: "e1000000-0000-4000-8000-000000000002",
    title: "Electronics / Mobiles / Smartphones Studio",
    price: 2499.5,
    image_url: "https://res.cloudinary.com/x/image/upload/b.png",
    category_id: "d3c00000-0000-4000-8000-000000000001",
    vendor_id: "e25bcc00-38a9-4217-9c89-a1c6a8ee70ae",
  },
];

const CUSTOMERS = [
  {
    id: "942f691f-2ac4-4b70-9fad-015fa1ef6e12",
    email: "user@marvel.com",
    full_name: "Alex Customer",
  },
  {
    id: "0a745b9c-d614-4502-91a6-89d23fd25d59",
    email: "new_customer@marvel.com",
    full_name: "Nina New",
  },
  { id: "06f147f6-4b50-4733-cb5-4a0331cd6780", email: "test@marvel.com", full_name: "Terry Test" },
];

function installDb() {
  mockFrom.mockReset();
  mockFrom.mockImplementation((table) => {
    const state = { op: null };

    const result = () => {
      if (state.op === "upsert") {
        db.upserts.push({ table, rows: state.rows });
        return { data: state.rows, error: null };
      }
      if (table === "categories") return { data: db.categoryRows, error: null };
      if (table === "products") return { data: db.productRows, error: null };
      if (table === "profiles") return { data: db.customerRows, error: null };
      return { data: [], error: null };
    };

    const chain = {
      select() {
        state.op = state.op || "select";
        return chain;
      },
      eq() {
        return chain;
      },
      order() {
        return chain;
      },
      limit() {
        return chain;
      },
      upsert(rows) {
        state.op = "upsert";
        state.rows = rows;
        return chain;
      },
      delete() {
        db.deletes += 1;
        return chain;
      },
      then(onFulfilled, onRejected) {
        return Promise.resolve(result()).then(onFulfilled, onRejected);
      },
    };
    return chain;
  });
}

beforeEach(() => {
  db.categoryRows = CATEGORIES;
  // Two products already sit in the leaf category, so it needs six fewer.
  db.productRows = PRODUCTS;
  db.customerRows = CUSTOMERS;
  db.upserts = [];
  db.deletes = 0;
  installDb();
});

describe("catalogFillId", () => {
  it("is a deterministic hex-only uuid that never collides with the e1 seed ids", () => {
    const a = catalogFillId("d3c00000-0000-4000-8000-000000000001", 1);
    const b = catalogFillId("d3c00000-0000-4000-8000-000000000001", 1);
    const c = catalogFillId("d3c00000-0000-4000-8000-000000000001", 2);

    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(UUID_LITERAL);
    expect(a.startsWith("e1")).toBe(false);
    expect(orderSeedId(1)).not.toBe(a);
  });
});

describe("buildCatalogFill", () => {
  it("tops every category up to the target with products", () => {
    const rows = buildCatalogFill(CATEGORIES, new Map(), { target: 8 });

    // Three categories, none of them had a product yet.
    expect(rows).toHaveLength(3 * 8);
    for (const category of CATEGORIES) {
      const mine = rows.filter((row) => row.category_id === category.id);
      expect(mine).toHaveLength(8);
      expect(new Set(mine.map((row) => row.id)).size).toBe(8);
    }
  });

  it("only adds the products a category is missing", () => {
    const existing = new Map([["d3c00000-0000-4000-8000-000000000001", 3]]);
    const rows = buildCatalogFill(CATEGORIES, existing, { target: 8 });

    const leaf = rows.filter((row) => row.category_id === "d3c00000-0000-4000-8000-000000000001");
    expect(leaf).toHaveLength(5);
  });

  it("gives every product a name, a price and an image", () => {
    const rows = buildCatalogFill(CATEGORIES, new Map(), { target: 3 });

    for (const row of rows) {
      expect(row.title).toMatch(/\S/);
      expect(row.price).toBeGreaterThan(0);
      expect(row.original_price).toBeGreaterThan(row.price);
      expect(row.image_url).toMatch(/^https?:\/\//);
      expect(row.status).toBe("active");
      expect(row.moderation_status).toBe("approved");
      expect(row.category).toMatch(/\S/);
      expect(row.stock).toBeGreaterThan(0);
    }
  });

  it("gives the products of one category distinct images", () => {
    const rows = buildCatalogFill(CATEGORIES, new Map(), { target: 8 });

    for (const category of CATEGORIES) {
      const mine = rows.filter((row) => row.category_id === category.id);
      const images = new Set(mine.map((row) => row.image_url));
      expect(images.size).toBe(mine.length);
    }
  });

  it("names a product with its full ancestor path", () => {
    const rows = buildCatalogFill(CATEGORIES, new Map(), { target: 1 });
    const leaf = rows.find((row) => row.category_id === "d3c00000-0000-4000-8000-000000000001");

    expect(leaf.title).toContain("Electronics / Mobiles / Smartphones");
  });
});

describe("buildOrderSeeds", () => {
  const anchor = new Date("2026-10-20T00:00:00.000Z");

  it("only uses statuses the order_status enum accepts", () => {
    const rows = buildOrderSeeds({
      products: PRODUCTS,
      customers: CUSTOMERS,
      count: 40,
      spanDays: 45,
      anchor,
    });

    const allowed = ["pending", "processing", "shipped", "delivered", "cancelled"];
    for (const row of rows) expect(allowed).toContain(row.status);
  });

  it("totals the line items into total_amount", () => {
    const rows = buildOrderSeeds({
      products: PRODUCTS,
      customers: CUSTOMERS,
      count: 20,
      spanDays: 45,
      anchor,
    });

    for (const row of rows) {
      const expected = row.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      expect(Number(row.total_amount)).toBeCloseTo(expected, 2);
      expect(row.items_count).toBe(row.items.length);
      expect(row.items.length).toBeGreaterThan(0);
    }
  });

  it("keeps every order inside the requested window", () => {
    const rows = buildOrderSeeds({
      products: PRODUCTS,
      customers: CUSTOMERS,
      count: 40,
      spanDays: 45,
      anchor,
    });

    for (const row of rows) {
      const at = new Date(row.created_at).getTime();
      expect(at).toBeLessThanOrEqual(anchor.getTime());
      expect(at).toBeGreaterThan(anchor.getTime() - 46 * 24 * 60 * 60 * 1000);
    }
  });

  it("gives some customers more than one order, so repeat buyers exist", () => {
    const rows = buildOrderSeeds({
      products: PRODUCTS,
      customers: CUSTOMERS,
      count: 30,
      spanDays: 45,
      anchor,
    });

    const perCustomer = new Map();
    for (const row of rows) {
      perCustomer.set(row.customer_email, (perCustomer.get(row.customer_email) ?? 0) + 1);
    }
    const repeats = [...perCustomer.values()].filter((count) => count > 1);
    expect(repeats.length).toBeGreaterThan(0);
  });

  it("is deterministic: the same inputs produce the same rows", () => {
    const args = { products: PRODUCTS, customers: CUSTOMERS, count: 15, spanDays: 45, anchor };
    expect(buildOrderSeeds(args)).toEqual(buildOrderSeeds(args));
  });
});

describe("fillCatalog", () => {
  it("never deletes or truncates anything", async () => {
    const counts = await fillCatalog({ log: () => {} });

    expect(counts.products).toBeGreaterThan(0);
    expect(counts.orders).toBeGreaterThan(0);
    expect(db.deletes).toBe(0);
    expect(db.upserts.map((call) => call.table)).toEqual(
      expect.arrayContaining(["products", "orders"])
    );
  });

  it("upserts the products and the orders it built", async () => {
    await fillCatalog({ log: () => {} });

    const productRows = db.upserts.find((call) => call.table === "products").rows;
    const orderRows = db.upserts.find((call) => call.table === "orders").rows;

    // 8 for each of the two empty categories, 6 for the one that has 2.
    expect(productRows.length).toBe(8 + 8 + 6);
    expect(orderRows.length).toBeGreaterThan(0);
    expect(new Set(productRows.map((row) => row.id)).size).toBe(productRows.length);
    expect(new Set(orderRows.map((row) => row.id)).size).toBe(orderRows.length);
  });
});
