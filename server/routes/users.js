import express from "express";
import { supabase } from "../db.js";
import { verifyToken, requireRole } from "../middleware/auth.js";

const router = express.Router();

// Helper to format user objects with enterprise plan, billing, and avatar info
function formatUserProfile(p) {
  // Derive synthetic plan and billing if not explicitly stored
  let plan = p.plan;
  if (!plan) {
    if (p.role === "admin" || p.role === "super_admin") plan = "Enterprise";
    else if (p.role === "vendor") plan = "Team";
    else plan = "Basic";
  }

  let billing = p.billing;
  if (!billing) {
    if (p.role === "admin" || p.role === "super_admin") billing = "Auto Debit";
    else if (p.role === "vendor") billing = "Manual - Paypal";
    else billing = "Auto Debit";
  }

  const status = p.status || "active";

  return {
    id: p.id,
    email: p.email,
    full_name: p.full_name || p.email.split("@")[0],
    role: p.role || "user",
    store_name: p.store_name || null,
    plan,
    billing,
    status,
    created_at: p.created_at || new Date().toISOString()
  };
}

// GET /api/users (Query live registered user profiles from Supabase DB)
router.get("/", async (req, res) => {
  try {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const formatted = (profiles || []).map(formatUserProfile);
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users from database." });
  }
});

// POST /api/users/admin-create (Admin/SuperAdmin creates new Admin/Vendor/User account)
router.post("/admin-create", verifyToken, requireRole(["admin", "super_admin"]), async (req, res) => {
  const {
    email,
    password,
    fullName,
    role = "admin",
    storeName = "",
    plan = "Enterprise",
    billing = "Auto Debit",
    status = "active"
  } = req.body;

  if (!email || !password || !fullName) {
    return res.status(400).json({ error: "Full name, email, and initial password are required." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long." });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role,
        store_name: role === "vendor" ? (storeName || `${fullName}'s Store`) : null,
        plan,
        billing
      }
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    const userId = authData.user.id;
    const resolvedStore = role === "vendor" ? (storeName || `${fullName}'s Store`) : null;

    // 2. Insert into PostgreSQL profiles table
    const profileRecord = {
      id: userId,
      email: cleanEmail,
      full_name: fullName,
      role,
      store_name: resolvedStore,
      status,
      updated_at: new Date().toISOString()
    };

    const { data: newProfile, error: profileErr } = await supabase
      .from("profiles")
      .upsert(profileRecord)
      .select()
      .single();

    if (profileErr) {
      console.warn("Profile upsert warning:", profileErr.message);
    }

    const createdUser = formatUserProfile({
      ...(newProfile || profileRecord),
      plan,
      billing,
      status
    });

    res.status(201).json({
      message: `Account for ${fullName} (${role.toUpperCase()}) created successfully.`,
      user: createdUser
    });
  } catch (err) {
    console.error("Admin create user error:", err);
    res.status(500).json({ error: err.message || "Failed to create account." });
  }
});

// POST /api/users/:id/reset-password (Admin-initiated password reset)
router.post("/:id/reset-password", verifyToken, requireRole(["admin", "super_admin"]), async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters long." });
  }

  try {
    const { error: updateErr } = await supabase.auth.admin.updateUserById(id, {
      password: newPassword
    });

    if (updateErr) {
      return res.status(500).json({ error: updateErr.message });
    }

    res.json({ message: "User password has been successfully reset." });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to reset user password." });
  }
});

// PUT /api/users/:id/status (Update user status: active, inactive, pending)
router.put("/:id/status", verifyToken, requireRole(["admin", "super_admin"]), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ["active", "inactive", "pending", "banned"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status '${status}'. Allowed: ${validStatuses.join(", ")}` });
  }

  try {
    const { error } = await supabase
      .from("profiles")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: `User status set to ${status.toUpperCase()}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id/role (Super Admin / Admin role elevation in DB)
router.put("/:id/role", verifyToken, requireRole(["admin", "super_admin"]), async (req, res) => {
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

    // 2. Update Supabase auth metadata
    try {
      await supabase.auth.admin.updateUserById(id, {
        user_metadata: { role }
      });
    } catch (_) {}

    // Return refreshed users list
    const { data: updatedProfiles } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    const formatted = (updatedProfiles || []).map(formatUserProfile);
    res.json({ message: `Role updated to ${role.toUpperCase()}`, users: formatted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id (Delete user account from system)
router.delete("/:id", verifyToken, requireRole(["admin", "super_admin"]), async (req, res) => {
  const { id } = req.params;

  try {
    // Delete from profiles
    await supabase.from("profiles").delete().eq("id", id);

    // Delete from Auth
    try {
      await supabase.auth.admin.deleteUser(id);
    } catch (_) {}

    res.json({ message: "User account deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to delete user." });
  }
});

export default router;
