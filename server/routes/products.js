import express from "express";
import { supabase } from "../db.js";
import { getSignedCloudinaryUrl } from "../services/cloudinary.js";
import { OPTION_KINDS, isOptionKind } from "../lib/productOptions.js";

const router = express.Router();

// Helper to format product data with signed Cloudinary CDN image URLs
export function formatProduct(p) {
  let displayImage = p.image_url;

  // If product has a Cloudinary public ID, ensure a freshly signed URL is generated
  if (p.cloudinary_public_id) {
    displayImage = getSignedCloudinaryUrl(p.cloudinary_public_id, p.access_type || "authenticated");
  } else if (
    p.image_url &&
    p.image_url.includes("cloudinary.com") &&
    !p.image_url.includes("s--")
  ) {
    // If it's an authenticated Cloudinary URL without signature, extract public ID and sign it
    const parts = p.image_url.split("/upload/");
    if (parts.length === 2) {
      const publicIdWithExt = parts[1].replace(/^v\d+\//, "");
      const publicId =
        publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf(".")) || publicIdWithExt;
      displayImage = getSignedCloudinaryUrl(publicId, p.access_type || "authenticated");
    }
  }

  const generatedSku =
    p.sku ||
    `MRV-${String(p.title || "PROD")
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 6)
      .toUpperCase()}-${p.id ? String(p.id).substring(0, 4).toUpperCase() : "101"}`;

  return {
    ...p,
    price: parseFloat(p.price) || 0,
    original_price: p.original_price ? parseFloat(p.original_price) : undefined,
    stock: parseInt(p.stock, 10) || 0,
    rating: parseFloat(p.rating) || 4.8,
    reviews_count: parseInt(p.reviews_count, 10) || 0,
    image_url: displayImage || p.image_url,
    image: displayImage || p.image_url,
    sku: generatedSku,
    model_name: p.model_name || generatedSku,
    // `country_of_origin`, `manufacturer_name`, `importer_packer`,
    // `manufacturing_date`, `hsn_code`, `gst_rate`, `certifications` and
    // `in_box` are stored columns now. They are nullable, and a null means
    // "not configured": never substitute a hardcoded value here.
    specifications: Array.isArray(p.specifications) ? p.specifications : [],
    dimensions: typeof p.dimensions === "object" && p.dimensions ? p.dimensions : {},
    materials: Array.isArray(p.materials) ? p.materials : [],
    care_instructions: Array.isArray(p.care_instructions) ? p.care_instructions : [],
  };
}

// GET /api/products (100% Dynamic from Supabase DB)

const CATEGORY_COLUMNS = "id, parent_id, level, slug";

/**
 * Load the active taxonomy once. The public category routes resolve against
 * active rows only; product filtering follows the same rule.
 */
export async function loadActiveCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select(CATEGORY_COLUMNS)
    .eq("is_active", true);
  if (error) return { error: true };
  return { rows: data ?? [] };
}

/**
 * Resolve `<a/b/c>` exactly by walking one segment at a time, the same
 * technique `server/routes/categories.js` uses for GET /path. A bare slug is
 * never an identifier: the full ancestor path is.
 */
export function resolveCategoryPath(rows, rawPath) {
  const segments = String(rawPath).split("/");
  if (segments.length === 0 || segments.length > 3 || segments.some((s) => s === "")) {
    return null;
  }

  let current = rows.find((row) => row.level === 1 && row.slug === segments[0]);
  for (const segment of segments.slice(1)) {
    current = current && rows.find((row) => row.parent_id === current.id && row.slug === segment);
  }
  return current ?? null;
}

/** The resolved category plus every row below it, capped at the schema depth. */
export function collectCategoryIds(row, rows) {
  const ids = [row.id];
  const seen = new Set(ids);
  let frontier = [row.id];

  for (let depth = 0; depth < 3 && frontier.length > 0; depth += 1) {
    const children = rows.filter(
      (candidate) => candidate.parent_id != null && frontier.includes(candidate.parent_id)
    );
    const fresh = children.filter((child) => !seen.has(child.id));
    ids.push(...fresh.map((child) => child.id));
    fresh.forEach((child) => seen.add(child.id));
    frontier = fresh.map((child) => child.id);
  }
  return ids;
}

/** Resolve the taxonomy filter; `{ notFound: true }` means "no such category". */
async function resolveTaxonomyFilter(req) {
  const hasPath = typeof req.query.categoryPath === "string";
  const hasId = typeof req.query.categoryId === "string";
  if (!hasPath && !hasId) return { ids: null };

  const loaded = await loadActiveCategories();
  if (loaded.error) return { error: true };

  const row = hasPath
    ? resolveCategoryPath(loaded.rows, req.query.categoryPath)
    : (loaded.rows.find((candidate) => candidate.id === req.query.categoryId) ?? null);

  if (!row) return { notFound: true };
  return { ids: collectCategoryIds(row, loaded.rows) };
}

/** Look up one category for a product write. */
async function findCategory(categoryId) {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .eq("id", categoryId)
    .maybeSingle();
  if (error) return { error: true };
  return { category: data ?? null };
}

// ─── Product options and variants ─────────────────────────────────────────
//
// A product may carry options (the axes of choice) and variants (the sellable
// combinations). The admin sends both as optional body fields:
//
//   variants:     [{ kind, label, value, option_value_id }]
//   combinations: [{ sku, price, stock, image_url, options: [{ kind, label, value }] }]
//
// A field that is absent leaves the product's rows alone; a field that is
// present — even an empty array — replaces them. Everything is validated
// before a single row is written, so a rejected body never leaves a
// half-written product behind.

const OPTION_KIND_LIST = OPTION_KINDS.join(", ");

/**
 * The relation does not exist yet — the options migration
 * (apply-04-product-variants.sql) may not have been applied. The catalogue
 * then degrades to "no links" rather than blocking the write.
 */
function isMissingRelation(error) {
  const message = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "");
  return (
    ["42P01", "PGRST105", "PGRST121"].includes(code) ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

/**
 * A column is not there because the options migration has not been applied.
 * The column is the whole difference between the old table and the new one.
 */
function isMissingColumn(error, column) {
  const message = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "");
  const needle = String(column).toLowerCase();
  return (
    ["42703", "PGRST204"].includes(code) ||
    (message.includes(needle) &&
      (message.includes("schema cache") ||
        message.includes("could not find") ||
        message.includes("column")))
  );
}

/** A trimmed, non-empty string, or null. */
function readText(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * The integer a stock field carries, or null when it is not one.
 *
 * A JSON payload carries a number, but an HTML form sends a string, so a
 * string that spells an integer is accepted too.
 */
function readInteger(value) {
  if (typeof value === "number") return Number.isInteger(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) ? parsed : null;
}

/** The number a price field carries, or null when it is not a number. */
function readNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * One option value: `{ kind, label, value }`.
 *
 * `kind` must be one of the eight kinds the contract allows and `label` is
 * required; `value` is optional. `option_value_id` is the catalogue row the
 * option links to — only the variants carry one.
 */
function readOptionEntry(entry, at, { withCatalogueLink = false } = {}) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return { error: `${at} must be an object.` };
  }
  if (!isOptionKind(entry.kind)) {
    return { error: `${at}.kind must be one of: ${OPTION_KIND_LIST}.` };
  }
  const label = readText(entry.label);
  if (!label) return { error: `${at}.label is required.` };
  if (entry.value !== undefined && entry.value !== null && typeof entry.value !== "string") {
    return { error: `${at}.value must be a string.` };
  }

  const option = {
    kind: entry.kind,
    label,
    value: entry.value === undefined || entry.value === null ? null : readText(entry.value),
  };

  if (withCatalogueLink) {
    if (
      entry.option_value_id !== undefined &&
      entry.option_value_id !== null &&
      typeof entry.option_value_id !== "string"
    ) {
      return { error: `${at}.option_value_id must be a uuid string.` };
    }
    option.option_value_id = readText(entry.option_value_id);
  }

  return { option };
}

/** Validate the optional `variants` field: the option values of a product. */
function readVariants(raw) {
  if (!Array.isArray(raw)) return { error: "variants must be an array." };

  const variants = [];
  for (let index = 0; index < raw.length; index += 1) {
    const result = readOptionEntry(raw[index], `variants[${index}]`, { withCatalogueLink: true });
    if (result.error) return { error: result.error };
    variants.push(result.option);
  }

  return { variants };
}

/** Validate the optional `combinations` field: the sellable variants. */
function readCombinations(raw) {
  if (!Array.isArray(raw)) return { error: "combinations must be an array." };

  const combinations = [];
  for (let index = 0; index < raw.length; index += 1) {
    const row = raw[index];
    const at = `combinations[${index}]`;
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return { error: `${at} must be an object.` };
    }
    if (row.sku !== undefined && row.sku !== null && typeof row.sku !== "string") {
      return { error: `${at}.sku must be a string.` };
    }
    if (
      row.image_url !== undefined &&
      row.image_url !== null &&
      typeof row.image_url !== "string"
    ) {
      return { error: `${at}.image_url must be a string.` };
    }

    let price = null;
    if (row.price !== undefined && row.price !== null) {
      price = readNumber(row.price);
      if (price === null || price < 0) {
        return { error: `${at}.price must be a number of 0 or more.` };
      }
    }

    let stock = null;
    if (row.stock !== undefined && row.stock !== null) {
      stock = readInteger(row.stock);
      if (stock === null || stock < 0) {
        return { error: `${at}.stock must be an integer of 0 or more.` };
      }
    }

    let options = [];
    if (row.options !== undefined && row.options !== null) {
      if (!Array.isArray(row.options)) return { error: `${at}.options must be an array.` };
      for (let optionIndex = 0; optionIndex < row.options.length; optionIndex += 1) {
        const result = readOptionEntry(row.options[optionIndex], `${at}.options[${optionIndex}]`);
        if (result.error) return { error: result.error };
        options.push(result.option);
      }
    }

    combinations.push({
      sku: readText(row.sku),
      price,
      stock,
      image_url: readText(row.image_url),
      options,
    });
  }

  return { combinations };
}

/**
 * Read the optional `variants` and `combinations` fields of a product body.
 *
 * A field that is absent (or null) is left alone; a field that is present is
 * replaced. The rows come back normalised, so the write only has to map them
 * onto the database columns.
 */
function readProductOptions(body) {
  const payload = {};

  if (body.variants !== undefined && body.variants !== null) {
    const result = readVariants(body.variants);
    if (result.error) return { error: result.error };
    payload.variants = result.variants;
  }

  if (body.combinations !== undefined && body.combinations !== null) {
    const result = readCombinations(body.combinations);
    if (result.error) return { error: result.error };
    payload.combinations = result.combinations;
  }

  return { payload };
}

/**
 * The catalogue ids that exist, and the ids the store already has for the
 * (kind, label) pairs the admin used.
 *
 * A product links its option values to the catalogue so that renaming one
 * entry renames the option on every product that uses it. A link to a row
 * that does not exist is dropped rather than failing the write: the admin
 * may have sent a stale id.
 *
 * Values no product has used yet are created here, once: the first product
 * to use a new option is what puts it in the catalogue. The rows are only
 * inserted when they do not exist — an existing catalogue entry is never
 * touched, so a rename made in the catalogue always wins.
 */
async function resolveCatalogueLinks(variants) {
  const ids = [...new Set(variants.map((variant) => variant.option_value_id).filter(Boolean))];
  const kinds = [...new Set(variants.map((variant) => variant.kind))];

  // No option values at all — the product's rows are simply removed.
  if (variants.length === 0) return { idsFor: [] };

  // Everything the catalogue knows about these kinds, in one read. The
  // catalogue is reference data — a single request covers it.
  const { data: catalogue, error } = await supabase
    .from("product_option_values")
    .select("id, kind, label, value")
    .in("kind", kinds);
  if (error) {
    // The options migration may not have been applied yet. The product's
    // option values are still written — they just carry no catalogue link,
    // so a global rename does not reach them until the migration is run.
    if (isMissingRelation(error)) return { idsFor: variants.map(() => null) };
    return { error };
  }

  const byKey = new Map();
  for (const row of catalogue ?? []) {
    byKey.set(`${row.kind}::${row.label}`, row.id);
  }

  // A value the store has never seen becomes a catalogue row. `ignoreDuplicates`
  // keeps a catalogue row an admin renamed from being overwritten: the value
  // the admin typed never replaces what is already stored.
  const missing = [];
  const seen = new Set();
  for (const variant of variants) {
    const key = `${variant.kind}::${variant.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (byKey.has(key)) continue;
    missing.push({ kind: variant.kind, label: variant.label, value: variant.value ?? null });
  }

  if (missing.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from("product_option_values")
      .upsert(missing, { onConflict: "kind,label", ignoreDuplicates: true })
      .select("id, kind, label");
    if (insertError) {
      // The product's rows can still be written without catalogue links, so a
      // catalogue that is not there yet must not cost the admin their save.
      console.error("Supabase product option catalogue write error:", insertError.message);
    } else {
      for (const row of inserted ?? []) {
        byKey.set(`${row.kind}::${row.label}`, row.id);
      }
      // Rows another admin created concurrently are not returned by the upsert
      // — read them back so the link is still made.
      const stillMissing = [...seen].filter((key) => !byKey.has(key));
      if (stillMissing.length > 0) {
        const keys = stillMissing.map((key) => {
          const [kind, label] = key.split("::");
          return { kind, label };
        });
        const { data: again } = await supabase
          .from("product_option_values")
          .select("id, kind, label")
          .in("kind", [...new Set(keys.map((entry) => entry.kind))]);
        for (const row of again ?? []) {
          byKey.set(`${row.kind}::${row.label}`, row.id);
        }
      }
    }
  }

  const known = new Set();
  if (ids.length > 0) {
    const { data, error: knownError } = await supabase
      .from("product_option_values")
      .select("id")
      .in("id", ids);
    if (knownError) return { error: knownError };
    for (const row of data ?? []) known.add(row.id);
  }

  // The id each variant links to: its own catalogue row if it exists, else
  // the row the store already has for that (kind, label).
  const idsFor = variants.map((variant) => {
    if (variant.option_value_id && known.has(variant.option_value_id)) {
      return variant.option_value_id;
    }
    return byKey.get(`${variant.kind}::${variant.label}`) ?? null;
  });

  return { idsFor };
}

/**
 * Replace the option values of one product.
 *
 * The rows are deleted and the sent rows inserted: the admin form sends the
 * whole list every time, so a merge would keep the values the admin removed.
 */
async function writeProductVariants(productId, variants) {
  const resolved = await resolveCatalogueLinks(variants);
  if (resolved.error) {
    return {
      ok: false,
      message: "The product was saved, but its option values could not be saved.",
      reason: resolved.error.message,
    };
  }

  const rows = variants.map((variant, index) => ({
    product_id: productId,
    kind: variant.kind,
    label: variant.label,
    value: variant.value,
    option_value_id: resolved.idsFor?.[index] ?? null,
    position: index,
    is_active: true,
  }));

  const { error: deleteError } = await supabase
    .from("product_variants")
    .delete()
    .eq("product_id", productId);
  if (deleteError) {
    return {
      ok: false,
      message: "The product was saved, but its option values could not be saved.",
      reason: deleteError.message,
    };
  }

  if (!rows.length) return { ok: true };

  const { error: insertError } = await supabase.from("product_variants").insert(rows);
  if (insertError && isMissingColumn(insertError, "option_value_id")) {
    // The widening migration has not been applied: the old table stores the
    // option values but cannot store their catalogue link. Write them
    // without the link rather than lose the admin's work — the link comes
    // back the next time the product is saved after the migration runs.
    const { error: retryError } = await supabase.from("product_variants").insert(
      rows.map((row) => {
        const slimRow = { ...row };
        delete slimRow.option_value_id;
        return slimRow;
      })
    );
    if (retryError) {
      return {
        ok: false,
        message: "The product was saved, but its option values could not be saved.",
        reason: retryError.message,
      };
    }
    return { ok: true };
  }

  if (insertError) {
    return {
      ok: false,
      message: "The product was saved, but its option values could not be saved.",
      reason: insertError.message,
    };
  }

  return { ok: true };
}

/** Replace the sellable combinations of one product. */
async function writeProductCombinations(productId, combinations) {
  const rows = combinations.map((combination, index) => ({
    product_id: productId,
    sku: combination.sku,
    price: combination.price,
    stock: combination.stock,
    image_url: combination.image_url,
    options: combination.options,
    position: index,
    is_active: true,
  }));

  const { error: deleteError } = await supabase
    .from("product_variant_combinations")
    .delete()
    .eq("product_id", productId);
  if (deleteError) {
    return {
      ok: false,
      message: "The product was saved, but its variant combinations could not be saved.",
      reason: deleteError.message,
    };
  }

  if (!rows.length) return { ok: true };

  const { error: insertError } = await supabase.from("product_variant_combinations").insert(rows);
  if (insertError) {
    return {
      ok: false,
      message: "The product was saved, but its variant combinations could not be saved.",
      reason: insertError.message,
    };
  }

  return { ok: true };
}

/**
 * Write the options and the combinations of a product.
 *
 * The rows are written after the product row exists, because a combination
 * carries the product id. A failure here is reported as a 500: the product
 * itself is already saved, and a silent success would leave the admin
 * believing the variants are stored when they are not.
 */
async function writeProductOptions(productId, payload) {
  if (payload.variants !== undefined) {
    const written = await writeProductVariants(productId, payload.variants);
    if (!written.ok) return written;
  }
  if (payload.combinations !== undefined) {
    const written = await writeProductCombinations(productId, payload.combinations);
    if (!written.ok) return written;
  }
  return { ok: true };
}

router.get("/", async (req, res) => {
  try {
    const { vendorId, category, moderation_status, search, is_featured } = req.query;

    const taxonomy = await resolveTaxonomyFilter(req);
    if (taxonomy.error) {
      return res.status(500).json({ error: "Could not load products." });
    }
    if (taxonomy.notFound) {
      res.set("X-Category-Not-Found", "true");
      return res.json([]);
    }

    let query = supabase.from("products").select("*").order("created_at", { ascending: false });

    if (vendorId) {
      query = query.eq("vendor_id", vendorId);
    }

    if (taxonomy.ids) {
      query = query.in("category_id", taxonomy.ids);
    } else if (category && category !== "All") {
      // Free-text display label: the legacy filter, not the taxonomy filter.
      query = query.ilike("category", category);
    }

    if (moderation_status) {
      query = query.eq("moderation_status", moderation_status);
    }

    if (is_featured !== undefined) {
      query = query.eq("is_featured", is_featured === "true");
    }

    if (search) {
      // PostgREST reads `,` `.` `(` `)` as filter grammar; a search term must
      // never be able to add another clause.
      const safeSearch = String(search).replace(/[,.()]/g, " ");
      query = query.or(`title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Supabase products query error:", error.message);
      return res.status(500).json({ error: "Could not load products." });
    }

    const formatted = (data || []).map(formatProduct);
    res.json(formatted);
  } catch (err) {
    console.error("Products GET route error:", err);
    res.status(500).json({ error: "Failed to fetch products from database." });
  }
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();

    if (error) {
      console.error("Supabase product read error:", error.message);
      return res.status(500).json({ error: "Could not load product." });
    }
    if (!data) {
      return res.status(404).json({ error: "Product not found." });
    }

    res.json(formatProduct(data));
  } catch (err) {
    console.error("Products GET by id route error:", err);
    res.status(500).json({ error: "Could not load product." });
  }
});

// POST /api/products (Create dynamic product in Supabase DB)
router.post("/", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const {
      title,
      price,
      original_price,
      category,
      stock = 10,
      description,
      image_url,
      cloudinary_public_id = "",
      access_type = "authenticated",
      vendor_id,
      vendor_name = "TechGear Electronics",
      is_featured = false,
    } = body;

    if (
      !title ||
      (typeof title === "string" && !title.trim()) ||
      price === undefined ||
      price === null ||
      price === ""
    ) {
      return res.status(400).json({ error: "Product title and price are required." });
    }
    if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
      return res.status(400).json({ error: "Product title and price are required." });
    }
    if (!description || typeof description !== "string" || !description.trim()) {
      return res.status(400).json({ error: "Product description is required." });
    }
    if (!image_url || typeof image_url !== "string" || !image_url.trim()) {
      return res.status(400).json({ error: "Product image is required." });
    }

    // The options are validated before anything is written: a rejected
    // variant must not cost the product itself.
    const options = readProductOptions(body);
    if (options.error) {
      return res.status(400).json({ error: options.error });
    }

    let categoryLabel = category;
    if (Object.hasOwn(body, "category_id") && body.category_id != null) {
      const found = await findCategory(body.category_id);
      if (found.error) {
        return res.status(500).json({ error: "Failed to save product." });
      }
      if (!found.category) {
        return res.status(400).json({ error: "Category not found." });
      }
      if (categoryLabel === undefined || categoryLabel === null || categoryLabel === "") {
        categoryLabel = found.category.name;
      }
    }
    if (categoryLabel === undefined || categoryLabel === null || categoryLabel === "") {
      categoryLabel = "Electronics";
    }

    const newProductRecord = {
      title: title.trim(),
      price: parseFloat(price),
      original_price: original_price ? parseFloat(original_price) : parseFloat(price) * 1.25,
      category: categoryLabel,
      category_id: body.category_id ?? null,
      stock: parseInt(stock, 10) || 10,
      rating: 4.9,
      reviews_count: 1,
      image_url: image_url.trim(),
      cloudinary_public_id: cloudinary_public_id || undefined,
      access_type,
      description: description.trim(),
      vendor_id: vendor_id || null,
      vendor_name,
      moderation_status: "approved",
      is_featured: Boolean(is_featured),
      status: "active",
    };

    const { data, error } = await supabase
      .from("products")
      .insert([newProductRecord])
      .select()
      .single();

    if (error) {
      console.error("Supabase insert product error:", error.message);
      return res.status(500).json({ error: "Failed to save product." });
    }

    // The variants and the combinations carry the id of the product that was
    // just written, so they can only be saved now.
    const written = await writeProductOptions(data.id, options.payload);
    if (!written.ok) {
      console.error("Supabase product options write error:", written.reason);
      return res.status(500).json({ error: written.message });
    }

    res.status(201).json({ message: "Product created in Supabase", product: formatProduct(data) });
  } catch (err) {
    console.error("Products POST route error:", err);
    res.status(500).json({ error: "Failed to save product." });
  }
});

// PUT /api/products/:id (Update product in Supabase DB)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body && typeof req.body === "object" ? req.body : {};
    // `variants` and `combinations` are not columns of `products`: they live
    // in their own tables and are written once the product row exists. They
    // are taken out of the update so the product row is never asked to carry
    // them.
    const { variants, combinations, ...productFields } = body;
    const updates = { ...productFields };

    if (updates.title !== undefined) {
      if (typeof updates.title !== "string" || !updates.title.trim()) {
        return res.status(400).json({ error: "Product title cannot be empty." });
      }
      updates.title = updates.title.trim();
    }
    if (updates.price !== undefined) {
      if (
        updates.price === null ||
        updates.price === "" ||
        isNaN(parseFloat(updates.price)) ||
        parseFloat(updates.price) < 0
      ) {
        return res.status(400).json({ error: "Product price cannot be empty." });
      }
      updates.price = parseFloat(updates.price);
    }
    if (updates.description !== undefined) {
      if (typeof updates.description !== "string" || !updates.description.trim()) {
        return res.status(400).json({ error: "Product description cannot be empty." });
      }
      updates.description = updates.description.trim();
    }
    if (updates.image_url !== undefined) {
      if (typeof updates.image_url !== "string" || !updates.image_url.trim()) {
        return res.status(400).json({ error: "Product image cannot be empty." });
      }
      updates.image_url = updates.image_url.trim();
    }

    // The options are validated before the product row is touched: a
    // rejected variant must not leave the product half updated.
    const options = readProductOptions({ variants, combinations });
    if (options.error) {
      return res.status(400).json({ error: options.error });
    }

    if (Object.hasOwn(updates, "category_id") && updates.category_id != null) {
      const found = await findCategory(updates.category_id);
      if (found.error) {
        return res.status(500).json({ error: "Failed to save product." });
      }
      if (!found.category) {
        return res.status(400).json({ error: "Category not found." });
      }
      if (updates.category === undefined || updates.category === null || updates.category === "") {
        updates.category = found.category.name;
      }
    }

    if (updates.original_price !== undefined)
      updates.original_price = parseFloat(updates.original_price);
    if (updates.stock !== undefined) updates.stock = parseInt(updates.stock, 10);

    const { data, error } = await supabase
      .from("products")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Supabase update product error:", error.message);
      return res.status(500).json({ error: "Failed to save product." });
    }

    // The variants and the combinations are replaced only when the request
    // carries them: a request without them leaves the product's rows alone.
    const written = await writeProductOptions(id, options.payload);
    if (!written.ok) {
      console.error("Supabase product options write error:", written.reason);
      return res.status(500).json({ error: written.message });
    }

    res.json({ message: "Product updated in database", product: formatProduct(data) });
  } catch (err) {
    console.error("Products PUT route error:", err);
    res.status(500).json({ error: "Failed to save product." });
  }
});

// PATCH /api/products/:id/moderation (Admin moderation approval & featured flag)
router.patch("/:id/moderation", async (req, res) => {
  try {
    const { id } = req.params;
    const { moderation_status, is_featured } = req.body;

    const updates = {};
    if (moderation_status) updates.moderation_status = moderation_status;
    if (is_featured !== undefined) updates.is_featured = is_featured;

    const { data, error } = await supabase
      .from("products")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Supabase moderation update error:", error.message);
      return res.status(500).json({ error: "Failed to save product." });
    }

    res.json({ message: "Moderation status updated", product: formatProduct(data) });
  } catch (err) {
    console.error("Products moderation route error:", err);
    res.status(500).json({ error: "Failed to save product." });
  }
});

// DELETE /api/products/:id (Delete product from Supabase DB)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      console.error("Supabase delete product error:", error.message);
      return res.status(500).json({ error: "Failed to delete product." });
    }

    res.json({ message: "Product deleted from database successfully" });
  } catch (err) {
    console.error("Products DELETE route error:", err);
    res.status(500).json({ error: "Failed to delete product." });
  }
});

export default router;
