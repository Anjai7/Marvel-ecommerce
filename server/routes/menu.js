import express from "express";
import { supabase } from "../db.js";
import { createCrudRouter, applyReorder } from "../lib/crudRouter.js";
import {
  adminGuards,
  includesInactive,
  inactiveRefused,
  isValidOrderValue,
  ORDER_INTEGER_MESSAGE,
} from "../lib/guards.js";
import { buildMenuTree } from "./menuTree.js";

const adminOnly = adminGuards;
const router = express.Router();

const READ_ERROR = "Could not load content.";
const SAVE_ERROR = "Failed to save menu item.";
const SAVE_MESSAGE = "Menu item saved successfully.";
const DELETE_ERROR = "Failed to delete menu item.";
const REORDER_ERROR = "Reorder must include every item in the scope.";
const REORDER_FAILED = "Failed to reorder menu items.";
const CATEGORY_NOT_FOUND = "Category not found.";
const NOT_FOUND = "item not found.";
const DEFAULT_ROLES = ["user", "vendor", "admin", "super_admin"];

const FIELDS = [
  "title",
  "path",
  "icon",
  "parent_id",
  "level",
  "section",
  "section_icon",
  "badge",
  "badge_variant",
  "roles_allowed",
  "order_index",
  "is_active",
  "promo_title",
  "promo_subtitle",
  "promo_image_url",
  "promo_cta_text",
  "promo_cta_path",
  "category_id",
];

/**
 * Menu-specific depth validation. Exported because menuTree.test.js imports it
 * and because the spec keeps the menu-flavoured error strings in this router
 * rather than in the shared validation module (ruling R18).
 */
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

function filterByRole(rows, role) {
  return rows.filter((item) => {
    if (!role || role === "super_admin") return true;
    if (!item.roles_allowed || item.roles_allowed.length === 0) return true;
    return item.roles_allowed.includes(role);
  });
}

/** Look up a `categories` row by id; `{ error: true }` means a database failure. */
async function loadCategory(categoryId) {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .eq("id", categoryId)
    .maybeSingle();
  if (error) return { error: true };
  return { category: data ?? null };
}

/** Resolve a would-be parent row; `{ error: true }` means a database failure. */
async function loadParent(level, parentId) {
  if (level <= 1 || parentId == null) return { parent: null };
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, level")
    .eq("id", parentId)
    .maybeSingle();
  if (error) return { error: true };
  return { parent: data ?? null };
}

/**
 * The effective hierarchy for a PATCH, resolved before the factory validates.
 * A symbol keeps it off the JSON body and out of the write set.
 */
const MENU_CONTEXT = Symbol("menuContext");

function validateMenuRow(body = {}, opts = {}) {
  const partial = opts.partial === true;
  if (!partial && (!body.title || !body.path)) {
    return "Menu item title and path are required.";
  }

  const context = body[MENU_CONTEXT];
  if (context) {
    const hierarchyError = validateHierarchy(
      { level: context.level, parent_id: context.parent_id },
      context.parent
    );
    if (hierarchyError) return hierarchyError;
  }

  if (Object.hasOwn(body, "order_index") && !isValidOrderValue(body.order_index)) {
    return ORDER_INTEGER_MESSAGE;
  }
  return null;
}

/** Body-present keys only: a PATCH never nulls a field the client omitted. */
function toPayload(body = {}) {
  const payload = {};
  for (const field of FIELDS) {
    if (Object.hasOwn(body, field) && body[field] !== undefined) payload[field] = body[field];
  }
  if (payload.order_index !== undefined) payload.order_index = Number(payload.order_index);
  return payload;
}

/** Guard, then resolve the effective parent and the referenced category. */
async function prepareMenuPatch(req, res, next) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  req.body = body;

  try {
    const hasParent = Object.hasOwn(body, "parent_id");
    const hasLevel = Object.hasOwn(body, "level");

    if (hasParent || hasLevel) {
      const { data: existing, error } = await supabase
        .from("menu_items")
        .select("id, level, parent_id")
        .eq("id", req.params.id)
        .maybeSingle();
      if (error) return res.status(500).json({ error: SAVE_ERROR });
      if (!existing) return res.status(404).json({ error: NOT_FOUND });

      const level = hasLevel ? body.level : existing.level;
      const parentId = hasParent ? body.parent_id : existing.parent_id;
      const { parent, error: parentError } = await loadParent(level, parentId);
      if (parentError) return res.status(500).json({ error: SAVE_ERROR });

      body[MENU_CONTEXT] = { level, parent_id: parentId ?? null, parent };
    }

    if (Object.hasOwn(body, "category_id") && body.category_id != null) {
      const { category, error } = await loadCategory(body.category_id);
      if (error) return res.status(500).json({ error: SAVE_ERROR });
      if (!category) return res.status(400).json({ error: CATEGORY_NOT_FOUND });
    }

    return next();
  } catch (thrown) {
    console.error("Supabase menu patch preparation exception:", thrown.message);
    return res.status(500).json({ error: SAVE_ERROR });
  }
}

// GET /api/menu — bare-array tree by default, ?flat=1 for the legacy flat list.
// The menu is the one documented exception to the wrapped-list convention (§4.1).
router.get("/", async (req, res) => {
  const role =
    typeof req.query.role === "string" && req.query.role !== "" ? req.query.role : "user";
  const withInactive = await includesInactive(req, res);
  if (!withInactive && inactiveRefused(req, res)) return undefined;

  try {
    let query = supabase.from("menu_items").select("*");
    if (!withInactive) query = query.eq("is_active", true);

    const { data, error } = await query
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Supabase menu list error:", error.message);
      return res.status(500).json({ error: READ_ERROR });
    }

    const rows = data ?? [];
    // An admin asking for inactive rows is editing the menu: the role filter
    // must not then hide rows their own role would not see on the storefront.
    const treeRole = withInactive ? undefined : role;
    if (req.query.flat === "1") {
      const visible = withInactive ? rows : rows.filter((row) => row.is_active !== false);
      return res.json(filterByRole(visible, treeRole));
    }

    return res.json(buildMenuTree(rows, { role: treeRole, includeInactive: withInactive }));
  } catch (thrown) {
    console.error("Supabase menu list exception:", thrown.message);
    return res.status(500).json({ error: READ_ERROR });
  }
});

// Before PATCH /:id, or "reorder" is captured as an id.
router.patch("/reorder", ...adminOnly, async (req, res) => {
  const orders = req.body?.orders;
  const ids = Array.isArray(orders)
    ? orders.map((order) => (order && typeof order === "object" ? order.id : undefined))
    : [];

  if (
    !Array.isArray(orders) ||
    orders.length === 0 ||
    ids.some((id) => typeof id !== "string" || id === "")
  ) {
    return res.status(400).json({ error: REORDER_ERROR });
  }

  try {
    const { data, error } = await supabase
      .from("menu_items")
      .select("id, parent_id, level, order_index");
    if (error) {
      console.error("Supabase menu reorder read error:", error.message);
      return res.status(500).json({ error: READ_ERROR });
    }

    const rows = data ?? [];
    const rowsById = new Map(rows.map((row) => [row.id, row]));
    const selected = ids.map((id) => rowsById.get(id));
    if (selected.some((row) => !row)) {
      return res.status(400).json({ error: REORDER_ERROR });
    }

    // The scope is one sibling group: a body that mixes parents is rejected.
    const parents = new Set(selected.map((row) => row.parent_id ?? null));
    if (parents.size !== 1) return res.status(400).json({ error: REORDER_ERROR });

    const parentId = [...parents][0];
    const scope = rows.filter((row) => (row.parent_id ?? null) === parentId);
    const { renumbered, error: reorderError } = applyReorder(
      scope.map((row) => row.id),
      orders
    );
    if (reorderError) return res.status(400).json({ error: reorderError });

    const orderById = new Map(orders.map((order) => [order.id, order]));

    // An entry may also move the row: validate the resulting hierarchy and
    // reject a cycle before anything is written.
    const effectiveParentId = (id) => {
      const entry = orderById.get(id);
      if (entry && entry.parent_id !== undefined) return entry.parent_id ?? null;
      return rowsById.get(id)?.parent_id ?? null;
    };
    const createsCycle = (itemId, newParentId) => {
      const visited = new Set([itemId]);
      let current = newParentId;
      let steps = 0;
      while (current != null && steps < 50) {
        if (visited.has(current)) return true;
        visited.add(current);
        current = effectiveParentId(current);
        steps += 1;
      }
      return false;
    };

    for (const order of orders) {
      if (order.parent_id === undefined && order.level === undefined) continue;
      const current = rowsById.get(order.id);
      const level = order.level !== undefined ? order.level : current.level;
      const nextParentId = order.parent_id !== undefined ? order.parent_id : current.parent_id;
      const storedParent = nextParentId == null ? null : (rowsById.get(nextParentId) ?? null);
      const effectiveParent =
        storedParent && orderById.get(nextParentId)?.level !== undefined
          ? { ...storedParent, level: orderById.get(nextParentId).level }
          : storedParent;

      const hierarchyError = validateHierarchy({ level, parent_id: nextParentId }, effectiveParent);
      if (hierarchyError) return res.status(400).json({ error: hierarchyError });
      if (level > 1 && createsCycle(order.id, nextParentId)) {
        return res.status(400).json({ error: "Reorder would create a circular parent reference." });
      }
    }

    // Array order is authoritative: the renumbered values go to order_index,
    // the column buildMenuTree and GET /api/menu already sort by (§3.6).
    const writes = new Map();
    for (const entry of renumbered) {
      const original = orderById.get(entry.id);
      const patch = { order_index: entry.display_order };
      if (original.parent_id !== undefined) patch.parent_id = original.parent_id;
      if (original.level !== undefined) patch.level = original.level;
      writes.set(entry.id, patch);
    }

    // A moved row joins a different sibling group, so that group is renumbered
    // too: existing siblings keep their order and the movers are appended. Two
    // siblings must never end up sharing an order_index.
    const movedTo = new Map();
    for (const order of orders) {
      if (order.parent_id === undefined) continue;
      const destination = order.parent_id ?? null;
      if (destination === parentId) continue;
      const movedIds = movedTo.get(destination) ?? [];
      movedIds.push(order.id);
      movedTo.set(destination, movedIds);
    }

    const orderValue = (row) =>
      Number.isFinite(Number(row.order_index)) ? Number(row.order_index) : 0;
    for (const [destination, movedIds] of movedTo) {
      const siblings = rows
        .filter((row) => (row.parent_id ?? null) === destination && !movedIds.includes(row.id))
        .sort(
          (left, right) =>
            orderValue(left) - orderValue(right) || String(left.id).localeCompare(String(right.id))
        );

      [...siblings.map((row) => row.id), ...movedIds].forEach((id, index) => {
        writes.set(id, { ...(writes.get(id) ?? {}), order_index: index });
      });
    }

    for (const [id, patch] of writes) {
      const { error: updateError } = await supabase
        .from("menu_items")
        .update(patch)
        .eq("id", id);
      if (updateError) {
        console.error("Supabase menu reorder update error:", updateError.message);
        return res.status(500).json({ error: REORDER_FAILED });
      }
    }

    return res.json({ message: "Menu order updated successfully." });
  } catch (thrown) {
    console.error("Supabase menu reorder exception:", thrown.message);
    return res.status(500).json({ error: REORDER_FAILED });
  }
});

// POST /api/menu — upsert by id, always answering with the persisted row.
router.post("/", ...adminOnly, async (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};

  if (!body.title || !body.path) {
    return res.status(400).json({ error: "Menu item title and path are required." });
  }
  if (Object.hasOwn(body, "order_index") && !isValidOrderValue(body.order_index)) {
    return res.status(400).json({ error: ORDER_INTEGER_MESSAGE });
  }

  const wantsUpdate = body.id !== undefined && body.id !== null;

  try {
    // A POST carrying an id updates that row. Without this read the payload
    // below was a full-row overwrite: any omitted field (order_index, badge,
    // section, promo_*, category_id) was reset to its default.
    const existingResult = wantsUpdate
      ? await supabase.from("menu_items").select("*").eq("id", body.id).maybeSingle()
      : { data: null, error: null };
    if (existingResult.error) {
      console.error("Supabase menu update read error:", existingResult.error.message);
      return res.status(500).json({ error: SAVE_ERROR });
    }
    const existing = existingResult.data ?? null;

    const level = body.level ?? existing?.level ?? 1;
    const parentId = body.parent_id !== undefined ? body.parent_id : (existing?.parent_id ?? null);

    const { parent, error: parentError } = await loadParent(level, parentId);
    if (parentError) return res.status(500).json({ error: SAVE_ERROR });

    const hierarchyError = validateHierarchy({ level, parent_id: parentId }, parent);
    if (hierarchyError) return res.status(400).json({ error: hierarchyError });

    if (Object.hasOwn(body, "category_id") && body.category_id != null) {
      const { category, error } = await loadCategory(body.category_id);
      if (error) return res.status(500).json({ error: SAVE_ERROR });
      if (!category) return res.status(400).json({ error: CATEGORY_NOT_FOUND });
    }

    let payload;
    if (existing) {
      // Update: start from the stored row and overlay only body-present fields.
      payload = {};
      for (const field of FIELDS) {
        if (existing[field] !== undefined) payload[field] = existing[field];
      }
      for (const field of FIELDS) {
        if (Object.hasOwn(body, field) && body[field] !== undefined) {
          payload[field] = body[field];
        }
      }
      payload.title = body.title;
      payload.path = body.path;
      payload.level = level;
      payload.parent_id = parentId;
    } else {
      // Create: the documented defaults apply.
      payload = {
        title: body.title,
        path: body.path,
        icon: body.icon || "Layers",
        badge: body.badge ?? null,
        badge_variant: body.badge_variant || "accent",
        parent_id: parentId,
        level,
        section: body.section ?? null,
        section_icon: body.section_icon ?? null,
        promo_title: body.promo_title ?? null,
        promo_subtitle: body.promo_subtitle ?? null,
        promo_image_url: body.promo_image_url ?? null,
        promo_cta_text: body.promo_cta_text ?? null,
        promo_cta_path: body.promo_cta_path ?? null,
        roles_allowed: body.roles_allowed ?? DEFAULT_ROLES,
        order_index: body.order_index ?? 0,
        is_active: body.is_active ?? true,
      };
      if (Object.hasOwn(body, "category_id")) payload.category_id = body.category_id;
    }
    if (wantsUpdate) payload.id = body.id;

    // Unlike the old handler, a Supabase error is never swallowed: a failed
    // write is a 500, not a 200 carrying the in-memory fallback.
    const { data, error } = await supabase.from("menu_items").upsert(payload).select().single();

    if (error) {
      console.error("Supabase menu save error:", error.message);
      return res.status(500).json({ error: SAVE_ERROR });
    }

    return res.json({ message: SAVE_MESSAGE, item: data ?? null });
  } catch (thrown) {
    console.error("Supabase menu save exception:", thrown.message);
    return res.status(500).json({ error: SAVE_ERROR });
  }
});

router.delete("/:id", ...adminOnly, async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) {
      console.error("Supabase menu delete error:", error.message);
      return res.status(500).json({ error: DELETE_ERROR });
    }
  } catch (thrown) {
    console.error("Supabase menu delete exception:", thrown.message);
    return res.status(500).json({ error: DELETE_ERROR });
  }

  return res.json({ message: "Menu item deleted successfully." });
});

const crud = createCrudRouter({
  table: "menu_items",
  fields: FIELDS,
  // menu_items keeps order_index; the reorder body still speaks display_order.
  orderColumn: "order_index",
  validate: validateMenuRow,
  toPayload,
  resourceKey: "item",
  listKey: "items",
});

// PATCH /:id is menu-local, like DELETE: the frozen CRUD factory echoes raw
// Supabase messages, and this task's contract is a fixed, non-disclosing error.
// It keeps the factory's contract: partial write, 404 for a missing row, an
// empty-patch short-circuit, and `{ message, item }`.
router.patch("/:id", ...adminOnly, prepareMenuPatch, async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const validationError = validateMenuRow(body, { partial: true });
    if (typeof validationError === "string") {
      return res.status(400).json({ error: validationError });
    }

    const id = req.params.id;
    const existing = await supabase.from("menu_items").select("*").eq("id", id).maybeSingle();
    if (existing.error) {
      console.error("Supabase menu patch read error:", existing.error.message);
      return res.status(500).json({ error: SAVE_ERROR });
    }
    if (!existing.data) return res.status(404).json({ error: NOT_FOUND });

    const patch = toPayload(body);
    if (Object.keys(patch).length === 0) {
      return res.json({ message: SAVE_MESSAGE, item: existing.data });
    }

    const { data, error } = await supabase
      .from("menu_items")
      .update(patch)
      .eq("id", id)
      .select();
    if (error) {
      console.error("Supabase menu patch update error:", error.message);
      return res.status(500).json({ error: SAVE_ERROR });
    }

    return res.json({ message: SAVE_MESSAGE, item: data?.[0] ?? existing.data });
  } catch (thrown) {
    console.error("Supabase menu patch exception:", thrown.message);
    return res.status(500).json({ error: SAVE_ERROR });
  }
});

router.use(crud);

export default router;
