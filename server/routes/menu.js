import express from "express";
import { supabase } from "../db.js";

const router = express.Router();

// Initial fallback dataset in case table is freshly created
let fallbackMenu = [
  { id: "m-1", title: "Home & Shop", path: "/", icon: "Home", roles_allowed: ["user", "vendor", "admin", "super_admin"], order_index: 1, is_active: true },
  { id: "m-2", title: "Electronics & Tech", path: "/category/electronics", icon: "Cpu", roles_allowed: ["user", "vendor", "admin", "super_admin"], order_index: 2, badge: "HOT", is_active: true },
  { id: "m-3", title: "Fashion & Lifestyle", path: "/category/fashion", icon: "Shirt", roles_allowed: ["user", "vendor", "admin", "super_admin"], order_index: 3, is_active: true },
  { id: "m-4", title: "Vendor Portal", path: "/vendor-dashboard", icon: "Store", roles_allowed: ["vendor", "admin", "super_admin"], order_index: 4, badge: "SELLER", is_active: true },
  { id: "m-5", title: "Admin Panel", path: "/admin-dashboard", icon: "ShieldCheck", roles_allowed: ["admin", "super_admin"], order_index: 5, badge: "MANAGEMENT", is_active: true },
  { id: "m-6", title: "Super Admin System", path: "/superadmin-dashboard", icon: "Zap", roles_allowed: ["super_admin"], order_index: 6, badge: "ROOT", is_active: true }
];

// GET /api/menu?role=user
router.get("/", async (req, res) => {
  const role = req.query.role || "user";

  try {
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("is_active", true)
      .order("order_index", { ascending: true });

    if (!error && data && data.length > 0) {
      const filtered = data.filter((item) => {
        if (!item.roles_allowed || item.roles_allowed.length === 0) return true;
        return item.roles_allowed.includes(role) || role === "super_admin";
      });
      return res.json(filtered);
    }
  } catch (e) {
    console.warn("Supabase fetch warning, using fallback:", e.message);
  }

  // Fallback filtering
  const filtered = fallbackMenu.filter((item) => {
    if (!item.is_active) return false;
    if (!item.roles_allowed || item.roles_allowed.length === 0) return true;
    return item.roles_allowed.includes(role) || role === "super_admin";
  });

  res.json(filtered);
});

// POST /api/menu (Create or Update Menu Item in Supabase)
router.post("/", async (req, res) => {
  const menuItem = req.body;

  if (!menuItem.title || !menuItem.path) {
    return res.status(400).json({ error: "Menu item title and path are required." });
  }

  try {
    const { data, error } = await supabase
      .from("menu_items")
      .upsert({
        id: menuItem.id || undefined,
        title: menuItem.title,
        path: menuItem.path,
        icon: menuItem.icon || "Layers",
        badge: menuItem.badge || null,
        roles_allowed: menuItem.roles_allowed || ["user", "vendor", "admin", "super_admin"],
        is_active: true
      })
      .select();

    if (error) console.warn("Supabase menu save warning:", error.message);
  } catch (e) {
    console.warn("Supabase save exception:", e.message);
  }

  // Update in-memory fallback
  if (menuItem.id) {
    fallbackMenu = fallbackMenu.map((m) => (m.id === menuItem.id ? { ...m, ...menuItem } : m));
  } else {
    fallbackMenu.push({ ...menuItem, id: `m-${Date.now()}`, is_active: true });
  }

  res.json({ message: "Menu item saved successfully to Supabase DB", menu: fallbackMenu });
});

// DELETE /api/menu/:id
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await supabase.from("menu_items").delete().eq("id", id);
  } catch (e) {
    console.warn("Supabase delete warning:", e.message);
  }

  fallbackMenu = fallbackMenu.filter((m) => m.id !== id);
  res.json({ message: "Menu item deleted from Supabase DB", menu: fallbackMenu });
});

export default router;
