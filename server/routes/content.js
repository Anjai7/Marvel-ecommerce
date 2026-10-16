import express from "express";
import { supabase } from "../db.js";
import { verifyToken, requireRole } from "../middleware/auth.js";

const router = express.Router();

const adminOnly = [verifyToken, requireRole(["admin", "super_admin"])];

/**
 * URL validation: empty/undefined allowed (optional fields);
 * otherwise must be an https:// URL or a site-relative path (/...).
 */
function isHttpsOrRelative(value) {
  if (value == null || value === "") return true;
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (v.startsWith("/")) return true;
  return v.startsWith("https://");
}

function validateHeroSlide(body = {}) {
  if (!body.title || (typeof body.title === "string" && body.title.trim() === "")) {
    return "Hero slide title is required.";
  }
  if (body.order_index !== undefined && body.order_index !== null) {
    if (!Number.isInteger(Number(body.order_index))) {
      return "order_index must be an integer.";
    }
    if (
      typeof body.order_index === "string" &&
      body.order_index.trim() !== String(Number(body.order_index))
    ) {
      return "order_index must be an integer.";
    }
  }
  const urlFields = ["bg_image_url", "product_image_url", "fallback_image_url", "btn_path"];
  for (const field of urlFields) {
    if (body[field] != null && body[field] !== "" && !isHttpsOrRelative(body[field])) {
      return `Field '${field}' must be an https URL or a relative path.`;
    }
  }
  return null;
}

function validateSiteCategory(body = {}) {
  if (!body.name || (typeof body.name === "string" && body.name.trim() === "")) {
    return "Category name is required.";
  }
  if (body.order_index !== undefined && body.order_index !== null) {
    if (!Number.isInteger(Number(body.order_index))) {
      return "order_index must be an integer.";
    }
    if (
      typeof body.order_index === "string" &&
      body.order_index.trim() !== String(Number(body.order_index))
    ) {
      return "order_index must be an integer.";
    }
  }
  const urlFields = ["image_url", "path"];
  for (const field of urlFields) {
    if (body[field] != null && body[field] !== "" && !isHttpsOrRelative(body[field])) {
      return `Field '${field}' must be an https URL or a relative path.`;
    }
  }
  return null;
}

// GET /api/content/hero — public, active slides ordered by order_index
router.get("/hero", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("hero_slides")
      .select("*")
      .eq("is_active", true)
      .order("order_index", { ascending: true });
    if (error) {
      console.warn("Supabase hero fetch warning:", error.message);
      return res.json({ slides: [] });
    }
    return res.json({ slides: data || [] });
  } catch (e) {
    console.warn("Supabase hero fetch exception:", e.message);
    return res.json({ slides: [] });
  }
});

// POST /api/content/hero — admin only
router.post("/hero", ...adminOnly, async (req, res) => {
  const slide = req.body || {};
  const validationError = validateHeroSlide(slide);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const { error } = await supabase.from("hero_slides").upsert({
      id: slide.id || undefined,
      badge: slide.badge || null,
      title: slide.title,
      subtitle: slide.subtitle || null,
      btn_text: slide.btn_text || null,
      btn_path: slide.btn_path || "/products",
      bg_image_url: slide.bg_image_url || null,
      product_image_url: slide.product_image_url || null,
      fallback_image_url: slide.fallback_image_url || null,
      bg_gradient: slide.bg_gradient || null,
      price_text: slide.price_text || null,
      tag: slide.tag || null,
      ribbon_text: slide.ribbon_text || null,
      order_index: slide.order_index != null ? Number(slide.order_index) : 0,
      is_active: slide.is_active !== undefined ? Boolean(slide.is_active) : true,
    });
    if (error) {
      console.warn("Supabase hero save warning:", error.message);
      return res.status(500).json({ error: error.message || "Failed to save hero slide." });
    }
  } catch (e) {
    console.warn("Supabase hero save exception:", e.message);
  }

  return res.json({ message: "Hero slide saved successfully to Supabase DB" });
});

// DELETE /api/content/hero/:id — admin only
router.delete("/hero/:id", ...adminOnly, async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from("hero_slides").delete().eq("id", id);
    if (error) {
      console.warn("Supabase hero delete warning:", error.message);
      return res.status(500).json({ error: error.message || "Failed to delete hero slide." });
    }
  } catch (e) {
    console.warn("Supabase hero delete warning:", e.message);
  }
  return res.json({ message: "Hero slide deleted from Supabase DB" });
});

// GET /api/content/categories — public, active categories ordered by order_index
router.get("/categories", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("site_categories")
      .select("*")
      .eq("is_active", true)
      .order("order_index", { ascending: true });
    if (error) {
      console.warn("Supabase categories fetch warning:", error.message);
      return res.json({ categories: [] });
    }
    return res.json({ categories: data || [] });
  } catch (e) {
    console.warn("Supabase categories fetch exception:", e.message);
    return res.json({ categories: [] });
  }
});

// POST /api/content/categories — admin only
router.post("/categories", ...adminOnly, async (req, res) => {
  const category = req.body || {};
  const validationError = validateSiteCategory(category);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const { error } = await supabase.from("site_categories").upsert({
      id: category.id || undefined,
      name: category.name,
      image_url: category.image_url || null,
      path: category.path || "/products",
      order_index: category.order_index != null ? Number(category.order_index) : 0,
      is_active: category.is_active !== undefined ? Boolean(category.is_active) : true,
    });
    if (error) {
      console.warn("Supabase category save warning:", error.message);
      return res.status(500).json({ error: error.message || "Failed to save site category." });
    }
  } catch (e) {
    console.warn("Supabase category save exception:", e.message);
  }

  return res.json({ message: "Site category saved successfully to Supabase DB" });
});

// DELETE /api/content/categories/:id — admin only
router.delete("/categories/:id", ...adminOnly, async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from("site_categories").delete().eq("id", id);
    if (error) {
      console.warn("Supabase category delete warning:", error.message);
      return res.status(500).json({ error: error.message || "Failed to delete site category." });
    }
  } catch (e) {
    console.warn("Supabase category delete warning:", e.message);
  }
  return res.json({ message: "Site category deleted from Supabase DB" });
});

export default router;
