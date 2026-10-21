import express from "express";
import { supabase } from "../db.js";

const router = express.Router();

const READ_ERROR = "Could not load settings.";

/**
 * GET /api/settings — public, no auth.
 *
 * Returns the stored `site_settings` rows as a flat `key -> value` map. A key
 * with no row is omitted; the value is the stored JSONB untouched, so a
 * configured JSON `null` stays `null` rather than becoming a placeholder.
 */
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase.from("site_settings").select("key, value");

    if (error) {
      console.error("Supabase site_settings read error:", error.message);
      return res.status(500).json({ error: READ_ERROR });
    }

    const settings = {};
    for (const row of data ?? []) {
      if (row && typeof row.key === "string" && row.key !== "") {
        settings[row.key] = row.value;
      }
    }

    res.json({ settings });
  } catch (err) {
    console.error("Settings GET route error:", err);
    res.status(500).json({ error: READ_ERROR });
  }
});

export default router;
