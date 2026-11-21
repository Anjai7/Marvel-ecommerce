import express from "express";
import { supabase } from "../db.js";
import { verifyToken, requireRole } from "../middleware/auth.js";

const router = express.Router();

// Helper to format order records
function formatOrder(o) {
  return {
    ...o,
    total_amount: parseFloat(o.total_amount) || 0,
    items: Array.isArray(o.items)
      ? o.items
      : typeof o.items === "string"
        ? JSON.parse(o.items || "[]")
        : [],
  };
}

// GET /api/orders (Role-filtered queries from Supabase DB)
router.get("/", async (req, res) => {
  try {
    const { userId, role, email } = req.query;

    let query = supabase.from("orders").select("*").order("created_at", { ascending: false });

    if (role === "user" && (userId || email)) {
      if (userId && email) {
        query = query.or(`user_id.eq.${userId},customer_email.eq.${email}`);
      } else if (userId) {
        query = query.eq("user_id", userId);
      } else {
        query = query.eq("customer_email", email);
      }
    } else if (role === "vendor" && userId) {
      query = query.eq("vendor_id", userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Supabase orders query error:", error);
      return res.status(500).json({ error: error.message });
    }

    res.json((data || []).map(formatOrder));
  } catch (err) {
    console.error("Orders route error:", err);
    res.status(500).json({ error: "Failed to fetch orders from database." });
  }
});

// POST /api/orders (Place new customer order)
// GET /api/orders/:id — the order the checkout just created. The confirmation
// screen needs one order, not the whole list.
router.get("/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) {
      console.error("Supabase order read error:", error.message);
      return res.status(500).json({ error: "Failed to fetch the order." });
    }
    if (!data) {
      return res.status(404).json({ error: "Order not found." });
    }

    res.json(formatOrder(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { userId, customerName, customerEmail, vendorId, items, totalAmount, shippingAddress } =
      req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Order items cannot be empty." });
    }

    const newOrderRecord = {
      user_id: userId || null,
      customer_name: customerName || "Customer",
      customer_email: customerEmail || "user@marvel.com",
      vendor_id: vendorId || null,
      items: items,
      total_amount: parseFloat(totalAmount) || 0,
      status: "processing",
      shipping_address: shippingAddress || "742 Evergreen Terrace, Springfield, OR",
      carrier: "Express Courier",
      tracking_number: `TRK-${Math.floor(100000 + Math.random() * 900000)}`,
    };

    const { data, error } = await supabase
      .from("orders")
      .insert([newOrderRecord])
      .select()
      .single();

    if (error) {
      console.error("Supabase insert order error:", error);
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ message: "Order placed successfully", order: formatOrder(data) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/orders/:id/status (Fulfillment update)
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, carrier, tracking_number } = req.body;

    const updates = {};
    if (status) updates.status = status;
    if (carrier) updates.carrier = carrier;
    if (tracking_number) updates.tracking_number = tracking_number;

    const { data, error } = await supabase
      .from("orders")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: "Order status updated in database", order: formatOrder(data) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------------------------------- */
/* Return requests (customer-side, after delivery)                            */
/* -------------------------------------------------------------------------- */

const RETURN_REASONS = ["damaged", "wrong_item", "changed_mind", "other"];
const RETURN_ERROR = "Could not save the return request.";

/** The caller's id, or null when the token carries no usable id. */
function callerId(req) {
  const id = req.user?.id;
  return typeof id === "string" && id.trim() !== "" ? id : null;
}

function unauthorized(res) {
  return res.status(401).json({ error: "Authentication required." });
}

/**
 * POST /api/orders/:id/return — `{ reason, notes }`.
 *
 * The order must belong to the caller: a request for someone else's order is
 * refused, not silently stored. The request itself is stored in the
 * `returns` table (docs/sql/apply-05-returns.sql).
 */
router.post("/:id/return", verifyToken, async (req, res) => {
  const userId = callerId(req);
  if (!userId) return unauthorized(res);

  const orderId = typeof req.params.id === "string" ? req.params.id.trim() : "";
  if (!orderId) {
    return res.status(400).json({ error: "Order id is required." });
  }

  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!RETURN_REASONS.includes(reason)) {
    return res.status(400).json({ error: "A valid return reason is required." });
  }
  const notes = typeof req.body?.notes === "string" ? req.body.notes : "";

  try {
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id")
      .eq("id", orderId)
      .eq("user_id", userId)
      .maybeSingle();

    if (orderError) {
      console.error("Supabase return-order lookup error:", orderError.message);
      return res.status(500).json({ error: RETURN_ERROR });
    }
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    const { data: created, error: insertError } = await supabase
      .from("returns")
      .insert([{ order_id: orderId, user_id: userId, reason, notes }])
      .select()
      .single();

    if (insertError) {
      console.error("Supabase return insert error:", insertError.message);
      return res.status(500).json({ error: RETURN_ERROR });
    }

    res.status(201).json({ return: created });
  } catch (err) {
    console.error("Returns POST route error:", err);
    res.status(500).json({ error: RETURN_ERROR });
  }
});

export default router;
