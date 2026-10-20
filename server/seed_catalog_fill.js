// ====================================================
// FILL THE CATALOGUE AND THE ORDER HISTORY
//
//   npm run seed:fill
//
// The taxonomy seed leaves every leaf category with a single product, so a
// category page shows a single card, and the orders table holds two rows, so
// the admin console's orders, pipeline and sales report are nearly empty.
// This seed fills both.
//
// Non-destructive by design:
//   * no delete / truncate / "clean the catalogue first" step;
//   * every product and every order has a deterministic id, so a re-run
//     updates the same rows instead of duplicating them.
//
// Products: every active category is topped up to TARGET_PER_CATEGORY. The
// filler rows reuse the category's own image with a distinct crop seed, the
// same trick the taxonomy seed uses, so no Cloudinary upload is needed and the
// run is instant.
//
// Orders: a spread of orders over the last SPAN_DAYS, across the statuses the
// `order_status` enum accepts, with line items drawn from the real catalogue
// so the best-seller and repeat-buyer reports have something to aggregate.
// ====================================================

import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { supabase } from "./db.js";
import { withCropSeed } from "./seed_dynamic_products.js";

/** How many products a category should end up with. */
export const TARGET_PER_CATEGORY = 8;

/** How many orders to create and over how many days. */
export const ORDER_COUNT = 72;
export const ORDER_SPAN_DAYS = 45;

/** The statuses the `order_status` enum accepts. */
const ORDER_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"];

/**
 * Variant names for the filler products. Deliberately disjoint from the
 * taxonomy seed's names (ROOT_VARIANTS and LEAF_VARIANTS): a filler must not
 * produce the same title as the product the base seed already put there.
 */
const FILL_VARIANTS = [
  "Prime",
  "Nova",
  "Core",
  "Edge",
  "Air",
  "Ultra",
  "Elite",
  "Pure",
  "Select",
  "Essential",
  "Advance",
  "Fusion",
  "Pulse",
  "Vivid",
  "Crest",
  "Nimbus",
];

/**
 * Unsplash photo ids for the filler products.
 *
 * The taxonomy gives every category ONE photo, so a category that lists eight
 * products would otherwise show the same photograph eight times. These ids
 * were each verified to resolve; the pool is walked with a stride that is
 * coprime with its length, so the products of one category never repeat a
 * photo.
 */
export const PRODUCT_IMAGE_POOL = [
  "photo-1505740420928-5e560c06d30e",
  "photo-1523275335684-37898b6baf30",
  "photo-1542291026-7eec264c27ff",
  "photo-1496181133206-80ce9b88a853",
  "photo-1555041469-a586c61ea9bc",
  "photo-1596462502278-27bfdc403348",
  "photo-1583394838336-acd977736f90",
  "photo-1441986300917-64674bd600d8",
  "photo-1511707171634-5f897ff02aa9",
  "photo-1526170375885-4d8ecf77b99f",
  "photo-1572635196237-14b3f281503f",
  "photo-1546868871-7041f2a55e12",
  "photo-1560343090-f0409e92791a",
  "photo-1600185365483-26d7a4cc7519",
  "photo-1556906781-9a412961c28c",
  "photo-1585386959984-a4155224a1ad",
  "photo-1594035910387-fea47794261f",
  "photo-1611930022073-b7a4ba5fcccd",
  "photo-1571781926291-c477ebfd024b",
  "photo-1512820790803-83ca734da794",
  "photo-1560472354-b33ff0c44a43",
  "photo-1533090161767-e6ffed986c88",
  "photo-1484154218962-a197022b5858",
  "photo-1571019613454-1cb2f99b2d8b",
  "photo-1576678927484-cc907957088c",
  "photo-1594787318286-3d835c1d207f",
  "photo-1571019614242-c5c5dee9f50b",
  "photo-1549298916-b41d501d3772",
  "photo-1560769629-975ec94e6a86",
  "photo-1620916566398-39f1143ab7be",
];

/** The Unsplash url for one pool entry. */
function poolUrl(photoId) {
  return `https://images.unsplash.com/${photoId}?w=600&h=600&fit=crop&q=80`;
}

const SHIPPING_LINES = [
  "742 Evergreen Terrace, Springfield, OR",
  "221B Baker Street, London, NW1 6XE",
  "1600 Amphitheatre Parkway, Mountain View, CA",
  "350 Fifth Avenue, New York, NY 10118",
  "1 Infinite Loop, Cupertino, CA 95014",
];

const CARRIERS = ["FedEx Express", "BlueDart", "DHL Worldwide", "ShipRocket", "Ecom Express"];

/** A deterministic 32-bit PRNG, so the same inputs always produce the same rows. */
function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 12 hex characters derived from a name — the tail of a uuid literal. */
function suffixFor(name) {
  return crypto.createHash("sha256").update(name).digest("hex").slice(0, 12);
}

/** The id prefix the filler owns; the taxonomy seed uses `e1`. */
const FILL_ID_PREFIX = "e2000000";

/**
 * A deterministic id for one filler product. The `e2` prefix keeps it apart
 * from the taxonomy seed's `e1` ids, so the two seeds never collide.
 */
export function catalogFillId(categoryId, variantIndex) {
  return `${FILL_ID_PREFIX}-0000-4000-8000-${suffixFor(`${categoryId}:${variantIndex}`)}`;
}

/** A deterministic id for one seeded order. */
export function orderSeedId(index) {
  return `f2000000-0000-4000-8000-${suffixFor(`order:${index}`)}`;
}

function toInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function compareCategories(left, right) {
  return (
    toInteger(left.level, 1) - toInteger(right.level, 1) ||
    toInteger(left.display_order, 0) - toInteger(right.display_order, 0) ||
    String(left.id).localeCompare(String(right.id))
  );
}

/** "Electronics / Mobiles / Smartphones" — the full ancestor path. */
function pathLabel(category, byId) {
  const names = [];
  const seen = new Set();
  let cursor = category;
  while (cursor && !seen.has(String(cursor.id))) {
    seen.add(String(cursor.id));
    names.unshift(cursor.name);
    cursor = cursor.parent_id ? byId.get(String(cursor.parent_id)) : null;
  }
  return names.join(" / ");
}

/**
 * The products every category still needs.
 *
 * `baseByCategory` counts the products the TAXONOMY seed owns (its `e1` ids).
 * The filler owns its own rows — the `e2` ids — so it always writes them,
 * even when a category is already full: that is what lets a re-run repair a
 * filler row instead of leaving a stale one behind. The two seeds together
 * reach `target` products per category.
 */
export function buildCatalogFill(categories = [], baseByCategory = new Map(), options = {}) {
  const target = toInteger(options.target, TARGET_PER_CATEGORY);
  const sorted = [...categories].sort(compareCategories);
  const byId = new Map(sorted.map((category) => [String(category.id), category]));
  const rows = [];

  for (const category of sorted) {
    const base = toInteger(baseByCategory.get(String(category.id)), 0);
    const missing = Math.max(0, target - base);
    if (missing === 0) continue;

    const label = pathLabel(category, byId);
    // A stable starting point per category, walked with a stride that is
    // coprime with the pool length: the products of one category never share
    // a photo.
    const poolStart =
      parseInt(suffixFor(`${category.id}:pool`).slice(0, 8), 16) % PRODUCT_IMAGE_POOL.length;
    for (let variant = 0; variant < missing; variant += 1) {
      const name = FILL_VARIANTS[variant % FILL_VARIANTS.length];
      const id = catalogFillId(category.id, variant);
      const priceHash = parseInt(suffixFor(`${category.id}:${variant}:price`).slice(0, 6), 16);
      const stockHash = parseInt(suffixFor(`${category.id}:${variant}:stock`).slice(0, 6), 16);
      const ratingHash = parseInt(suffixFor(`${category.id}:${variant}:rating`).slice(0, 4), 16);
      const reviewsHash = parseInt(suffixFor(`${category.id}:${variant}:reviews`).slice(0, 6), 16);
      const featuredHash = parseInt(
        suffixFor(`${category.id}:${variant}:featured`).slice(0, 4),
        16
      );
      const price = Number((499 + (priceHash % 3800000) / 100 + 0.99).toFixed(2));
      const photoId = PRODUCT_IMAGE_POOL[(poolStart + variant * 7) % PRODUCT_IMAGE_POOL.length];

      rows.push({
        id,
        title: `${label} ${name}`,
        description: `${name} edition from our ${label} range.`,
        price,
        original_price: Number((price * 1.2).toFixed(2)),
        category: category.name,
        category_id: category.id,
        stock: 8 + (stockHash % 40),
        rating: Number((4.2 + (ratingHash % 8) * 0.1).toFixed(1)),
        reviews_count: 120 + (reviewsHash % 900),
        is_featured: variant === 0 && featuredHash % 11 === 0,
        image_url: withCropSeed(poolUrl(photoId), suffixFor(`${category.id}:${variant}:image`)),
        cloudinary_public_id: null,
        access_type: "public",
        status: "active",
        moderation_status: "approved",
      });
    }
  }

  return rows;
}

/** A status that fits how long ago the order was placed. */
function statusForAge(ageDays, random) {
  if (ageDays <= 0) return "pending";
  if (ageDays <= 1) return random() < 0.6 ? "processing" : "pending";
  if (ageDays <= 3) return random() < 0.7 ? "shipped" : "processing";
  if (ageDays <= 6) return random() < 0.75 ? "delivered" : "shipped";
  return random() < 0.92 ? "delivered" : "cancelled";
}

/**
 * The seeded orders. `anchor` is the newest moment an order can carry: the
 * default is today at UTC midnight, so a re-run on the same day rewrites the
 * same rows and a later run slides the history forward by a day.
 */
export function buildOrderSeeds({
  products = [],
  customers = [],
  count = ORDER_COUNT,
  spanDays = ORDER_SPAN_DAYS,
  anchor = new Date(),
} = {}) {
  const total = toInteger(count, ORDER_COUNT);
  const days = Math.max(1, toInteger(spanDays, ORDER_SPAN_DAYS));
  const random = makeRandom(0x5eed1234);
  const end = anchor.getTime();
  const rows = [];

  for (let index = 0; index < total; index += 1) {
    // Every customer gets two orders first, so repeat buyers always exist.
    const customer =
      customers.length === 0
        ? null
        : customers[
            index < customers.length * 2
              ? index % customers.length
              : Math.floor(random() * customers.length)
          ];
    if (!customer) continue;

    // Spread the orders evenly over the window, oldest first.
    const ageDays = Math.min(days - 1, Math.floor((index / total) * days));
    const ageHours = Math.floor(random() * 24);
    const createdAt = new Date(end - ageDays * 24 * 60 * 60 * 1000 - ageHours * 60 * 60 * 1000);

    const status = statusForAge(ageDays, random);
    const itemCount = 1 + Math.floor(random() * 4);
    const items = [];
    for (let line = 0; line < itemCount; line += 1) {
      const product = products[Math.floor(random() * products.length)];
      if (!product) break;
      const quantity = 1 + Math.floor(random() * 3);
      items.push({
        id: product.id,
        image: product.image_url || "",
        price: Number(product.price),
        title: product.title,
        quantity,
      });
    }
    if (items.length === 0) continue;

    const totalAmount = Number(
      items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)
    );
    const shipped = status === "shipped" || status === "delivered";

    rows.push({
      id: orderSeedId(index),
      user_id: customer.id ?? null,
      customer_name: customer.full_name || customer.email,
      customer_email: customer.email,
      total_amount: totalAmount,
      status,
      items_count: items.length,
      items,
      vendor_id: products.find((p) => p.id === items[0]?.id)?.vendor_id ?? null,
      shipping_address: SHIPPING_LINES[Math.floor(random() * SHIPPING_LINES.length)],
      carrier: shipped ? CARRIERS[Math.floor(random() * CARRIERS.length)] : null,
      tracking_number: shipped
        ? `TRK-${suffixFor(`tracking:${index}`).slice(0, 9).toUpperCase()}`
        : null,
      created_at: createdAt.toISOString(),
    });
  }

  return rows;
}

async function readCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, parent_id, level, display_order, image_url, is_active")
    .eq("is_active", true);
  if (error) throw new Error(`Could not read categories: ${error.message}`);
  return data ?? [];
}

async function readProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id, title, price, image_url, category_id, vendor_id")
    .eq("moderation_status", "approved");
  if (error) throw new Error(`Could not read products: ${error.message}`);
  return data ?? [];
}

async function readCustomers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("role", "user");
  if (error) throw new Error(`Could not read customers: ${error.message}`);
  return data ?? [];
}

/** Upsert in chunks: a single request with thousands of rows is refused. */
async function upsertInChunks(table, rows, chunkSize = 200) {
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: "id" });
    if (error) throw new Error(`Could not upsert ${table}: ${error.message}`);
  }
}

/**
 * Fill the catalogue and the order history. `log` is injectable so a test can
 * run it without noise.
 */
export async function fillCatalog({ log = console.log, target = TARGET_PER_CATEGORY } = {}) {
  const categories = await readCategories();
  if (categories.length === 0) {
    throw new Error("No categories found. Apply the content taxonomy migration first.");
  }
  const products = await readProducts();
  const customers = await readCustomers();

  const existingByCategory = new Map();
  for (const product of products) {
    const key = String(product.category_id ?? "");
    if (!key) continue;
    // The fill owns the `e2` ids; only the taxonomy seed's own products count
    // towards the target, so a re-run repairs the filler rows instead of
    // skipping a category that is already full.
    if (String(product.id ?? "").startsWith(FILL_ID_PREFIX)) continue;
    existingByCategory.set(key, (existingByCategory.get(key) ?? 0) + 1);
  }

  const productRows = buildCatalogFill(categories, existingByCategory, { target });
  const orderRows = buildOrderSeeds({ products, customers });

  if (productRows.length > 0) {
    await upsertInChunks("products", productRows);
    log(`🛍️  Filled ${productRows.length} products across ${categories.length} categories.`);
  } else {
    log("🛍️  Every category already has enough products — nothing to fill.");
  }

  if (orderRows.length > 0) {
    await upsertInChunks("orders", orderRows);
    log(`🧾  Seeded ${orderRows.length} orders over the last ${ORDER_SPAN_DAYS} days.`);
  }

  return { products: productRows.length, orders: orderRows.length };
}

const isDirectRun =
  typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  fillCatalog()
    .then((counts) => {
      console.log(
        `✅  Catalogue fill complete: ${counts.products} products, ${counts.orders} orders.`
      );
    })
    .catch((error) => {
      console.error(`❌ seed:fill failed: ${error.message}`);
      process.exitCode = 1;
    });
}
