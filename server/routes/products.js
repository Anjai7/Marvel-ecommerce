import express from "express";
import { supabase } from "../db.js";
import { getSignedCloudinaryUrl } from "../services/cloudinary.js";

const router = express.Router();

// Helper to format product data with signed Cloudinary CDN image URLs
function formatProduct(p) {
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
async function loadActiveCategories() {
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
function resolveCategoryPath(rows, rawPath) {
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
function collectCategoryIds(row, rows) {
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
      description = "",
      image_url = "",
      cloudinary_public_id = "",
      access_type = "authenticated",
      vendor_id,
      vendor_name = "TechGear Electronics",
      is_featured = false,
    } = body;

    if (!title || !price) {
      return res.status(400).json({ error: "Product title and price are required." });
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
      title,
      price: parseFloat(price),
      original_price: original_price ? parseFloat(original_price) : parseFloat(price) * 1.25,
      category: categoryLabel,
      category_id: body.category_id ?? null,
      stock: parseInt(stock, 10) || 10,
      rating: 4.9,
      reviews_count: 1,
      image_url: image_url || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800",
      cloudinary_public_id: cloudinary_public_id || undefined,
      access_type,
      description,
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
    const updates = { ...body };

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

    if (updates.price !== undefined) updates.price = parseFloat(updates.price);
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
