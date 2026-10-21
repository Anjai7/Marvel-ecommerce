import express from "express";
import { supabase } from "../db.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

const READ_ERROR = "Could not load wishlist.";
const SAVE_ERROR = "Could not save wishlist item.";
const DELETE_ERROR = "Could not remove wishlist item.";
const PRODUCT_ID_ERROR = "product_id is required.";

// Every route requires a logged-in user, and every query is scoped with
// `user_id = req.user.id`. A `user_id` in the request body is never read.
router.use(verifyToken);

/** The caller's id, or null when the token carries no usable id. */
function callerId(req) {
  const id = req.user?.id;
  return typeof id === "string" && id.trim() !== "" ? id : null;
}

function unauthorized(res) {
  return res.status(401).json({ error: "Authentication required." });
}

/**
 * GET /api/account/wishlist — the caller's rows, newest first, each with the
 * stored product row. A product row that no longer exists is returned as
 * `product: null` rather than a fabricated object (the FK normally cascades,
 * so this is only a defensive shape).
 */
router.get("/", async (req, res) => {
  const userId = callerId(req);
  if (!userId) return unauthorized(res);

  try {
    const { data: rows, error } = await supabase
      .from("wishlist")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase wishlist read error:", error.message);
      return res.status(500).json({ error: READ_ERROR });
    }

    const wishlistRows = rows ?? [];
    const productIds = [...new Set(wishlistRows.map((row) => row.product_id).filter(Boolean))];

    let productsById = new Map();
    if (productIds.length > 0) {
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("*")
        .in("id", productIds);

      if (productsError) {
        console.error("Supabase wishlist product read error:", productsError.message);
        return res.status(500).json({ error: READ_ERROR });
      }

      productsById = new Map((products ?? []).map((product) => [String(product.id), product]));
    }

    const items = wishlistRows.map((row) => ({
      id: row.id,
      product_id: row.product_id,
      created_at: row.created_at,
      product: productsById.get(String(row.product_id)) ?? null,
    }));

    res.json({ items });
  } catch (err) {
    console.error("Wishlist GET route error:", err);
    res.status(500).json({ error: READ_ERROR });
  }
});

/**
 * POST /api/account/wishlist — `{ product_id }`.
 *
 * 201 with `{ item }` when the row is created, 200 with the existing row when
 * it is already present. The `(user_id, product_id)` unique constraint makes
 * this idempotent even under a concurrent double-submit: a `23505` is treated
 * as "already present", never as a failure.
 */
router.post("/", async (req, res) => {
  const userId = callerId(req);
  if (!userId) return unauthorized(res);

  const rawProductId = req.body && typeof req.body === "object" ? req.body.product_id : undefined;
  const productId = typeof rawProductId === "string" ? rawProductId.trim() : "";
  if (!productId) {
    return res.status(400).json({ error: PRODUCT_ID_ERROR });
  }

  try {
    const { data: existing, error: existingError } = await supabase
      .from("wishlist")
      .select("*")
      .eq("user_id", userId)
      .eq("product_id", productId)
      .maybeSingle();

    if (existingError) {
      console.error("Supabase wishlist lookup error:", existingError.message);
      return res.status(500).json({ error: SAVE_ERROR });
    }
    if (existing) {
      return res.status(200).json({ item: existing });
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .maybeSingle();

    if (productError) {
      console.error("Supabase wishlist product lookup error:", productError.message);
      return res.status(500).json({ error: SAVE_ERROR });
    }
    if (!product) {
      return res.status(404).json({ error: "Product not found." });
    }

    const { data: created, error: insertError } = await supabase
      .from("wishlist")
      .insert([{ user_id: userId, product_id: productId }])
      .select()
      .single();

    if (insertError) {
      // A concurrent insert won the race: return the row that now exists.
      if (insertError.code === "23505") {
        const { data: raced } = await supabase
          .from("wishlist")
          .select("*")
          .eq("user_id", userId)
          .eq("product_id", productId)
          .maybeSingle();
        if (raced) return res.status(200).json({ item: raced });
      }
      console.error("Supabase wishlist insert error:", insertError.message);
      return res.status(500).json({ error: SAVE_ERROR });
    }

    res.status(201).json({ item: created });
  } catch (err) {
    console.error("Wishlist POST route error:", err);
    res.status(500).json({ error: SAVE_ERROR });
  }
});

/**
 * DELETE /api/account/wishlist/:productId — removes only the caller's row.
 * 204 whether or not a row existed; a delete is idempotent.
 */
router.delete("/:productId", async (req, res) => {
  const userId = callerId(req);
  if (!userId) return unauthorized(res);

  const productId = typeof req.params.productId === "string" ? req.params.productId.trim() : "";
  if (!productId) {
    return res.status(400).json({ error: PRODUCT_ID_ERROR });
  }

  try {
    const { error } = await supabase
      .from("wishlist")
      .delete()
      .eq("user_id", userId)
      .eq("product_id", productId);

    if (error) {
      console.error("Supabase wishlist delete error:", error.message);
      return res.status(500).json({ error: DELETE_ERROR });
    }

    res.status(204).end();
  } catch (err) {
    console.error("Wishlist DELETE route error:", err);
    res.status(500).json({ error: DELETE_ERROR });
  }
});

export default router;
