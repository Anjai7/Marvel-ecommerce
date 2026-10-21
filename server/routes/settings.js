import express from "express";
import { supabase } from "../db.js";
import { adminGuards } from "../lib/guards.js";
import { SETTINGS_GROUPS, SETTINGS_KEYS } from "../lib/settings.js";

const router = express.Router();

const READ_ERROR = "Could not load settings.";
const WRITE_ERROR = "Could not save settings.";
const INVALID_KEY = "Unknown settings key.";

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

/**
 * PUT /api/settings — admin only.
 *
 * Body: `{ settings: { <key>: <value> } }`. Every key must be one the store
 * knows about, so a typo cannot create a row nothing reads. A key whose value
 * is `null` removes the row, which is how an optional block is turned off.
 */
router.put("/", ...adminGuards, async (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const incoming = body.settings && typeof body.settings === "object" ? body.settings : null;

  if (!incoming) {
    return res.status(400).json({ error: "Body must carry a `settings` object." });
  }

  const keys = Object.keys(incoming);
  const unknown = keys.filter((key) => !SETTINGS_KEYS.includes(key));
  if (unknown.length > 0) {
    return res.status(400).json({ error: INVALID_KEY, keys: unknown });
  }

  try {
    const rows = [];
    for (const key of keys) {
      const value = incoming[key];
      if (value === null) {
        // A null value means "not configured": drop the row entirely.
        const { error } = await supabase.from("site_settings").delete().eq("key", key);
        if (error) throw new Error(error.message);
        continue;
      }
      rows.push({ key, value, group_name: SETTINGS_GROUPS[key] ?? "general" });
    }

    if (rows.length > 0) {
      const { error } = await supabase.from("site_settings").upsert(rows, { onConflict: "key" });
      if (error) throw new Error(error.message);
    }

    const { data, error: readError } = await supabase.from("site_settings").select("key, value");
    if (readError) throw new Error(readError.message);

    const settings = {};
    for (const row of data ?? []) {
      if (row && typeof row.key === "string" && row.key !== "") {
        settings[row.key] = row.value;
      }
    }

    res.json({ settings });
  } catch (err) {
    console.error("Settings PUT route error:", err);
    res.status(500).json({ error: WRITE_ERROR });
  }
});

export default router;
