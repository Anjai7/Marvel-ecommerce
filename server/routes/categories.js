import express from "express";
import { supabase } from "../db.js";
import { createCrudRouter, applyReorder } from "../lib/crudRouter.js";
import {
  adminChain,
  adminGuards,
  includesInactive,
  inactiveRefused,
  isValidOrderValue,
  ORDER_INTEGER_MESSAGE,
} from "../lib/guards.js";
import { validateCategory, validateDepth } from "../lib/validation.js";

const adminOnly = adminGuards;

const FIELDS = [
  "name",
  "slug",
  "parent_id",
  "level",
  "description",
  "icon",
  "image_url",
  "banner_image_url",
  "display_order",
  "is_active",
  "show_in_nav",
  "show_in_homepage",
];

const READ_ERROR = "Could not load content.";
const REORDER_ERROR = "Reorder must include every item in the scope.";
const NOT_FOUND = "category not found.";

/**
 * The parent's level, resolved from the database before the factory builds the
 * payload. A symbol keeps it off the JSON body: a client cannot spoof it, and
 * it is not a writable column.
 */
const DERIVED_PARENT_LEVEL = Symbol("derivedParentLevel");

function siblingOrder(a, b) {
  const order = (a.display_order ?? 0) - (b.display_order ?? 0);
  if (order !== 0) return order;
  return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
}

/** All rows for a tree/lookup read, or null when a response was already sent. */
async function loadRows(req, res) {
  const withInactive = await includesInactive(req, res);
  if (!withInactive && inactiveRefused(req, res)) return null;

  let query = supabase.from("categories").select("*");
  if (!withInactive) query = query.eq("is_active", true);

  try {
    const { data, error } = await query
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Supabase categories list error:", error.message);
      res.status(500).json({ error: READ_ERROR });
      return null;
    }
    return data ?? [];
  } catch (thrown) {
    console.error("Supabase categories list exception:", thrown.message);
    res.status(500).json({ error: READ_ERROR });
    return null;
  }
}

function buildTree(rows) {
  const byId = new Map(rows.map((row) => [row.id, { ...row, children: [] }]));
  const roots = [];

  for (const row of rows) {
    const node = byId.get(row.id);
    const parent = row.parent_id ? byId.get(row.parent_id) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortLevel = (nodes) => {
    nodes.sort(siblingOrder);
    nodes.forEach((node) => sortLevel(node.children));
  };
  sortLevel(roots);
  return roots;
}

function ancestorsOf(row, byId) {
  const ancestors = [];
  let cursor = row.parent_id ? byId.get(row.parent_id) : null;
  while (cursor) {
    ancestors.unshift(cursor);
    cursor = cursor.parent_id ? byId.get(cursor.parent_id) : null;
  }
  return ancestors;
}

/** Every row below `row`, level by level, capped at the schema's depth of 3. */
function descendantsOf(row, rows) {
  const descendants = [];
  let frontier = [row.id];

  for (let depth = 0; depth < 3 && frontier.length > 0; depth += 1) {
    const children = rows
      .filter((candidate) => frontier.includes(candidate.parent_id))
      .sort(siblingOrder);
    descendants.push(...children);
    frontier = children.map((child) => child.id);
  }
  return descendants;
}

/** `{ category, ancestors, descendants }` for one resolved row. */
function lookupResponse(row, rows, extra = {}) {
  const byId = new Map(rows.map((candidate) => [candidate.id, candidate]));
  return {
    category: { ...row, ...extra },
    ancestors: ancestorsOf(row, byId),
    descendants: descendantsOf(row, rows),
  };
}

/**
 * Resolve `level` from `parent_id` before the factory validates and writes.
 * Runs after the admin guard, so a rejected write never reaches the database.
 * POST always derives a level (1 when there is no parent). PATCH derives one
 * only when the body moves the row (`parent_id`) or names a `level`, so
 * `{ name: "New" }` still writes just `name`.
 */
async function resolveParentLevel(req, res, next) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const hasParent = Object.hasOwn(body, "parent_id");
    const hasLevel = Object.hasOwn(body, "level");
    if (req.method !== "POST" && !hasParent && !hasLevel) return next();

    let parentId;
    if (hasParent) {
      parentId = body.parent_id;
    } else if (req.method === "PATCH") {
      // A level without a parent_id must agree with the stored parent.
      const { data, error } = await supabase
        .from("categories")
        .select("parent_id")
        .eq("id", req.params.id)
        .maybeSingle();
      if (error) {
        return res.status(500).json({ error: error.message || "Failed to load category." });
      }
      if (!data) return res.status(404).json({ error: NOT_FOUND });
      parentId = data.parent_id;
    } else {
      parentId = null;
    }

    let parent = null;
    if (parentId != null) {
      const { data, error } = await supabase
        .from("categories")
        .select("id, level")
        .eq("id", parentId)
        .maybeSingle();
      if (error) {
        return res.status(500).json({ error: error.message || "Failed to load parent category." });
      }
      if (!data) return res.status(400).json({ error: "Parent category not found." });
      parent = data;
    }

    body[DERIVED_PARENT_LEVEL] = parent ? parent.level : 0;
    return next();
  } catch (thrown) {
    return res.status(500).json({ error: thrown.message || "Failed to save category." });
  }
}

/** Validator for both POST and PATCH; the resolved parent level is authoritative. */
function validateCategoryRow(body = {}, opts = {}) {
  const error = validateCategory(body, opts);
  if (error) return error;

  if (Object.hasOwn(body, "display_order") && !isValidOrderValue(body.display_order)) {
    return ORDER_INTEGER_MESSAGE;
  }

  const parentLevel = body[DERIVED_PARENT_LEVEL];
  if (parentLevel === undefined) return null;

  if (body.level !== undefined && body.level !== parentLevel + 1) {
    if (body.level === 1) return "Level 1 categories must not have a parent_id.";
    if (parentLevel === 0) return "parent_id is required for categories below level 1.";
    return `Parent category must be at level ${body.level - 1} for a level ${body.level} category.`;
  }

  // The parent was resolved by the middleware, so a synthetic parent row is
  // enough to apply the depth cap (a level-3 parent would imply level 4).
  return validateDepth(
    { level: parentLevel + 1, parent_id: parentLevel === 0 ? null : "resolved-parent" },
    parentLevel === 0 ? null : { level: parentLevel }
  );
}

/**
 * Keep only body-present keys, coerce the two integer columns, and write the
 * derived level whenever the middleware resolved a parent. This is the one
 * documented exception to "PATCH writes only the keys the client sent".
 */
function toPayload(body) {
  const payload = {};
  for (const field of FIELDS) {
    if (Object.hasOwn(body, field) && body[field] !== undefined) payload[field] = body[field];
  }

  const parentLevel = body[DERIVED_PARENT_LEVEL];
  if (parentLevel !== undefined) payload.level = parentLevel + 1;

  if (payload.level !== undefined) payload.level = Number(payload.level);
  if (payload.display_order !== undefined) payload.display_order = Number(payload.display_order);
  return payload;
}

const crud = createCrudRouter({
  table: "categories",
  fields: FIELDS,
  orderColumn: "display_order",
  validate: validateCategoryRow,
  toPayload,
  resourceKey: "category",
  listKey: "categories",
});

const router = express.Router();

// Literal paths must precede GET /:id or "tree", "path" and "slug" become ids.
router.get("/tree", async (req, res) => {
  const rows = await loadRows(req, res);
  if (!rows) return;
  res.json({ categories: buildTree(rows) });
});

router.get("/path", async (req, res) => {
  const raw = typeof req.query.path === "string" ? req.query.path : "";
  const missing = { error: `No category found for path '${raw}'.` };
  const segments = raw.split("/");

  if (segments.length === 0 || segments.length > 3 || segments.some((segment) => segment === "")) {
    return res.status(404).json(missing);
  }

  const rows = await loadRows(req, res);
  if (!rows) return undefined;

  let current = rows.find((row) => row.level === 1 && row.slug === segments[0]);
  for (const segment of segments.slice(1)) {
    current = current && rows.find((row) => row.parent_id === current.id && row.slug === segment);
  }

  if (!current) return res.status(404).json(missing);
  // An exact path is an identity, so `ambiguous` is never set on this route.
  return res.json(lookupResponse(current, rows));
});

router.get("/slug/:slug", async (req, res) => {
  const rows = await loadRows(req, res);
  if (!rows) return undefined;

  const matches = rows
    .filter((row) => row.slug === req.params.slug)
    .sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || siblingOrder(a, b));

  if (matches.length === 0) return res.status(404).json({ error: NOT_FOUND });
  return res.json(lookupResponse(matches[0], rows, { ambiguous: matches.length > 1 }));
});

// Before PATCH /:id or "reorder" is captured as an id.
router.patch("/reorder", ...adminOnly, async (req, res) => {
  const orders = req.body?.orders;
  const ids = Array.isArray(orders)
    ? orders.map((order) => (order && typeof order === "object" ? order.id : undefined))
    : [];

  if (!Array.isArray(orders) || ids.some((id) => typeof id !== "string" || id === "")) {
    return res.status(400).json({ error: REORDER_ERROR });
  }

  try {
    const { data, error } = await supabase
      .from("categories")
      .select("id, parent_id, display_order");
    if (error) {
      console.error("Supabase categories reorder read error:", error.message);
      return res.status(500).json({ error: READ_ERROR });
    }

    const rows = data ?? [];
    const byId = new Map(rows.map((row) => [row.id, row]));
    const selected = ids.map((id) => byId.get(id));
    if (selected.some((row) => !row)) return res.status(400).json({ error: REORDER_ERROR });

    // The scope is one sibling group; a body that mixes parents is rejected.
    const parents = new Set(selected.map((row) => row.parent_id ?? null));
    if (parents.size !== 1) return res.status(400).json({ error: REORDER_ERROR });

    const parentId = [...parents][0];
    const scope = rows.filter((row) => (row.parent_id ?? null) === parentId);
    const { renumbered, error: reorderError } = applyReorder(
      scope.map((row) => row.id),
      orders
    );
    if (reorderError) return res.status(400).json({ error: reorderError });

    // One UPDATE per row: non-atomic by design for this slice. A failure midway
    // leaves a partial ordering until the next complete reorder call.
    for (const entry of renumbered) {
      const { error: updateError } = await supabase
        .from("categories")
        .update({ display_order: entry.display_order })
        .eq("id", entry.id);
      if (updateError) {
        return res
          .status(500)
          .json({ error: updateError.message || "Failed to reorder categories." });
      }
    }

    return res.json({ message: "Category order updated successfully." });
  } catch (thrown) {
    return res.status(500).json({ error: thrown.message || "Failed to reorder categories." });
  }
});

// Writes: guard first, then resolve the parent, then the factory handler.
router.use((req, res, next) => {
  if (req.method !== "POST" && req.method !== "PATCH") return next();
  return adminChain(req, res, (error) => {
    if (error) return next(error);
    return resolveParentLevel(req, res, next);
  });
});

router.use(crud);

export default router;
