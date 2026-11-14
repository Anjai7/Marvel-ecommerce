import express from "express";
import { supabase } from "../db.js";

const router = express.Router();

const READ_ERROR = "Could not load the option catalogue.";

/**
 * GET /api/product-option-values — public.
 *
 * The shared catalogue: one row per (kind, label) in the whole store. It is
 * reference data, every row of which is meant to be read by the admin form and
 * by the storefront, and it contains no product, order or personal row — so
 * it is served to anonymous callers too.
 *
 * A product links its option values here through
 * `product_variants.option_value_id`, which is what makes a rename update
 * every product that uses the value.
 */
router.get("/", async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("product_option_values")
      .select("id, kind, label, value")
      .order("kind", { ascending: true })
      .order("label", { ascending: true });

    if (error) {
      console.error("Supabase product option values read error:", error.message);
      return res.status(500).json({ error: READ_ERROR });
    }

    res.json({ values: data ?? [] });
  } catch (err) {
    console.error("Product option values GET route error:", err);
    res.status(500).json({ error: READ_ERROR });
  }
});

export default router;
