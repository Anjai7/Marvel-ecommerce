import express from "express";
import { supabase } from "../db.js";
import { adminGuards } from "../lib/guards.js";

const router = express.Router();

const COUPON_KINDS = ["percent", "flat", "free_shipping"];
const DEFAULT_MAX_USES = 0; // 0 means "no limit"

/** The coupon code as the store writes it: trimmed and uppercased. */
function normalizeCouponCode(value) {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase();
}

/** True for a `percent`, `flat` or `free_shipping` coupon kind. */
function isCouponKind(value) {
  return COUPON_KINDS.includes(value);
}

function readNumberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function readBoolean(value, fallback) {
  if (value === undefined || value === null) return fallback;
  return Boolean(value);
}

/**
 * Validate the writable coupon fields. Returns `{ error }` or
 * `{ coupon }` with the normalised values; an absent optional field stays
 * absent so a PATCH can leave it untouched.
 */
function readCouponPatch(body) {
  const patch = {};

  if (body.code !== undefined) {
    const code = normalizeCouponCode(body.code);
    if (code.length < 2) {
      return { error: "Coupon code must be at least 2 characters." };
    }
    patch.code = code;
  }

  if (body.kind !== undefined) {
    if (!isCouponKind(body.kind)) {
      return { error: "Coupon kind must be one of: percent, flat, free_shipping." };
    }
    patch.kind = body.kind;
  }

  if (body.value !== undefined) {
    const value = Number(body.value);
    if (!Number.isFinite(value) || value <= 0) {
      return { error: "Coupon value must be greater than 0." };
    }
    if (patch.kind === "percent" && value > 100) {
      return { error: "A percent coupon cannot exceed 100." };
    }
    patch.value = value;
  }

  if (body.min_subtotal !== undefined) {
    const minSubtotal = readNumberOrNull(body.min_subtotal);
    if (minSubtotal === null || minSubtotal < 0) {
      return { error: "Coupon minimum subtotal must be 0 or more." };
    }
    patch.min_subtotal = minSubtotal;
  }

  if (body.max_uses !== undefined) {
    const maxUses = Number(body.max_uses);
    if (!Number.isInteger(maxUses) || maxUses < 0) {
      return { error: "Coupon max_uses must be a whole number of 0 or more." };
    }
    patch.max_uses = maxUses;
  }

  if (body.is_active !== undefined) {
    patch.is_active = readBoolean(body.is_active, true);
  }

  if (body.expires_at !== undefined) {
    if (body.expires_at === null || body.expires_at === "") {
      patch.expires_at = null;
    } else if (typeof body.expires_at !== "string" || Number.isNaN(Date.parse(body.expires_at))) {
      return { error: "Coupon expires_at must be a valid date or empty." };
    } else {
      patch.expires_at = body.expires_at;
    }
  }

  return { coupon: patch };
}

/** The columns a coupon row is answered with. */
const COUPON_COLUMNS =
  "id, code, kind, value, min_subtotal, max_uses, used_count, is_active, expires_at, created_at";

/** The stored row as the API answers it — numbers and dates normalised. */
function formatCoupon(row) {
  if (!row) return null;
  const maxUses = Number(row.max_uses ?? DEFAULT_MAX_USES);
  const usedCount = Number(row.used_count ?? 0);
  return {
    id: row.id,
    code: row.code,
    kind: row.kind,
    value: Number(row.value ?? 0),
    min_subtotal: Number(row.min_subtotal ?? 0),
    max_uses: maxUses,
    used_count: usedCount,
    is_active: Boolean(row.is_active),
    expires_at: row.expires_at ?? null,
    created_at: row.created_at ?? null,
  };
}

/**
 * GET /api/coupons — the admin-only coupon list.
 */
router.get("/", ...adminGuards, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("coupons")
      .select(COUPON_COLUMNS)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase coupons read error:", error.message);
      return res.status(500).json({ error: "Could not load the coupons." });
    }

    res.json({ coupons: (data ?? []).map(formatCoupon).filter(Boolean) });
  } catch (err) {
    console.error("Coupons GET route error:", err);
    res.status(500).json({ error: "Could not load the coupons." });
  }
});

/**
 * POST /api/coupons — create a coupon. Admin only.
 */
router.post("/", ...adminGuards, async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const { error, coupon } = readCouponPatch({
      code: body.code,
      kind: body.kind,
      value: body.value,
      min_subtotal: body.min_subtotal ?? undefined,
      max_uses: body.max_uses ?? undefined,
      is_active: body.is_active,
      expires_at: body.expires_at,
    });

    if (error) {
      return res.status(400).json({ error });
    }

    const { data, error: insertError } = await supabase
      .from("coupons")
      .insert({
        code: coupon.code,
        kind: coupon.kind,
        value: coupon.value,
        min_subtotal: coupon.min_subtotal ?? 0,
        max_uses: coupon.max_uses ?? DEFAULT_MAX_USES,
        used_count: 0,
        is_active: coupon.is_active ?? true,
        expires_at: coupon.expires_at ?? null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Supabase coupons insert error:", insertError.message);
      return res.status(500).json({ error: "Could not create the coupon." });
    }

    const created = formatCoupon(data);
    res.status(201).json({ message: "Coupon created.", coupon: created });
  } catch (err) {
    console.error("Coupons POST route error:", err);
    res.status(500).json({ error: "Could not create the coupon." });
  }
});

/**
 * PATCH /api/coupons/:id — update a coupon. Admin only; a partial body is
 * enough, and an absent optional field is left untouched.
 */
router.patch("/:id", ...adminGuards, async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const { error, coupon } = readCouponPatch(body);

    if (error) {
      return res.status(400).json({ error });
    }

    const updates = { ...coupon };
    if (updates.code) {
      // A code is the coupon's key: changing it rewrites the row under the new
      // key rather than copying the old one.
      const { data, error: updateError } = await supabase
        .from("coupons")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (updateError) {
        console.error("Supabase coupons update error:", updateError.message);
        return res.status(500).json({ error: "Could not update the coupon." });
      }
      res.json({ message: "Coupon updated.", coupon: formatCoupon(data) });
      return;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "Nothing to update." });
    }

    const { data, error: updateError } = await supabase
      .from("coupons")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Supabase coupons update error:", updateError.message);
      return res.status(500).json({ error: "Could not update the coupon." });
    }

    res.json({ message: "Coupon updated.", coupon: formatCoupon(data) });
  } catch (err) {
    console.error("Coupons PATCH route error:", err);
    res.status(500).json({ error: "Could not update the coupon." });
  }
});

/**
 * DELETE /api/coupons/:id — delete a coupon. Admin only.
 */
router.delete("/:id", ...adminGuards, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from("coupons").delete().eq("id", id);

    if (error) {
      console.error("Supabase coupons delete error:", error.message);
      return res.status(500).json({ error: "Could not delete the coupon." });
    }

    res.json({ message: "Coupon deleted." });
  } catch (err) {
    console.error("Coupons DELETE route error:", err);
    res.status(500).json({ error: "Could not delete the coupon." });
  }
});

/**
 * GET /api/coupons/active — the codes the storefront may advertise.
 *
 * Public but deliberately minimal: a code, its shape and the minimum spend.
 * The product page used to show copy from `product_offers`, which could name
 * codes that do not exist; this list is what the admin actually manages.
 */
router.get("/active", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("coupons")
      .select("code, kind, value, min_subtotal, max_uses, used_count, expires_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      if (/does not exist|schema cache/i.test(String(error.message))) {
        return res.json({ coupons: [] });
      }
      console.error("Supabase active coupons error:", error.message);
      return res.status(500).json({ error: "Could not load coupons." });
    }

    const now = Date.now();
    const coupons = (data ?? [])
      .filter((row) => {
        if (row.expires_at && new Date(row.expires_at).getTime() < now) return false;
        const max = Number(row.max_uses ?? DEFAULT_MAX_USES);
        return !(max > 0 && Number(row.used_count ?? 0) >= max);
      })
      .filter((row) => normalizeCouponCode(row.code))
      .map((row) => ({
        code: row.code,
        kind: row.kind,
        value: Number(row.value ?? 0),
        min_subtotal: Number(row.min_subtotal ?? 0),
      }));

    res.json({ coupons });
  } catch (err) {
    console.error("Active coupons route error:", err);
    res.status(500).json({ error: "Could not load coupons." });
  }
});

/** An all-zero report for a store whose coupon tables are not applied yet. */
function emptyUsageSummary() {
  return {
    activeCoupons: 0,
    totalCoupons: 0,
    redemptions: 0,
    totalDiscount: 0,
    totalRevenue: 0,
    averageDiscount: 0,
  };
}

/**
 * GET /api/coupons/usage — redemptions and savings, admin only.
 *
 * Derived from the coupon rows and the orders that actually carry a
 * coupon_code. Before apply-07/09 exist the answer is an honest empty report
 * rather than invented figures.
 */
router.get("/usage", ...adminGuards, async (req, res) => {
  try {
    const [couponsResult, ordersResult] = await Promise.all([
      supabase.from("coupons").select(COUPON_COLUMNS),
      supabase
        .from("orders")
        .select("id, coupon_code, discount_amount, total_amount, created_at, customer_name")
        .not("coupon_code", "is", null)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (
      [couponsResult.error, ordersResult.error].some((error) =>
        /does not exist|schema cache/i.test(String(error?.message ?? ""))
      )
    ) {
      return res.json({ summary: emptyUsageSummary(), byCoupon: [], recent: [], available: false });
    }
    if (couponsResult.error || ordersResult.error) {
      console.error(
        "Supabase coupon usage error:",
        couponsResult.error?.message ?? ordersResult.error?.message
      );
      return res.status(500).json({ error: "Could not load coupon usage." });
    }

    const coupons = (couponsResult.data ?? []).map(formatCoupon).filter(Boolean);
    const orders = (ordersResult.data ?? []).filter((row) => normalizeCouponCode(row.coupon_code));

    const byCode = new Map();
    for (const coupon of coupons) {
      byCode.set(coupon.code, {
        code: coupon.code,
        kind: coupon.kind,
        value: coupon.value,
        uses: 0,
        discount: 0,
        revenue: 0,
        lastUsed: null,
        isActive: coupon.is_active,
      });
    }
    let totalDiscount = 0;
    let totalRevenue = 0;
    const recent = [];

    for (const order of orders) {
      const code = normalizeCouponCode(order.coupon_code);
      const discount = Number(order.discount_amount) || 0;
      const total = Number(order.total_amount) || 0;
      if (!byCode.has(code)) {
        byCode.set(code, {
          code,
          kind: null,
          value: 0,
          uses: 0,
          discount: 0,
          revenue: 0,
          lastUsed: null,
          isActive: false,
        });
      }
      const row = byCode.get(code);
      row.uses += 1;
      row.discount += discount;
      row.revenue += total;
      if (!row.lastUsed || String(order.created_at) > row.lastUsed) row.lastUsed = order.created_at;
      totalDiscount += discount;
      totalRevenue += total;
      recent.push({
        id: order.id,
        code,
        customer: order.customer_name ?? "",
        discount,
        total,
        createdAt: order.created_at,
      });
    }

    const byCoupon = [...byCode.values()]
      .filter((row) => row.uses > 0 || row.isActive)
      .sort((a, b) => b.uses - a.uses || a.code.localeCompare(b.code));

    res.json({
      summary: {
        activeCoupons: coupons.filter((coupon) => coupon.is_active).length,
        totalCoupons: coupons.length,
        redemptions: orders.length,
        totalDiscount,
        totalRevenue,
        averageDiscount: orders.length ? totalDiscount / orders.length : 0,
      },
      byCoupon,
      recent: recent.slice(0, 10),
      available: true,
    });
  } catch (err) {
    console.error("Coupons usage route error:", err);
    res.status(500).json({ error: "Could not load coupon usage." });
  }
});

/**
 * POST /api/coupons/validate — the storefront's pre-check. Public: the
 * checkout calls it before applying a code, and an unknown code is an answer,
 * not an error.
 *
 * The result never mutates the coupon: `used_count` moves only in `/redeem`,
 * once the order that consumes the discount actually exists.
 */
router.post("/validate", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const code = normalizeCouponCode(body.code);
    const subtotal = Number(body.subtotal);

    if (!code || !Number.isFinite(subtotal) || subtotal < 0) {
      return res
        .status(400)
        .json({ error: "A coupon code and a non-negative subtotal are required." });
    }

    const { data, error } = await supabase
      .from("coupons")
      .select(COUPON_COLUMNS)
      .eq("code", code)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("Supabase coupons validate error:", error.message);
      return res.status(500).json({ error: "Could not validate the coupon." });
    }

    if (!data) {
      return res.json({ valid: false, reason: "Unknown code" });
    }

    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
      return res.json({ valid: false, reason: "Coupon has expired" });
    }

    const maxUses = Number(data.max_uses ?? DEFAULT_MAX_USES);
    const usedCount = Number(data.used_count ?? 0);
    if (maxUses > 0 && usedCount >= maxUses) {
      return res.json({ valid: false, reason: "Coupon has reached its limit" });
    }

    const minSubtotal = Number(data.min_subtotal ?? 0);
    if (minSubtotal > 0 && subtotal < minSubtotal) {
      return res.json({ valid: false, reason: `Minimum order of ₹${minSubtotal} required` });
    }

    const kind = data.kind;
    const value = Number(data.value ?? 0);
    let discount = 0;
    if (kind === "percent") {
      discount = (subtotal * value) / 100;
    } else if (kind === "flat") {
      discount = Math.min(value, subtotal);
    }
    if (discount > subtotal) discount = subtotal;

    return res.json({
      valid: true,
      code: data.code,
      kind,
      value,
      discount,
      subtotal,
      total: subtotal - discount,
    });
  } catch (err) {
    console.error("Coupons validate route error:", err);
    res.status(500).json({ error: "Could not validate the coupon." });
  }
});

/**
 * POST /api/coupons/redeem — the checkout's post-order step. The order that
 * consumes the discount exists before this runs, so the use is only counted
 * once the discount is really owed.
 *
 * Safe against a concurrent double redeem: the increment is written back
 * against the `used_count` it read, so a lost race leaves the coupon untouched.
 */
router.post("/redeem", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const code = normalizeCouponCode(body.code);

    if (!code) {
      return res.status(400).json({ error: "A coupon code is required." });
    }

    const { data, error } = await supabase
      .from("coupons")
      .select(COUPON_COLUMNS)
      .eq("code", code)
      .maybeSingle();

    if (error) {
      console.error("Supabase coupons redeem error:", error.message);
      return res.status(500).json({ error: "Could not redeem the coupon." });
    }

    if (!data) {
      return res.json({ valid: false, reason: "Unknown code" });
    }

    if (data.is_active === false) {
      return res.json({ valid: false, reason: "Coupon is not active" });
    }

    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
      return res.json({ valid: false, reason: "Coupon has expired" });
    }

    const maxUses = Number(data.max_uses ?? DEFAULT_MAX_USES);
    const usedCount = Number(data.used_count ?? 0);
    if (maxUses > 0 && usedCount >= maxUses) {
      return res.json({ valid: false, reason: "Coupon has reached its limit" });
    }

    const { data: updated, error: updateError } = await supabase
      .from("coupons")
      .update({ used_count: usedCount + 1 })
      .eq("code", code)
      .eq("used_count", usedCount)
      .select()
      .single();

    if (updateError) {
      console.error("Supabase coupons redeem error:", updateError.message);
      return res.status(500).json({ error: "Could not redeem the coupon." });
    }

    if (!updated) {
      // The optimistic guard lost the race: another request took the last use.
      return res.json({ valid: false, reason: "Coupon has reached its limit" });
    }

    res.json({
      valid: true,
      code: updated.code,
      used_count: Number(updated.used_count ?? usedCount + 1),
    });
  } catch (err) {
    console.error("Coupons redeem route error:", err);
    res.status(500).json({ error: "Could not redeem the coupon." });
  }
});

export default router;
