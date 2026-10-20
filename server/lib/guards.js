import { verifyToken, requireRole } from "../middleware/auth.js";

/**
 * Shared route guards.
 *
 * The CRUD factory keeps its own private copy of the guard runner (it is frozen
 * for this slice); every hand-rolled route imports the helpers here so there is
 * at least one shared implementation of the admin and `?includeInactive=` rules.
 */

const ADMIN_ROLES = ["admin", "super_admin"];
export const adminGuards = [verifyToken, requireRole(ADMIN_ROLES)];

const INACTIVE_FALSE = ["0", "false", "off"];

/**
 * The strict integer rule for an order column.
 *
 * DELIBERATE MIRROR: `isExactInteger`/`validateOrderIndex` in
 * `server/lib/validation.js` (lines 38-48) own this rule, but neither is
 * exported and that module is frozen for Tasks 6 and 7. This copy is
 * byte-for-byte behaviourally identical (including the message). Do not edit
 * one in isolation: when `validation.js` is unfrozen, export `isExactInteger`
 * and delete this duplicate.
 */
export const ORDER_INTEGER_MESSAGE = "order_index must be an integer.";

/** True for integers and canonical integer strings ("12", not "01", "1.5", "1e3"). */
export function isValidOrderValue(value) {
  if (typeof value === "number") return Number.isInteger(value);
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return Number.isInteger(Number(trimmed)) && trimmed === String(Number(trimmed));
}

/** Middleware form: verifyToken then requireRole; errors go to Express. */
export function adminChain(req, res, next) {
  verifyToken(req, res, (error) => {
    if (error) return next(error);
    return requireRole(ADMIN_ROLES)(req, res, next);
  });
}

/**
 * Run a middleware chain and resolve true only when every guard called next()
 * without an error. A guard that answers (401/403) resolves false; a guard that
 * errors resolves false and answers 500 — failure is always closed, never open.
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
        if (res.headersSent || res.writableEnded) resolve(false);
      } catch (thrown) {
        res.status(500).json({ error: thrown.message || "Authorization check failed." });
        resolve(false);
      }
    };

    next();
  });
}

/**
 * True only when the request asks for inactive rows and an admin guard passed.
 * A failed or errored guard resolves false and has already answered 401/403/500.
 */
export async function includesInactive(req, res, guards = adminGuards) {
  if (!Object.hasOwn(req.query, "includeInactive")) return false;
  if (INACTIVE_FALSE.includes(String(req.query.includeInactive).toLowerCase())) return false;
  return runGuards(guards, req, res);
}

/** True when the request asked for inactive rows but a guard has already answered. */
export function inactiveRefused(req, res) {
  return Object.hasOwn(req.query, "includeInactive") && res.headersSent;
}
