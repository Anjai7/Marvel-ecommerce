import express from "express";
import { supabase } from "../db.js";

const router = express.Router();

// GET /api/users (Query live registered user profiles from Supabase DB)
router.get("/", async (req, res) => {
  try {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, store_name, status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(profiles || []);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users from database." });
  }
});

// PUT /api/users/:id/role (Super Admin promotion/demotion in Supabase DB)
router.put("/:id/role", async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  const validRoles = ["user", "vendor", "admin", "super_admin"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: `Invalid role '${role}'. Allowed roles: ${validRoles.join(", ")}` });
  }

  try {
    // 1. Update Supabase profiles table
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (profileError) {
      return res.status(500).json({ error: profileError.message });
    }

    // 2. Also update Supabase auth metadata if user exists in auth
    try {
      await supabase.auth.admin.updateUserById(id, {
        user_metadata: { role }
      });
    } catch (_) {}

    // Return refreshed users list
    const { data: updatedProfiles } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, store_name, status, created_at")
      .order("created_at", { ascending: false });

    res.json({ message: "Role updated successfully in database", users: updatedProfiles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
