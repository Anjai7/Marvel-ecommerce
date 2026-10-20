import { Router } from "express";
import { supabase } from "../db.js";
import { verifyToken, requireRole } from "../middleware/auth.js";

/**
 * Generic CRUD router factory for content tables.
 *
 * Everything content-specific arrives through the config object, so a new
 * content type needs a config and nothing else:
 *
 *   createCrudRouter({
 *     table, fields, orderColumn, validate, toPayload, resourceKey,
 *     listKey = resourceKey,
 *     readGuard = [],                                  // public reads
 *     writeGuard = [verifyToken, requireRole([...])],  // admin writes
 *     includeInactiveParam = "includeInactive",
 *   })
 *
 * The request body is validated before toPayload runs. Validators are strict
 * about integer-shaped strings ("1.5", "01", "1e3"), and coercing first would
 * silently accept what they are meant to reject.
 */

const ADMIN_ROLES = ["admin", "super_admin"];
const INACTIVE_PARAM = "includeInactive";
const REORDER_INCOMPLETE = "Reorder must include every item in the scope.";

/** Copy only the listed fields that the source actually carries (undefined is not written). */
function pickFields(source, fields, onlyKeys = null) {
  const allowed = onlyKeys ? new Set(onlyKeys) : null;
  const picked = {};
  for (const field of fields) {
    if (allowed && !allowed.has(field)) continue;
    if (!Object.prototype.hasOwnProperty.call(source, field)) continue;
    if (source[field] === undefined) continue;
    picked[field] = source[field];
  }
  return picked;
}

/** True when the query asks for inactive rows; "0"/"false"/"off" mean no. */
function includesInactive(req, param) {
  if (!Object.prototype.hasOwnProperty.call(req.query, param)) return false;
  const value = String(req.query[param]).toLowerCase();
  return value !== "0" && value !== "false" && value !== "off";
}

/**
 * Run a middleware chain inside an async handler. Resolves true when every
 * guard called next(), false when one of them answered the request.
 */
function runGuards(guards, req, res) {
  return new Promise((resolve) => {
    let index = 0;

    const next = (error) => {
      if (res.headersSent || res.writableEnded) return resolve(false);
      if (error) {
        res.status(500).json({ error: error.message || "Authorization check failed." });
        return resolve(false);
      }

      const guard = guards[index];
      index += 1;
      if (!guard) return resolve(true);

      try {
        guard(req, res, next);
      } catch (thrown) {
        res.status(500).json({ error: thrown.message || "Authorization check failed." });
        resolve(false);
      }
    };

    next();
  });
}

/**
 * Renumber a complete reorder payload to 0..n-1 in array order. Every id in the
 * scope must appear in `orders`; submitted display_order values are ignored.
 */
export function applyReorder(existingIds = [], orders = []) {
  const requested = Array.isArray(orders) ? orders : [];
  const requestedIds = new Set(requested.map((order) => order?.id));
  if (existingIds.some((id) => !requestedIds.has(id))) {
    return { error: REORDER_INCOMPLETE };
  }
  return {
    renumbered: requested.map((order, index) => ({ id: order.id, display_order: index })),
  };
}

export function createCrudRouter(config = {}) {
  const {
    table,
    fields,
    orderColumn,
    validate,
    toPayload,
    readGuard = [],
    writeGuard = [verifyToken, requireRole(ADMIN_ROLES)],
    includeInactiveParam = INACTIVE_PARAM,
    resourceKey,
    listKey = resourceKey,
  } = config;

  if (
    typeof table !== "string" ||
    !Array.isArray(fields) ||
    typeof orderColumn !== "string" ||
    typeof validate !== "function" ||
    typeof toPayload !== "function" ||
    typeof resourceKey !== "string"
  ) {
    throw new TypeError(
      "createCrudRouter requires table, fields, orderColumn, validate, toPayload and resourceKey."
    );
  }

  const adminGuard = [verifyToken, requireRole(ADMIN_ROLES)];
  const savedMessage = `${resourceKey} saved successfully.`;
  const deleteMessage = `${resourceKey} deleted successfully.`;
  const notFoundMessage = `${resourceKey} not found.`;

  const router = Router();

  // GET / — public, active rows only unless an admin asks for inactive ones.
  router.get("/", ...readGuard, async (req, res) => {
    try {
      const includeInactive = includesInactive(req, includeInactiveParam);
      if (includeInactive && !(await runGuards(adminGuard, req, res))) return undefined;

      let query = supabase.from(table).select("*");
      if (!includeInactive) query = query.eq("is_active", true);

      const { data, error } = await query
        .order(orderColumn, { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        console.warn(`Supabase ${table} list warning:`, error.message);
        return res.json({ [listKey]: [] });
      }
      return res.json({ [listKey]: data || [] });
    } catch (thrown) {
      console.warn(`Supabase ${table} list exception:`, thrown.message);
      return res.json({ [listKey]: [] });
    }
  });

  // GET /:id
  router.get("/:id", ...readGuard, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("id", req.params.id)
        .maybeSingle();

      if (error) {
        return res.status(500).json({ error: error.message || `Failed to load ${resourceKey}.` });
      }
      if (!data) return res.status(404).json({ error: notFoundMessage });
      return res.json({ [resourceKey]: data });
    } catch (thrown) {
      return res.status(500).json({ error: thrown.message || `Failed to load ${resourceKey}.` });
    }
  });

  // POST / — validate first, then build the row; upsert so a supplied id updates.
  router.post("/", ...writeGuard, async (req, res) => {
    try {
      const body = req.body || {};
      const validationError = validate(body, { partial: false });
      if (typeof validationError === "string") {
        return res.status(400).json({ error: validationError });
      }

      const row = pickFields(toPayload(body), fields);
      if (body.id !== undefined && body.id !== null) row.id = body.id;

      const { data, error } = await supabase.from(table).upsert(row).select();
      if (error) {
        return res.status(500).json({ error: error.message || `Failed to save ${resourceKey}.` });
      }
      return res.status(201).json({ message: savedMessage, [resourceKey]: data?.[0] ?? null });
    } catch (thrown) {
      return res.status(500).json({ error: thrown.message || `Failed to save ${resourceKey}.` });
    }
  });

  // PATCH /:id — partial validation, and only the keys the caller sent are written.
  router.patch("/:id", ...writeGuard, async (req, res) => {
    try {
      const body = req.body || {};
      const validationError = validate(body, { partial: true });
      if (typeof validationError === "string") {
        return res.status(400).json({ error: validationError });
      }

      const id = req.params.id;
      const existing = await supabase.from(table).select("*").eq("id", id).maybeSingle();
      if (existing.error) {
        return res
          .status(500)
          .json({ error: existing.error.message || `Failed to load ${resourceKey}.` });
      }
      if (!existing.data) return res.status(404).json({ error: notFoundMessage });

      const patch = pickFields(toPayload(body), fields, Object.keys(body));
      if (Object.keys(patch).length === 0) {
        return res.json({ message: savedMessage, [resourceKey]: existing.data });
      }

      const { data, error } = await supabase.from(table).update(patch).eq("id", id).select();
      if (error) {
        return res.status(500).json({ error: error.message || `Failed to save ${resourceKey}.` });
      }
      return res.json({ message: savedMessage, [resourceKey]: data?.[0] ?? existing.data });
    } catch (thrown) {
      return res.status(500).json({ error: thrown.message || `Failed to save ${resourceKey}.` });
    }
  });

  // DELETE /:id
  router.delete("/:id", ...writeGuard, async (req, res) => {
    try {
      const id = req.params.id;
      const existing = await supabase.from(table).select("id").eq("id", id).maybeSingle();
      if (existing.error) {
        return res
          .status(500)
          .json({ error: existing.error.message || `Failed to load ${resourceKey}.` });
      }
      if (!existing.data) return res.status(404).json({ error: notFoundMessage });

      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) {
        return res.status(500).json({ error: error.message || `Failed to delete ${resourceKey}.` });
      }
      return res.json({ message: deleteMessage });
    } catch (thrown) {
      return res.status(500).json({ error: thrown.message || `Failed to delete ${resourceKey}.` });
    }
  });

  return router;
}
