// ====================================================
// SEED THE PRODUCT CATALOG ACROSS THE WHOLE TAXONOMY
//
//   npm run seed:products
//
// Non-destructive by design:
//   * no delete / truncate / "clean the catalog first" step. The previous
//     version ran delete().neq("id", "00000000-…"), which wiped every product
//     in the shared database before inserting — that call is gone;
//   * every product has a deterministic id
//     (p1000000-0000-4000-8000-0000000000NN), so a re-run updates the same
//     rows instead of duplicating them;
//   * orders are never written.
//
// The product list is built from the LIVE `public.categories` tree, so it can
// never drift from the taxonomy: 3 products per level-1 category, 1 per
// level-2 and 1 per level-3 (a level-3 category page would otherwise be
// empty, because a category page lists its own products only).
//
// Images: the category's image_url with a distinct `&sig=<n>` crop seed per
// product. Cloudinary is used only when CLOUDINARY_CLOUD_NAME,
// CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are all set; otherwise the
// Unsplash URL is stored as-is with access_type "public". A fabricated
// cloudinary_public_id is never written — see the demo fallback in
// server/services/cloudinary.js, which is why that module is only imported
// when the configuration is complete.
// ====================================================

import { pathToFileURL } from "node:url";
import { supabase } from "./db.js";

const PRODUCT_ID_PREFIX = "p1";

/** One real Unsplash URL, reused with a distinct crop seed per product. */
const FALLBACK_IMAGE_URL =
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop";

/** Three products per root category. */
const ROOT_VARIANTS = ["Signature", "Everyday", "Premium"];

/** One product per level-3 leaf, cycled for variety. */
const LEAF_VARIANTS = ["Classic", "Studio", "Pro", "Lite", "Max"];

/** p1000000-0000-4000-8000-000000000001 for index 1. */
export function productSeedId(index) {
  return `${PRODUCT_ID_PREFIX}000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

/**
 * Append a distinct crop seed so products of the same category do not all
 * render the identical crop. Handles a URL that already carries a query.
 */
export function withCropSeed(imageUrl, seed) {
  const base =
    typeof imageUrl === "string" && imageUrl.trim() !== "" ? imageUrl.trim() : FALLBACK_IMAGE_URL;
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}sig=${seed}`;
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

/**
 * Build the product rows from the category tree. Deterministic: the same tree
 * always yields the same ids, titles, prices and images, on both calls.
 * `category` is the display label (`products.category` is NOT NULL) and
 * `category_id` is the taxonomy binding.
 */
export function buildProductSeeds(categories = []) {
  const sorted = [...categories].sort(compareCategories);
  const seeds = [];

  const push = (category, suffix) => {
    const index = seeds.length + 1;
    const price = Number((499 + ((index * 137) % 3800) + 0.99).toFixed(2));
    seeds.push({
      id: productSeedId(index),
      title: `${category.name} ${suffix}`,
      description: `${suffix} pick from our ${category.name} range.`,
      price,
      original_price: Number((price * 1.2).toFixed(2)),
      category: category.name,
      category_id: category.id,
      stock: 8 + ((index * 13) % 40),
      rating: Number((4.2 + (index % 8) * 0.1).toFixed(1)),
      reviews_count: 120 + ((index * 37) % 900),
      is_featured: index % 11 === 0,
      image_url: withCropSeed(category.image_url, index),
    });
  };

  for (const category of sorted.filter((row) => toInteger(row.level, 1) === 1)) {
    for (const variant of ROOT_VARIANTS) push(category, variant);
  }
  for (const category of sorted.filter((row) => toInteger(row.level, 1) === 2)) {
    push(category, "Essentials");
  }
  for (const category of sorted.filter((row) => toInteger(row.level, 1) === 3)) {
    push(category, LEAF_VARIANTS[seeds.length % LEAF_VARIANTS.length]);
  }

  return seeds;
}

/**
 * Cloudinary is complete only with all three values. A partial configuration
 * must not reach uploadBufferToCloudinary: its demo fallback invents a
 * `cld-<timestamp>` public id. Environment variable NAMES only — never values.
 */
export function cloudinaryConfigured(env = process.env) {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

/** Upload one seed image; returns null when Cloudinary is not configured. */
async function uploadSeedImage(imageUrl, index) {
  if (!cloudinaryConfigured()) return null;

  try {
    // Imported lazily so a run without Cloudinary never builds the SDK.
    const { uploadBufferToCloudinary } = await import("./services/cloudinary.js");
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`image fetch failed with ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const upload = await uploadBufferToCloudinary(buffer, "marvel_products", "public");
    return {
      image_url: upload.signed_url || upload.url,
      cloudinary_public_id: upload.public_id ?? null,
      access_type: upload.access_type || "public",
    };
  } catch (error) {
    console.warn(`⚠️ Cloudinary upload skipped for product ${index}: ${error.message}`);
    return null;
  }
}

async function readCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, level, display_order, image_url")
    .order("level", { ascending: true })
    .order("display_order", { ascending: true });

  if (error) throw new Error(`Could not read categories: ${error.message}`);
  return data ?? [];
}

/** The vendor the seeded catalog is attributed to, when one exists. */
async function readVendor() {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, store_name")
      .eq("role", "vendor")
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return data ?? null;
  } catch {
    return null;
  }
}

/**
 * Upsert the whole catalog. `uploadImage` is injectable so the test can prove
 * the upsert/no-delete behaviour without network access; production uses the
 * Cloudinary-aware default.
 */
export async function seedProducts({ uploadImage = uploadSeedImage } = {}) {
  const categories = await readCategories();
  if (categories.length === 0) {
    throw new Error("No categories found. Apply docs/sql/apply-01-content-taxonomy.sql first.");
  }

  const vendor = await readVendor();
  const seeds = buildProductSeeds(categories);

  const rows = [];
  for (const seed of seeds) {
    const uploaded = await uploadImage(seed.image_url, seed.id);
    rows.push({
      id: seed.id,
      title: seed.title,
      description: seed.description,
      price: seed.price,
      original_price: seed.original_price,
      category: seed.category,
      category_id: seed.category_id,
      stock: seed.stock,
      rating: seed.rating,
      reviews_count: seed.reviews_count,
      image_url: uploaded?.image_url || seed.image_url,
      cloudinary_public_id: uploaded?.cloudinary_public_id ?? null,
      access_type: uploaded?.access_type || "public",
      is_featured: seed.is_featured,
      moderation_status: "approved",
      vendor_id: vendor?.id ?? null,
      vendor_name: vendor?.store_name || "Marvel Verified Seller",
      status: "active",
    });
  }

  const { error } = await supabase.from("products").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`Could not upsert products: ${error.message}`);

  return { products: rows.length, categories: categories.length };
}

const isDirectRun =
  typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  seedProducts()
    .then((counts) => {
      console.log(`🛍️  Seeded ${counts.products} products across ${counts.categories} categories.`);
      console.log(
        cloudinaryConfigured()
          ? "☁️  Images uploaded to Cloudinary (access_type: public)."
          : "🖼️  Cloudinary is not configured — plain Unsplash URLs were stored."
      );
    })
    .catch((error) => {
      console.error(`❌ seed:products failed: ${error.message}`);
      process.exitCode = 1;
    });
}
