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

function mapVariant(row, catalogue) {
  // The catalogue row wins: a catalogue row that was renamed renames the
  // option on every product that links to it.
  const entry = catalogue.get(row.option_value_id);
  return {
    id: row.id ?? null,
    label: entry?.label ?? row.label ?? null,
    value: entry?.value ?? row.value ?? null,
  };
}

/** One option value of a product, whatever its kind. */
function mapOption(row, catalogue) {
  const entry = catalogue.get(row.option_value_id);
  return {
    id: row.id ?? null,
    kind: row.kind ?? null,
    label: entry?.label ?? row.label ?? null,
    value: entry?.value ?? row.value ?? null,
    position: row.position ?? 0,
    option_value_id: row.option_value_id ?? null,
  };
}

/** The choice a combination represents: a list of `{ kind, label, value }`. */
function mapCombinationOptions(options) {
  if (!Array.isArray(options)) return [];
  return options.map((entry) => ({
    kind: entry?.kind ?? null,
    label: entry?.label ?? null,
    value: entry?.value ?? null,
  }));
}

function mapCombination(row) {
  return {
    id: row.id ?? null,
    sku: row.sku ?? null,
    price: toNumberOrNull(row.price),
    stock: row.stock ?? null,
    image_url: row.image_url ?? null,
    options: mapCombinationOptions(row.options),
    position: row.position ?? 0,
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
 * The relation does not exist yet. The options schema (apply-04-product-variants.sql)
 * may not have been applied — every surface that reads it degrades to what it
 * can serve instead of taking the page down with it.
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
 * The catalogue rows the option values link to, keyed by id.
 *
 * The catalogue (`product_option_values`) holds the label and the value that
 * are shown, so a rename there renames the option everywhere that links to
 * it. The ids are read in one query: a product links to a handful of them,
 * not to the whole catalogue.
 *
 * `null` means the read failed — the caller turns that into a 500 rather
 * than serving option values that are quietly out of date. A catalogue that
 * does not exist yet is a degraded store, not a broken one: the option
 * values are served from the rows themselves.
 */
async function loadCatalogue(rows) {
  const ids = [...new Set(rows.map((row) => row.option_value_id).filter(Boolean))];
  if (!ids.length) return new Map();

  const { data, error } = await supabase
    .from("product_option_values")
    .select("id, label, value")
    .in("id", ids);
  if (error) {
    if (isMissingRelation(error)) return new Map();
    console.error("Supabase product option values read error:", error.message);
    return null;
  }
  return new Map((data ?? []).map((row) => [row.id, row]));
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
 * `products.rating`), its option values, its sellable combinations and its
 * media. A table with no rows yields an empty list, never an invented one.
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

    const [offersResult, reviewsResult, variantsResult, combinationsResult, mediaResult] =
      await Promise.all([
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
          .from("product_variant_combinations")
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

    // The sellable combinations need the migration; the storefront must not
    // 500 because they are absent. A missing table degrades to "no
    // combinations" — the page prices the product row instead.
    if (combinationsResult.error && !isMissingRelation(combinationsResult.error)) {
      console.error(
        "Supabase product variant combinations read error:",
        combinationsResult.error.message
      );
      return res.status(500).json({ error: READ_ERROR });
    }
    const combinationRows = combinationsResult.error ? [] : (combinationsResult.data ?? []);

    const variantRows = (variantsResult.data ?? []).slice().sort((left, right) => {
      // The query already asks for the position order; sorting here makes it
      // a guarantee of the response rather than a fact about the database.
      return (left.position ?? 0) - (right.position ?? 0);
    });
    const catalogue = await loadCatalogue(variantRows);
    if (!catalogue) {
      return res.status(500).json({ error: READ_ERROR });
    }

    res.json({
      product,
      offers: (offersResult.data ?? []).map(mapOffer),
      reviews: summarizeReviews(reviewsResult.data ?? []),
      variants: {
        // Every option value of the product, whatever its kind.
        options: variantRows.map((row) => mapOption(row, catalogue)),
        // The colours and the sizes stay what they always were: the
        // storefront and its tests read them by name.
        colors: variantRows
          .filter((row) => row.kind === "color")
          .map((row) => mapVariant(row, catalogue)),
        sizes: variantRows
          .filter((row) => row.kind === "size")
          .map((row) => mapVariant(row, catalogue)),
      },
      combinations: combinationRows.map(mapCombination),
      media: (mediaResult.data ?? []).map(mapMedia),
    });
  } catch (err) {
    console.error("Product details GET route error:", err);
    res.status(500).json({ error: READ_ERROR });
  }
});

export default router;
