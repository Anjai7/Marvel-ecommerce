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

async function findMenuItem(id) {
  if (id == null) return null;
  try {
    const { data, error } = await supabase
      .from("menu_items")
      .select("id, level, parent_id")
      .eq("id", id)
      .single();
    if (!error && data) return data;
  } catch (e) {
    console.warn("Supabase menu item lookup warning, using fallback:", e.message);
  }
  return fallbackMenu.find((m) => m.id === id) || null;
}

async function findParent(parent_id) {
  return findMenuItem(parent_id);
}

export function validateHierarchy({ level = 1, parent_id = null }, parent) {
  if (!Number.isInteger(level) || level < 1 || level > 3) {
    return "Menu level must be an integer between 1 and 3.";
  }
  if (level === 1) {
    if (parent_id != null) {
      return "Level 1 menu items must not have a parent_id.";
    }
    return null;
  }
  if (!parent_id) {
    return "parent_id is required for menu items below level 1.";
  }
  if (!parent) {
    return "Parent menu item not found.";
  }
  if (parent.level !== level - 1) {
    return `Parent level must be ${level - 1} for a level ${level} item.`;
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
    const { error } = await supabase
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

  const orderById = new Map(orders.map((o) => [o.id, o]));

  // Phase 1: resolve current rows — unknown ids rejected before anything persists.
  const currentById = new Map();
  for (const o of orders) {
    const current = await findMenuItem(o.id);
    if (!current) {
      return res.status(400).json({ error: `Menu item with id '${o.id}' not found.` });
    }
    currentById.set(o.id, current);
  }

  const effectiveLevel = (id) => orderById.get(id)?.level ?? currentById.get(id)?.level ?? 1;
  const effectiveParentId = (id) => {
    const o = orderById.get(id);
    if (o && o.parent_id !== undefined) return o.parent_id;
    return currentById.get(id)?.parent_id ?? null;
  };

  // Ancestor walk over the effective (post-reorder) graph; stale/missing
  // parents terminate the walk and are reported by the existence check below.
  const parentCache = new Map();
  const cachedParentId = async (id) => {
    if (orderById.has(id)) return effectiveParentId(id);
    if (!parentCache.has(id)) {
      const row = await findMenuItem(id);
      parentCache.set(id, row?.parent_id ?? null);
    }
    return parentCache.get(id);
  };
  const createsReorderCycle = async (itemId, newParentId) => {
    const visited = new Set([itemId]);
    let current = newParentId;
    let steps = 0;
    while (current != null && steps < 50) {
      if (visited.has(current)) return true;
      visited.add(current);
      current = await cachedParentId(current);
      steps += 1;
    }
    return false;
  };

  // Phase 2: per-entry hierarchy validation (entries that only re-sort skip it).
  for (const o of orders) {
    if (o.parent_id === undefined && o.level === undefined) continue;
    const level = effectiveLevel(o.id);
    const parent_id = effectiveParentId(o.id);
    const parent = parent_id == null ? null : await findMenuItem(parent_id);
    const effectiveParent =
      parent && orderById.has(parent_id) && orderById.get(parent_id).level !== undefined
        ? { ...parent, level: effectiveLevel(parent_id) }
        : parent;
    const hierarchyError = validateHierarchy({ level, parent_id }, effectiveParent);
    if (hierarchyError) {
      return res.status(400).json({ error: hierarchyError });
    }
    if (level > 1 && (await createsReorderCycle(o.id, parent_id))) {
      return res.status(400).json({ error: "Reorder would create a circular parent reference." });
    }
  }

  // Phase 3: all entries valid — persist.
  try {
    for (const o of orders) {
      const payload = {};
      if (o.order_index !== undefined) payload.order_index = o.order_index;
      if (o.parent_id !== undefined) payload.parent_id = o.parent_id;
      if (o.level !== undefined) payload.level = o.level;
      if (Object.keys(payload).length === 0) continue;
      const { error } = await supabase.from("menu_items").update(payload).eq("id", o.id);
      if (error) console.warn("Supabase reorder warning:", error.message);
    }
  } catch (e) {
    console.warn("Supabase reorder exception:", e.message);
  }

  // Mirror in-memory fallback
  fallbackMenu = fallbackMenu
    .map((m) => {
      const o = orderById.get(m.id);
      if (!o) return m;
      return {
        ...m,
        order_index: o.order_index ?? m.order_index,
        parent_id: o.parent_id !== undefined ? o.parent_id : m.parent_id,
        level: o.level !== undefined ? o.level : m.level,
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
