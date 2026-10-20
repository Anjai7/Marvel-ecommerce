// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The seeds run against a mocked `server/db.js`. That is the only way to prove
 * their contract here: this environment has no linked Supabase project and no
 * database password, so nothing may be applied. The mock records every upsert
 * payload and counts any delete call, which is exactly what "idempotent and
 * non-destructive" means in a testable form.
 */
const { db, mockFrom } = vi.hoisted(() => {
  const state = {
    menuRows: [],
    categoryRows: [],
    vendor: null,
    upserts: [],
    deletes: 0,
    selects: [],
  };
  return { db: state, mockFrom: vi.fn() };
});

vi.mock("./db.js", () => ({ supabase: { from: mockFrom } }));

import {
  buildBannerSeeds,
  buildCategorySeeds,
  buildFooterSeeds,
  resolveProductCategory,
  seedContent,
  seedId,
} from "./seed_content.js";
import {
  buildProductSeeds,
  cloudinaryConfigured,
  productSeedId,
  seedProducts,
  withCropSeed,
} from "./seed_dynamic_products.js";

const D1_ELECTRONICS = "d1c00000-0000-4000-8000-000000000001";
const D1_FASHION = "d1c00000-0000-4000-8000-000000000002";
const D2_MOBILES = "d2c00000-0000-4000-8000-000000000001";
const D2_MENS_FASHION = "d2c00000-0000-4000-8000-000000000007";
const D3_SMARTPHONES = "d3c00000-0000-4000-8000-000000000001";

const MENU_ROWS = [
  {
    id: D1_ELECTRONICS,
    title: "Electronics",
    path: "/category/electronics",
    parent_id: null,
    level: 1,
    order_index: 10,
    is_active: true,
  },
  {
    id: D1_FASHION,
    title: "Fashion",
    path: "/category/fashion",
    parent_id: null,
    level: 1,
    order_index: 11,
    is_active: true,
  },
  {
    id: D2_MOBILES,
    title: "Mobiles",
    path: "/category/electronics/mobiles",
    parent_id: D1_ELECTRONICS,
    level: 2,
    order_index: 1,
    is_active: true,
  },
  {
    id: D2_MENS_FASHION,
    title: "Men's Fashion",
    path: "/category/fashion/men-s-fashion",
    parent_id: D1_FASHION,
    level: 2,
    order_index: 1,
    is_active: true,
  },
  {
    id: D3_SMARTPHONES,
    title: "Smartphones",
    path: "/category/electronics/mobiles/smartphones",
    parent_id: D2_MOBILES,
    level: 3,
    order_index: 1,
    is_active: true,
  },
  // The six legacy flat navigation rows look like level-1 rows but are not
  // taxonomy. `Home & Shop` even has `/` as its path.
  {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Home & Shop",
    path: "/",
    parent_id: null,
    level: 1,
    order_index: 1,
    is_active: true,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Electronics & Tech",
    path: "/category/electronics",
    parent_id: null,
    level: 1,
    order_index: 2,
    is_active: true,
  },
];

const CATEGORY_ROWS = [
  {
    id: "c1000000-0000-4000-8000-000000000001",
    name: "Accessories",
    level: 1,
    display_order: 40,
    image_url: "https://images.unsplash.com/photo-accessories?w=600&h=600&fit=crop",
  },
  {
    id: "c1000000-0000-4000-8000-000000000002",
    name: "Audio",
    level: 2,
    display_order: 3,
    image_url: null,
  },
  {
    id: "c1000000-0000-4000-8000-000000000003",
    name: "Accessories",
    level: 2,
    display_order: 5,
    image_url: null,
  },
  {
    id: "c1000000-0000-4000-8000-000000000004",
    name: "Accessories",
    level: 2,
    display_order: 5,
    image_url: null,
  },
  {
    id: "c1000000-0000-4000-8000-000000000005",
    name: "Watches",
    level: 2,
    display_order: 1,
    image_url: null,
  },
  {
    id: "c1000000-0000-4000-8000-000000000006",
    name: "Watches",
    level: 3,
    display_order: 2,
    image_url: null,
  },
];

const CATEGORY_TREE_ROWS = [
  {
    id: "e1000000-0000-4000-8000-000000000001",
    name: "Electronics",
    parent_id: null,
    level: 1,
    display_order: 10,
    image_url: "https://images.unsplash.com/photo-electronics?w=600&h=600&fit=crop",
    is_active: true,
  },
  {
    id: "e1000000-0000-4000-8000-000000000002",
    name: "Fashion",
    parent_id: null,
    level: 1,
    display_order: 11,
    image_url: null,
    is_active: true,
  },
  {
    id: "e1000000-0000-4000-8000-000000000003",
    name: "Mobiles",
    parent_id: "e1000000-0000-4000-8000-000000000001",
    level: 2,
    display_order: 1,
    image_url: null,
    is_active: true,
  },
  {
    id: "e1000000-0000-4000-8000-000000000004",
    name: "Men's Fashion",
    parent_id: "e1000000-0000-4000-8000-000000000002",
    level: 2,
    display_order: 1,
    image_url: null,
    is_active: true,
  },
  {
    id: "e1000000-0000-4000-8000-000000000005",
    name: "Smartphones",
    parent_id: "e1000000-0000-4000-8000-000000000003",
    level: 3,
    display_order: 1,
    image_url: null,
    is_active: true,
  },
  {
    id: "e1000000-0000-4000-8000-000000000006",
    name: "Shirts",
    parent_id: "e1000000-0000-4000-8000-000000000004",
    level: 3,
    display_order: 2,
    image_url: null,
    is_active: true,
  },
];

function rowsForTable(table) {
  if (table === "menu_items") return db.menuRows;
  if (table === "categories") return db.categoryRows;
  return [];
}

function settle(table, operation, rows) {
  if (operation === "upsert") return { data: null, error: null };
  if (operation === "delete") return { data: null, error: null, count: 1 };
  if (table === "profiles") return { data: db.vendor, error: null };
  return { data: rows, error: null };
}

beforeEach(() => {
  db.menuRows = [];
  db.categoryRows = [];
  db.vendor = null;
  db.upserts = [];
  db.deletes = 0;
  db.selects = [];

  mockFrom.mockReset();
  mockFrom.mockImplementation((table) => {
    const state = { operation: null, filters: [] };
    // Apply `.eq()` the way PostgREST does, so a missing filter is visible.
    const matchedRows = () =>
      rowsForTable(table).filter((row) =>
        state.filters.every(([column, value]) => row[column] === value)
      );
    const query = {
      select() {
        if (state.operation === null) state.operation = "select";
        db.selects.push(table);
        return query;
      },
      eq(column, value) {
        state.filters.push([column, value]);
        return query;
      },
      order: () => query,
      limit: () => query,
      in: () => query,
      upsert(rows, options) {
        state.operation = "upsert";
        db.upserts.push({ table, rows, options });
        return query;
      },
      delete() {
        state.operation = "delete";
        db.deletes += 1;
        return query;
      },
      maybeSingle: () => Promise.resolve(settle(table, state.operation ?? "select", matchedRows())),
      single: () => Promise.resolve(settle(table, state.operation ?? "select", matchedRows())),
      then(onFulfilled, onRejected) {
        return Promise.resolve(settle(table, state.operation ?? "select", matchedRows())).then(
          onFulfilled,
          onRejected
        );
      },
    };
    return query;
  });
});

describe("buildCategorySeeds", () => {
  it("maps the 3-level mega-menu tree and ignores the legacy flat rows", () => {
    const seeds = buildCategorySeeds(MENU_ROWS);

    expect(seeds).toHaveLength(5);
    expect(seeds.map((row) => row.name)).toEqual([
      "Electronics",
      "Fashion",
      "Mobiles",
      "Men's Fashion",
      "Smartphones",
    ]);

    const byId = new Map(seeds.map((row) => [row.id, row]));

    expect(byId.get(D1_ELECTRONICS)).toMatchObject({
      slug: "electronics",
      parent_id: null,
      level: 1,
      display_order: 10,
      is_active: true,
      show_in_nav: true,
    });
    expect(byId.get(D2_MOBILES)).toMatchObject({
      slug: "mobiles",
      parent_id: D1_ELECTRONICS,
      level: 2,
    });
    expect(byId.get(D2_MENS_FASHION)).toMatchObject({
      slug: "men-s-fashion",
      parent_id: D1_FASHION,
      level: 2,
    });
    expect(byId.get(D3_SMARTPHONES)).toMatchObject({
      slug: "smartphones",
      parent_id: D2_MOBILES,
      level: 3,
    });

    // The six legacy rows never enter the taxonomy.
    expect(seeds.map((row) => row.slug)).not.toContain("");
    expect(seeds.map((row) => row.name)).not.toContain("Home & Shop");
    expect(seeds.map((row) => row.name)).not.toContain("Electronics & Tech");
  });

  it("writes exactly the columns the migration owns and leaves homepage visibility alone", () => {
    const [first] = buildCategorySeeds(MENU_ROWS);

    expect(Object.keys(first).sort()).toEqual([
      "display_order",
      "id",
      "is_active",
      "level",
      "name",
      "parent_id",
      "show_in_nav",
      "slug",
    ]);
    expect(first).not.toHaveProperty("show_in_homepage");
    expect(first).not.toHaveProperty("image_url");
  });

  it("returns level-1 rows before their children", () => {
    const levels = buildCategorySeeds([...MENU_ROWS].reverse()).map((row) => row.level);
    expect(levels).toEqual([...levels].sort((left, right) => left - right));
  });
});

describe("buildBannerSeeds", () => {
  it("returns the nine banners with the exact placements, variants and titles", () => {
    const banners = buildBannerSeeds();

    expect(banners).toHaveLength(9);
    expect(banners.map((banner) => banner.title)).toEqual([
      "Make Your Home Beautiful",
      "Style That Speaks",
      "Beauty for You",
      "End of Season Sale",
      "Electronics Mega Sale",
      "Style Redefined",
      "Big Savings Days",
      "Extra 10% Off",
      "No Cost EMI",
    ]);

    const layout = banners.filter((banner) => banner.placement === "home_banner_layout");
    expect(layout.map((banner) => banner.variant)).toEqual(["large", "small", "small"]);
    expect(banners.filter((banner) => banner.placement === "home_promo_carousel")).toHaveLength(3);
    expect(banners.filter((banner) => banner.placement === "promo_strip")).toHaveLength(3);

    expect(banners.map((banner) => banner.id)).toEqual([
      seedId("b1", 1),
      seedId("b1", 2),
      seedId("b1", 3),
      seedId("b1", 4),
      seedId("b1", 5),
      seedId("b1", 6),
      seedId("b1", 7),
      seedId("b1", 8),
      seedId("b1", 9),
    ]);
  });

  it("maps the src/data.js fields onto the promo_banners columns", () => {
    const banners = buildBannerSeeds();
    const carousel = banners.find((banner) => banner.title === "End of Season Sale");
    const strip = banners.find((banner) => banner.title === "Extra 10% Off");
    const layout = banners.find((banner) => banner.title === "Make Your Home Beautiful");

    expect(carousel.badge).toBe("🔥 Limited Time Offer");
    expect(carousel.highlight).toBe("Up to 70% Off");
    expect(carousel.description).toContain("Grab the best deals");
    expect(carousel.cta_text).toBe("Shop Now");
    expect(carousel.gallery).toHaveLength(3);

    expect(strip.subtitle).toBe("On Prepaid Orders");
    expect(strip.bg_color).toBe("#f0fdf4");
    expect(strip.accent).toBe("#16a34a");
    expect(strip.emoji).toBe("💳");
    expect(strip.code).toBe("PREPAID10");

    expect(layout.image_url).toContain("images.unsplash.com");
    expect(layout.cta_path).toBe("/category/home-and-kitchen");
  });

  it("gives every banner row one identical key set for the bulk upsert", () => {
    const banners = buildBannerSeeds();
    const keySets = new Set(banners.map((banner) => Object.keys(banner).sort().join(",")));

    expect(keySets.size).toBe(1);
    // PostgREST rejects mixed keys; the unused nullable columns must be null
    // and `gallery` must stay an array because the column is NOT NULL.
    expect(banners.every((banner) => Array.isArray(banner.gallery))).toBe(true);
    expect(banners.every((banner) => "subtitle" in banner && "badge" in banner)).toBe(true);

    const strip = banners.find((banner) => banner.placement === "promo_strip");
    expect(strip.image_url).toBeNull();
    expect(strip.gallery).toEqual([]);
    const carousel = banners.find((banner) => banner.placement === "home_promo_carousel");
    expect(carousel.cta_path).toBeNull();
  });
});

const UUID_LITERAL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** No network in tests: every image falls back to its Unsplash URL. */
const offlineUpload = async () => null;

describe("buildFooterSeeds", () => {
  it("returns five sections with 6/6/6/6/10 links", () => {
    const sections = buildFooterSeeds();

    expect(sections.map((section) => section.heading)).toEqual([
      "Customer Support",
      "Policy & Legal",
      "My Account",
      "Popular Categories",
      "Popular Searches",
    ]);
    expect(sections.map((section) => section.links.length)).toEqual([6, 6, 6, 6, 10]);
    expect(sections.flatMap((section) => section.links)).toHaveLength(34);

    expect(sections[0].links[0]).toMatchObject({ label: "Help Center", href: "#/" });
    expect(sections[4].section_type).toBe("tags");
    expect(sections[4].links[0]).toMatchObject({
      label: "iPhone 15",
      href: "#/products?q=iphone-15",
    });
  });

  it("uses hash routes only, so no footer link is a bare path that 404s", () => {
    const links = buildFooterSeeds().flatMap((section) => section.links);

    expect(links.every((link) => link.href.startsWith("#/"))).toBe(true);
    expect(links.filter((link) => !link.href.startsWith("#/"))).toEqual([]);

    const categoryLinks = links.filter((link) => link.href.startsWith("#/category/"));
    expect(categoryLinks.map((link) => link.href)).toEqual([
      "#/category/electronics/mobiles",
      "#/category/electronics/computers",
      "#/category/accessories/watches/smartwatches",
      "#/category/electronics/audio",
      "#/category/fashion",
      "#/category/home-and-kitchen",
    ]);

    expect(links.filter((link) => link.href === "#/account")).toHaveLength(6);
  });

  it("uses the deterministic section and link ids", () => {
    const sections = buildFooterSeeds();
    const links = sections.flatMap((section) => section.links);

    expect(sections.map((section) => section.id)).toEqual([
      seedId("f1", 1),
      seedId("f1", 2),
      seedId("f1", 3),
      seedId("f1", 4),
      seedId("f1", 5),
    ]);
    expect(links[0].id).toBe(seedId("f2", 1));
    expect(links[33].id).toBe(seedId("f2", 34));
  });
});

describe("resolveProductCategory", () => {
  it("returns exactly one id for an ambiguous name: the lowest level", () => {
    expect(resolveProductCategory("Accessories", CATEGORY_ROWS)).toBe(
      "c1000000-0000-4000-8000-000000000001"
    );
    expect(resolveProductCategory("accessories", CATEGORY_ROWS)).toBe(
      "c1000000-0000-4000-8000-000000000001"
    );
    expect(resolveProductCategory("Audio", CATEGORY_ROWS)).toBe(
      "c1000000-0000-4000-8000-000000000002"
    );
    expect(resolveProductCategory("Watches", CATEGORY_ROWS)).toBe(
      "c1000000-0000-4000-8000-000000000005"
    );
  });

  it("falls back to display_order and then id, and never returns two ids", () => {
    const twins = CATEGORY_ROWS.filter(
      (category) => category.level === 2 && category.name === "Accessories"
    );
    expect(twins).toHaveLength(2);
    expect(resolveProductCategory("Accessories", twins)).toBe(twins[0].id);

    const result = resolveProductCategory("Accessories", CATEGORY_ROWS);
    expect(typeof result).toBe("string");
    expect(new Set([result]).size).toBe(1);
  });

  it("returns null when nothing matches", () => {
    expect(resolveProductCategory("TVs", CATEGORY_ROWS)).toBeNull();
    expect(resolveProductCategory("", CATEGORY_ROWS)).toBeNull();
    expect(resolveProductCategory(null, CATEGORY_ROWS)).toBeNull();
  });
});

describe("seedContent", () => {
  it("upserts every family with deterministic ids, level by level, and never deletes", async () => {
    db.menuRows = MENU_ROWS;

    const counts = await seedContent();

    expect(db.deletes).toBe(0);
    expect(db.upserts.every((call) => call.options?.onConflict === "id")).toBe(true);

    const categoryCalls = db.upserts.filter((call) => call.table === "categories");
    expect(categoryCalls.map((call) => call.rows.map((row) => row.level))).toEqual([
      [1, 1],
      [2, 2],
      [3],
    ]);

    const bannerCall = db.upserts.find((call) => call.table === "promo_banners");
    expect(bannerCall.rows).toHaveLength(9);
    expect(bannerCall.rows.map((row) => row.id)).toContain(seedId("b1", 9));

    const sectionCall = db.upserts.find((call) => call.table === "footer_sections");
    const linkCall = db.upserts.find((call) => call.table === "footer_links");
    expect(sectionCall.rows).toHaveLength(5);
    expect(linkCall.rows).toHaveLength(34);
    expect(sectionCall.rows).not.toContainEqual(
      expect.objectContaining({ links: expect.anything() })
    );

    expect(counts).toEqual({ categories: 5, banners: 9, sections: 5, links: 34 });
  });

  it("is idempotent: a second call produces the same upsert payload", async () => {
    db.menuRows = MENU_ROWS;

    const firstCounts = await seedContent();
    const firstPayload = db.upserts.map((call) => ({
      table: call.table,
      rows: call.rows,
      options: call.options,
    }));

    db.upserts = [];
    const secondCounts = await seedContent();
    const secondPayload = db.upserts.map((call) => ({
      table: call.table,
      rows: call.rows,
      options: call.options,
    }));

    expect(secondPayload).toEqual(firstPayload);
    expect(secondCounts).toEqual(firstCounts);
    expect(db.deletes).toBe(0);
  });

  it("writes no synthetic row ids: every id is either a menu id or a seeded literal", async () => {
    db.menuRows = MENU_ROWS;
    await seedContent();

    const menuIds = new Set(MENU_ROWS.map((row) => row.id));
    const categoryIds = db.upserts
      .filter((call) => call.table === "categories")
      .flatMap((call) => call.rows.map((row) => row.id));

    expect(categoryIds.every((id) => menuIds.has(id))).toBe(true);

    const generated = db.upserts
      .filter((call) => call.table !== "categories")
      .flatMap((call) => call.rows.map((row) => row.id));
    expect(generated.every((id) => UUID_LITERAL.test(id))).toBe(true);
    expect(new Set(generated).size).toBe(generated.length);
  });

  it("sends one identical key set per upsert call, as PostgREST requires", async () => {
    db.menuRows = MENU_ROWS;
    await seedContent();

    expect(db.upserts.length).toBeGreaterThan(0);
    for (const call of db.upserts) {
      const keySets = new Set(call.rows.map((row) => Object.keys(row).sort().join(",")));
      expect(keySets.size, `${call.table} rows carry ${keySets.size} different key sets`).toBe(1);
    }
  });
});

describe("buildProductSeeds", () => {
  it("generates 3 products per level-1 category and 1 per level-2 and level-3", () => {
    const seeds = buildProductSeeds(CATEGORY_TREE_ROWS);

    expect(seeds).toHaveLength(3 * 2 + 2 + 2);

    for (const category of CATEGORY_TREE_ROWS.filter((row) => row.level === 1)) {
      expect(seeds.filter((seed) => seed.category_id === category.id)).toHaveLength(3);
    }
    for (const category of CATEGORY_TREE_ROWS.filter((row) => row.level === 2)) {
      expect(seeds.filter((seed) => seed.category_id === category.id)).toHaveLength(1);
    }
    for (const category of CATEGORY_TREE_ROWS.filter((row) => row.level === 3)) {
      expect(seeds.filter((seed) => seed.category_id === category.id)).toHaveLength(1);
    }
  });

  it("binds each product to one category and carries the display label", () => {
    const seeds = buildProductSeeds(CATEGORY_TREE_ROWS);
    const byId = new Map(CATEGORY_TREE_ROWS.map((row) => [row.id, row]));

    for (const seed of seeds) {
      const category = byId.get(seed.category_id);
      expect(category).toBeDefined();
      expect(seed.category).toBe(category.name);
    }
    expect(seeds.map((seed) => seed.id)).toEqual(seeds.map((_, index) => productSeedId(index + 1)));
    expect(new Set(seeds.map((seed) => seed.id)).size).toBe(seeds.length);
    expect(seeds.every((seed) => seed.price > 0)).toBe(true);
  });

  it("puts the parent path in the title so duplicate category names stay distinct", () => {
    const seeds = buildProductSeeds(CATEGORY_TREE_ROWS);

    // A leaf keeps its ancestors in the title...
    expect(seeds.find((seed) => seed.category === "Smartphones").title).toBe(
      "Electronics / Mobiles / Smartphones Lite"
    );
    expect(seeds.find((seed) => seed.category === "Shirts").title).toBe(
      "Fashion / Men's Fashion / Shirts Max"
    );

    // ...and two categories with the same name never produce the same title.
    const twins = [
      ...CATEGORY_TREE_ROWS.filter((row) => row.level === 1),
      {
        id: "e1000000-0000-4000-8000-00000000000a",
        name: "Accessories",
        parent_id: "e1000000-0000-4000-8000-000000000001",
        level: 2,
        display_order: 2,
        image_url: null,
        is_active: true,
      },
      {
        id: "e1000000-0000-4000-8000-00000000000b",
        name: "Accessories",
        parent_id: "e1000000-0000-4000-8000-000000000002",
        level: 2,
        display_order: 2,
        image_url: null,
        is_active: true,
      },
    ];
    const twinSeeds = buildProductSeeds(twins);
    expect(twinSeeds.map((seed) => seed.title)).toContain("Electronics / Accessories Essentials");
    expect(twinSeeds.map((seed) => seed.title)).toContain("Fashion / Accessories Essentials");
    expect(new Set(twinSeeds.map((seed) => seed.title)).size).toBe(twinSeeds.length);
  });

  it("crops each image with a distinct seed and falls back when a category has none", () => {
    const seeds = buildProductSeeds(CATEGORY_TREE_ROWS);

    expect(seeds[0].image_url).toContain("photo-electronics");
    expect(seeds[0].image_url).toContain("&sig=1");
    expect(withCropSeed(null, 4)).toBe(
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop&sig=4"
    );
    expect(new Set(seeds.map((seed) => seed.image_url)).size).toBeGreaterThan(1);
  });
});

describe("seedProducts", () => {
  it("upserts without deleting and stores plain image URLs with access_type public", async () => {
    db.categoryRows = CATEGORY_TREE_ROWS;

    const counts = await seedProducts({ uploadImage: offlineUpload, log: () => {} });

    expect(db.deletes).toBe(0);
    expect(counts).toEqual({ products: 10, categories: 6, uploaded: 0 });

    const productCall = db.upserts.find((call) => call.table === "products");
    expect(productCall.options).toEqual({ onConflict: "id" });
    expect(productCall.rows).toHaveLength(10);
    expect(productCall.rows.every((row) => row.category_id)).toBe(true);
    expect(productCall.rows.every((row) => row.access_type === "public")).toBe(true);
    expect(productCall.rows.every((row) => row.cloudinary_public_id === null)).toBe(true);
    expect(productCall.rows.every((row) => row.status === "active")).toBe(true);
    const productKeys = new Set(productCall.rows.map((row) => Object.keys(row).sort().join(",")));
    expect(productKeys.size).toBe(1);
  });

  it("counts only the uploads that actually succeeded", async () => {
    db.categoryRows = CATEGORY_TREE_ROWS;

    let calls = 0;
    const flakyUpload = async () => {
      calls += 1;
      return calls % 2 === 0
        ? {
            image_url: `https://res.cloudinary.com/demo/image/upload/${calls}.jpg`,
            cloudinary_public_id: `marvel_products/${calls}`,
            access_type: "upload",
          }
        : null;
    };

    const counts = await seedProducts({ uploadImage: flakyUpload, log: () => {} });
    const rows = db.upserts.find((call) => call.table === "products").rows;

    expect(counts.uploaded).toBe(5);
    expect(rows.filter((row) => row.cloudinary_public_id !== null)).toHaveLength(5);
    expect(rows.filter((row) => row.cloudinary_public_id === null)).toHaveLength(5);
    expect(rows.every((row) => UUID_LITERAL.test(row.id))).toBe(true);
  });

  it("prints a running progress count while preparing the catalog", async () => {
    db.categoryRows = CATEGORY_TREE_ROWS;
    const lines = [];

    await seedProducts({ uploadImage: offlineUpload, log: (line) => lines.push(line) });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("10/10 products prepared");
  });

  it("skips hidden categories, matching the storefront's active-only reads", async () => {
    db.categoryRows = CATEGORY_TREE_ROWS.map((row) => ({
      ...row,
      is_active: row.name !== "Shirts",
    }));

    const counts = await seedProducts({ uploadImage: offlineUpload, log: () => {} });
    const rows = db.upserts.find((call) => call.table === "products").rows;

    expect(counts.categories).toBe(5);
    expect(rows.some((row) => row.category === "Shirts")).toBe(false);
    expect(rows.some((row) => row.category_id === "e1000000-0000-4000-8000-000000000006")).toBe(
      false
    );
  });

  it("is idempotent and never writes an order", async () => {
    db.categoryRows = CATEGORY_TREE_ROWS;

    await seedProducts({ uploadImage: offlineUpload, log: () => {} });
    const firstPayload = db.upserts.map((call) => ({ table: call.table, rows: call.rows }));

    db.upserts = [];
    await seedProducts({ uploadImage: offlineUpload, log: () => {} });
    const secondPayload = db.upserts.map((call) => ({ table: call.table, rows: call.rows }));

    expect(secondPayload).toEqual(firstPayload);
    expect(db.selects).not.toContain("orders");
    expect(db.deletes).toBe(0);
  });

  it("refuses to run before the taxonomy exists", async () => {
    db.categoryRows = [];
    await expect(seedProducts({ uploadImage: offlineUpload, log: () => {} })).rejects.toThrow(
      /apply-01-content-taxonomy\.sql/
    );
    expect(db.upserts).toEqual([]);
  });

  it("requires a complete Cloudinary configuration so no public id is invented", () => {
    expect(cloudinaryConfigured({})).toBe(false);
    expect(cloudinaryConfigured({ CLOUDINARY_CLOUD_NAME: "cloud" })).toBe(false);
    expect(
      cloudinaryConfigured({ CLOUDINARY_CLOUD_NAME: "cloud", CLOUDINARY_API_KEY: "key" })
    ).toBe(false);
    expect(
      cloudinaryConfigured({
        CLOUDINARY_CLOUD_NAME: "cloud",
        CLOUDINARY_API_KEY: "key",
        CLOUDINARY_API_SECRET: "secret",
      })
    ).toBe(true);
  });

  it("emits only valid UUID literals from both seeds, so uuid_in accepts every id", async () => {
    db.menuRows = MENU_ROWS;
    db.categoryRows = CATEGORY_TREE_ROWS;

    await seedContent();
    await seedProducts({ uploadImage: offlineUpload, log: () => {} });

    const ids = db.upserts.flatMap((call) => call.rows.map((row) => row.id));

    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((id) => !UUID_LITERAL.test(id))).toEqual([]);

    // The exact regression: `p` is not a hex digit, `e` is.
    expect(productSeedId(1)).toBe("e1000000-0000-4000-8000-000000000001");
    expect(UUID_LITERAL.test(productSeedId(1))).toBe(true);
  });
});
