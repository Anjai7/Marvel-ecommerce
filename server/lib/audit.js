import { supabase } from "../db.js";

/**
 * Append one row to the admin audit log.
 *
 * The insert is best-effort by design: the `admin_audit_log` table is created
 * by the hand-off bundle `docs/sql/apply-05-admin-audit-log.sql`, and a
 * deployment that has not run it yet must still let the admin's product write
 * land. A missing table therefore resolves to a warning — never to a failed
 * write that costs the operator their save.
 *
 * @param {string} action the write being recorded, e.g. "product.update"
 * @param {string} entity the entity kind, e.g. "product"
 * @param {string} [entityId] the row the write touched
 * @param {object} [details] the before/after facts worth remembering
 * @param {object} [actor] the token subject that performed the write
 *   ({ id, email, role }) when the write came from an authenticated admin route
 */
export async function recordAudit(action, entity, entityId, details = {}, actor = null) {
  try {
    const { error } = await supabase.from("admin_audit_log").insert({
      action: String(action ?? "unknown"),
      entity: String(entity ?? "unknown"),
      entity_id: entityId === undefined || entityId === null ? null : String(entityId),
      details: details && typeof details === "object" && !Array.isArray(details) ? details : {},
      actor_id: actor?.id === undefined || actor?.id === null ? null : String(actor.id),
      actor_email: actor?.email ?? null,
    });

    if (error) {
      console.warn(`[audit] could not append '${action}' for ${entity}: ${error.message}`);
    }
  } catch (err) {
    console.warn(`[audit] could not append '${action}' for ${entity}: ${err?.message}`);
  }
}
