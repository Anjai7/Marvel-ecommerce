import express from "express";
import { supabase } from "../db.js";
import { adminGuards } from "../lib/guards.js";

const router = express.Router();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const SELECT_COLUMNS = "id, action, entity, entity_id, details, actor_id, actor_email, created_at";

/**
 * GET /api/admin/audit?limit=50 — the admin-only read side of the audit log.
 *
 * The rows are read newest first and the limit is clamped, so a caller can ask
 * for more without ever asking for an unbounded pull.
 */
router.get("/", ...adminGuards, async (req, res) => {
  try {
    const parsed = Number(req.query.limit);
    const limit =
      Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, MAX_LIMIT) : DEFAULT_LIMIT;

    const { data, error } = await supabase
      .from("admin_audit_log")
      .select(SELECT_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Supabase admin_audit_log read error:", error.message);
      return res.status(500).json({ error: "Could not load the audit log." });
    }

    res.json({ entries: data ?? [] });
  } catch (err) {
    console.error("Admin audit GET route error:", err);
    res.status(500).json({ error: "Could not load the audit log." });
  }
});

export default router;
