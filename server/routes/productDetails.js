import express from "express";
import { supabase } from "../db.js";

const router = express.Router();

const READ_ERROR = "Could not load product details.";
const STAR_KEYS = ["1", "2", "3", "4", "5"];

/** NUMERIC comes back from PostgREST as a string; null stays null. */
function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function mapOffer(row) {
  return {
    kind: row.kind ?? null,
    title: row.title ?? null,
    bank: row.bank ?? null,
    code: row.code ?? null,
    description: row.description ?? null,
    months: row.months ?? null,
    amount: toNumberOrNull(row.amount),
    interest: row.interest ?? null,
  };
}

function mapReview(row) {
  return {
    id: row.id ?? null,
    author_name: row.author_name ?? null,
    author_avatar: row.author_avatar ?? null,
    rating: toNumberOrNull(row.rating),
    title: row.title ?? null,
    body: row.body ?? null,
    is_verified: Boolean(row.is_verified),
    created_at: row.created_at ?? null,
  };
}

function mapVariant(row) {
  return {
    id: row.id ?? null,
    label: row.label ?? null,
    value: row.value ?? null,
  };
}

function mapMedia(row) {
  return {
    id: row.id ?? null,
    url: row.url ?? null,
    kind: row.kind ?? null,
  };
}

/**
 * Aggregate the stored review rows.
 *
 * `overall` is the mean rounded to one decimal, or `null` when there are no
 * rows — never a placeholder rating. `breakdown` counts only the stars that
 * occur, keyed "1".."5". `items` keeps the newest-first order the query asked
 * for.
 */
function summarizeReviews(rows) {
  const items = rows.map(mapReview);
  const total = items.length;

  let sum = 0;
  const counts = new Map();
  for (const item of items) {
    const star = item.rating;
    if (!Number.isInteger(star) || star < 1 || star > 5) continue;
    sum += star;
    const key = String(star);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const overall = total === 0 ? null : Math.round((sum / total) * 10) / 10;

  const breakdown = {};
  for (const key of STAR_KEYS) {
    if (counts.has(key)) breakdown[key] = counts.get(key);
  }

  return { overall, total, breakdown, items };
}

/**
 * GET /api/products/:id/details — public.
 *
 * Everything a product page shows comes from here: the product row, its stored
 * offers, its reviews (aggregated from `product_reviews`, not from
 * `products.rating`), its colour/size variants and its media. A table with no
 * rows yields an empty list, never an invented one.
 */
router.get("/:id/details", async (req, res) => {
  const id = req.params.id;

  try {
    const { data: product, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Supabase product details read error:", error.message);
      return res.status(500).json({ error: READ_ERROR });
    }
    if (!product) {
      return res.status(404).json({ error: "Product not found." });
    }

    const [offersResult, reviewsResult, variantsResult, mediaResult] = await Promise.all([
      supabase
        .from("product_offers")
        .select("*")
        .eq("product_id", id)
        .eq("is_active", true)
        .order("position", { ascending: true }),
      supabase
        .from("product_reviews")
        .select("*")
        .eq("product_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", id)
        .eq("is_active", true)
        .order("position", { ascending: true }),
      supabase
        .from("product_media")
        .select("*")
        .eq("product_id", id)
        .eq("is_active", true)
        .order("position", { ascending: true }),
    ]);

    const failed = [offersResult, reviewsResult, variantsResult, mediaResult].find(
      (result) => result.error
    );
    if (failed) {
      console.error("Supabase product details child read error:", failed.error.message);
      return res.status(500).json({ error: READ_ERROR });
    }

    const variantRows = variantsResult.data ?? [];

    res.json({
      product,
      offers: (offersResult.data ?? []).map(mapOffer),
      reviews: summarizeReviews(reviewsResult.data ?? []),
      variants: {
        colors: variantRows.filter((row) => row.kind === "color").map(mapVariant),
        sizes: variantRows.filter((row) => row.kind === "size").map(mapVariant),
      },
      media: (mediaResult.data ?? []).map(mapMedia),
    });
  } catch (err) {
    console.error("Product details GET route error:", err);
    res.status(500).json({ error: READ_ERROR });
  }
});

export default router;
