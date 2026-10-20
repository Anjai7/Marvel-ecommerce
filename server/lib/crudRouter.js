import { Router } from "express";
import { supabase } from "../db.js";
import { verifyToken, requireRole } from "../middleware/auth.js";

/**
 * Generic CRUD router factory for content tables. All content-specific detail
 * arrives through the config; `toPayload` is optional and defaults to
 * body-present keys, and the write set is exactly its output filtered to
 * `fields` with undefined dropped (so a builder may rename or derive a column,
 * while an omitted field is never nulled). The body is validated before the
 * builder runs, so strict integer strings ("1.5", "01", "1e3") are never coerced.
 */

const ADMIN_ROLES = ["admin", "super_admin"];
const REORDER_INCOMPLETE = "Reorder must include every item in the scope.";

/** Copy the listed fields the source carries; undefined is never written. */
const pickFields = (source, fields) =>
  Object.fromEntries(
    fields
      .filter((field) => Object.hasOwn(source, field) && source[field] !== undefined)
      .map((field) => [field, source[field]])
  );

/** Default payload builder: only the keys the client actually sent. */
function defaultToPayload(body) {
  return body && typeof body === "object" ? { ...body } : {};
}

/** True when the query asks for inactive rows; "0"/"false"/"off" mean no. */
function includesInactive(req, param) {
  if (!Object.hasOwn(req.query, param)) return false;
  return !["0", "false", "off"].includes(String(req.query[param]).toLowerCase());
}

/** Run a middleware chain; true when every guard calls next(), false when one answers. */
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
        // A guard that answers instead of calling next() (verifyToken's 401,
        // requireRole's 403) leaves the chain parked; settle it here.
        if (res.headersSent || res.writableEnded) resolve(false);
      } catch (thrown) {
        res.status(500).json({ error: thrown.message || "Authorization check failed." });
        resolve(false);
      }
    };

    next();
  });
}

/** Renumber a reorder payload to 0..n-1; its id set must equal the scope exactly. */
export function applyReorder(existingIds = [], orders = []) {
  if (!Array.isArray(orders)) return { error: REORDER_INCOMPLETE };

  const scope = new Set(existingIds);
  const requestedIds = orders.map((order) =>
    order && typeof order === "object" ? order.id : undefined
  );
  const hasMalformedId = requestedIds.some((id) => typeof id !== "string" || id === "");
  const hasRepeatedId = new Set(requestedIds).size !== requestedIds.length;
  const hasIdOutsideScope = requestedIds.some((id) => !scope.has(id));

  if (hasMalformedId || hasRepeatedId || hasIdOutsideScope || requestedIds.length !== scope.size) {
    return { error: REORDER_INCOMPLETE };
  }

  return {
    renumbered: orders.map((order, index) => ({ id: order.id, display_order: index })),
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
    includeInactiveParam = "includeInactive",
    resourceKey,
    listKey = resourceKey,
  } = config;

  const required = {
    table: "string",
    fields: "array",
    orderColumn: "string",
    validate: "function",
    resourceKey: "string",
  };
  for (const [key, kind] of Object.entries(required)) {
    const value = config[key];
    const valid = kind === "array" ? Array.isArray(value) : typeof value === kind && value !== "";
    if (!valid) {
      throw new TypeError(`createCrudRouter: invalid or missing configuration key '${key}'.`);
    }
  }
  if (toPayload !== undefined && typeof toPayload !== "function") {
    throw new TypeError("createCrudRouter: configuration key 'toPayload' must be a function.");
  }

  const buildPayload = toPayload ?? defaultToPayload;

  const adminGuard = [verifyToken, requireRole(ADMIN_ROLES)];
  const savedMessage = `${resourceKey} saved successfully.`;
  const deleteMessage = `${resourceKey} deleted successfully.`;
  const notFoundMessage = `${resourceKey} not found.`;
  const loadMessage = `Failed to load ${resourceKey}.`;
  const readErrorMessage = "Could not load content.";

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
        console.error(`Supabase ${table} list error:`, error.message);
        return res.status(500).json({ error: readErrorMessage });
      }
      return res.json({ [listKey]: data || [] });
    } catch (thrown) {
      console.error(`Supabase ${table} list exception:`, thrown.message);
      return res.status(500).json({ error: readErrorMessage });
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
        console.error(`Supabase ${table} read error:`, error.message);
        return res.status(500).json({ error: readErrorMessage });
      }
      if (!data) return res.status(404).json({ error: notFoundMessage });
      return res.json({ [resourceKey]: data });
    } catch (thrown) {
      console.error(`Supabase ${table} read exception:`, thrown.message);
      return res.status(500).json({ error: readErrorMessage });
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

      const row = pickFields(buildPayload(body), fields);
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

  // PATCH /:id — partial validation; the write set is the payload builder's output.
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
        return res.status(500).json({ error: existing.error.message || loadMessage });
      }
      if (!existing.data) return res.status(404).json({ error: notFoundMessage });

      const patch = pickFields(buildPayload(body), fields);
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
        return res.status(500).json({ error: existing.error.message || loadMessage });
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
