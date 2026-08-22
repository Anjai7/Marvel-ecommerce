import express from "express";
import { supabase } from "../db.js";
import { verifyToken, requireRole } from "../middleware/auth.js";

const router = express.Router();

// Helper to format order records
function formatOrder(o) {
  return {
    ...o,
    total_amount: parseFloat(o.total_amount) || 0,
    items: Array.isArray(o.items) ? o.items : typeof o.items === "string" ? JSON.parse(o.items || "[]") : []
  };
}

// GET /api/orders (Role-filtered queries from Supabase DB)
router.get("/", async (req, res) => {
  try {
    const { userId, role } = req.query;

    let query = supabase.from("orders").select("*").order("created_at", { ascending: false });

    if (role === "user" && userId) {
      query = query.eq("user_id", userId);
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
router.post("/", async (req, res) => {
  try {
    const { userId, customerName, customerEmail, vendorId, items, totalAmount, shippingAddress } = req.body;

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
      tracking_number: `TRK-${Math.floor(100000 + Math.random() * 900000)}`
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

export default router;
