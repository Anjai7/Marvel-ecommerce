import express from "express";
import { supabase } from "../db.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

/**
 * The signed-in customer's cart, mirrored server-side.
 *
 * apply-10 creates the table. Until it is applied every route degrades to a
 * harmless empty answer or a no-op, so shopping never depends on a pending
 * migration. The browser keeps its own copy either way.
 */
router.use(verifyToken);

function callerId(req) {
  const id = req.user?.id;
  return typeof id === "string" && id.trim() !== "" ? id : null;
}

function missingTable(error) {
  const message = String(error?.message ?? "");
  return /user_carts/i.test(message) || /does not exist|schema cache/i.test(message);
}

router.get("/", async (req, res) => {
  const userId = callerId(req);
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  try {
    const { data, error } = await supabase
      .from("user_carts")
      .select("items")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      if (missingTable(error)) return res.json({ items: [] });
      console.error("Supabase cart read error:", error.message);
      return res.status(500).json({ error: "Could not load the cart." });
    }
    res.json({ items: Array.isArray(data?.items) ? data.items : [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/", async (req, res) => {
  const userId = callerId(req);
  if (!userId) return res.status(401).json({ error: "Authentication required." });
  const items = Array.isArray(req.body?.items) ? req.body.items : [];

  try {
    const { error } = await supabase
      .from("user_carts")
      .upsert(
        { user_id: userId, items, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    if (error) {
      if (missingTable(error)) return res.json({ saved: false });
      console.error("Supabase cart write error:", error.message);
      return res.status(500).json({ error: "Could not save the cart." });
    }
    res.json({ saved: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/", async (req, res) => {
  const userId = callerId(req);
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  try {
    const { error } = await supabase.from("user_carts").delete().eq("user_id", userId);
    if (error) {
      if (missingTable(error)) return res.json({ cleared: false });
      console.error("Supabase cart clear error:", error.message);
      return res.status(500).json({ error: "Could not clear the cart." });
    }
    res.json({ cleared: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
