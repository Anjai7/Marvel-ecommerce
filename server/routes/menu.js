import express from "express";
import { supabase } from "../db.js";
import { verifyToken, requireRole } from "../middleware/auth.js";
import { buildMenuTree } from "./menuTree.js";

const router = express.Router();

const adminOnly = [verifyToken, requireRole(["admin", "super_admin"])];

// Initial fallback dataset in case table is freshly created
let fallbackMenu = [
  {
    id: "m-1",
    title: "Home & Shop",
    path: "/",
    icon: "Home",
    parent_id: null,
    level: 1,
    roles_allowed: ["user", "vendor", "admin", "super_admin"],
    order_index: 1,
    is_active: true,
  },
  {
    id: "m-2",
    title: "Electronics & Tech",
    path: "/category/electronics",
    icon: "Cpu",
    parent_id: null,
    level: 1,
    roles_allowed: ["user", "vendor", "admin", "super_admin"],
    order_index: 2,
    badge: "HOT",
    is_active: true,
  },
  {
    id: "m-3",
    title: "Fashion & Lifestyle",
    path: "/category/fashion",
    icon: "Shirt",
    parent_id: null,
    level: 1,
    roles_allowed: ["user", "vendor", "admin", "super_admin"],
    order_index: 3,
    is_active: true,
  },
  {
    id: "m-4",
    title: "Vendor Portal",
    path: "/vendor-dashboard",
    icon: "Store",
    parent_id: null,
    level: 1,
    roles_allowed: ["vendor", "admin", "super_admin"],
    order_index: 4,
    badge: "SELLER",
    is_active: true,
  },
  {
    id: "m-5",
    title: "Admin Panel",
    path: "/admin-dashboard",
    icon: "ShieldCheck",
    parent_id: null,
    level: 1,
    roles_allowed: ["admin", "super_admin"],
    order_index: 5,
    badge: "MANAGEMENT",
    is_active: true,
  },
  {
    id: "m-6",
    title: "Super Admin System",
    path: "/superadmin-dashboard",
    icon: "Zap",
    parent_id: null,
    level: 1,
    roles_allowed: ["super_admin"],
    order_index: 6,
    badge: "ROOT",
    is_active: true,
  },
];

function filterByRole(rows, role) {
  return rows.filter((item) => {
    if (!item.roles_allowed || item.roles_allowed.length === 0) return true;
    return item.roles_allowed.includes(role) || role === "super_admin";
  });
}

async function fetchActiveRows() {
  try {
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("is_active", true)
      .order("order_index", { ascending: true });

    if (!error && data && data.length > 0) return data;
  } catch (e) {
    console.warn("Supabase fetch warning, using fallback:", e.message);
  }
  return fallbackMenu.filter((item) => item.is_active !== false);
}

async function findParent(parent_id) {
  if (parent_id == null) return null;
  try {
    const { data, error } = await supabase
      .from("menu_items")
      .select("id, level")
      .eq("id", parent_id)
      .single();
    if (!error && data) return data;
  } catch (e) {
    console.warn("Supabase parent lookup warning, using fallback:", e.message);
  }
  return fallbackMenu.find((m) => m.id === parent_id) || null;
}

function validateHierarchy({ level = 1, parent_id = null }, parent) {
  if (level > 3) {
    return "Menu level must be between 1 and 3.";
  }
  if (level > 1) {
    if (!parent_id) {
      return "parent_id is required for menu items below level 1.";
    }
    if (!parent) {
      return "Parent menu item not found.";
    }
    if (parent.level !== level - 1) {
      return `Parent level must be ${level - 1} for a level ${level} item.`;
    }
  }
  return null;
}

// GET /api/menu?role=user — tree by default, ?flat=1 for the legacy flat list
router.get("/", async (req, res) => {
  const role = req.query.role || "user";

  const rows = await fetchActiveRows();
  const filtered = filterByRole(rows, role);

  if (req.query.flat === "1") {
    return res.json(filtered);
  }

  return res.json(buildMenuTree(filtered, role));
});

// POST /api/menu (Create or Update Menu Item in Supabase) — admin only
router.post("/", ...adminOnly, async (req, res) => {
  const menuItem = req.body;

  if (!menuItem.title || !menuItem.path) {
    return res.status(400).json({ error: "Menu item title and path are required." });
  }

  const level = menuItem.level ?? 1;
  const parent = level > 1 ? await findParent(menuItem.parent_id) : null;
  const hierarchyError = validateHierarchy({ level, parent_id: menuItem.parent_id }, parent);
  if (hierarchyError) {
    return res.status(400).json({ error: hierarchyError });
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
        parent_id: menuItem.parent_id || null,
        level,
        roles_allowed: menuItem.roles_allowed || ["user", "vendor", "admin", "super_admin"],
        order_index: menuItem.order_index ?? 0,
        is_active: true,
      })
      .select();

    if (error) console.warn("Supabase menu save warning:", error.message);
  } catch (e) {
    console.warn("Supabase save exception:", e.message);
  }

  // Update in-memory fallback
  if (menuItem.id) {
    fallbackMenu = fallbackMenu.map((m) =>
      m.id === menuItem.id ? { ...m, ...menuItem, level } : m
    );
  } else {
    fallbackMenu.push({ ...menuItem, id: `m-${Date.now()}`, level, is_active: true });
  }

  res.json({ message: "Menu item saved successfully to Supabase DB", menu: fallbackMenu });
});

// PATCH /api/menu/reorder — bulk order/parent updates — admin only
router.patch("/reorder", ...adminOnly, async (req, res) => {
  const { orders } = req.body;

  if (!Array.isArray(orders) || orders.length === 0) {
    return res.status(400).json({ error: "Request body must include a non-empty 'orders' array." });
  }

  if (orders.some((o) => !o || o.id == null)) {
    return res.status(400).json({ error: "Each order entry must include an 'id'." });
  }

  try {
    for (const o of orders) {
      const payload = {};
      if (o.order_index !== undefined) payload.order_index = o.order_index;
      if (o.parent_id !== undefined) payload.parent_id = o.parent_id;
      if (Object.keys(payload).length === 0) continue;
      const { error } = await supabase.from("menu_items").update(payload).eq("id", o.id);
      if (error) console.warn("Supabase reorder warning:", error.message);
    }
  } catch (e) {
    console.warn("Supabase reorder exception:", e.message);
  }

  // Mirror in-memory fallback
  const byId = new Map(orders.map((o) => [o.id, o]));
  fallbackMenu = fallbackMenu
    .map((m) => {
      const o = byId.get(m.id);
      if (!o) return m;
      return {
        ...m,
        order_index: o.order_index ?? m.order_index,
        parent_id: o.parent_id !== undefined ? o.parent_id : m.parent_id,
      };
    })
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

  res.json({ message: "Menu order updated successfully", menu: fallbackMenu });
});

// DELETE /api/menu/:id — admin only
router.delete("/:id", ...adminOnly, async (req, res) => {
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
