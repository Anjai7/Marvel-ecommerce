import { generateProductCode } from "./productCode.js";
import { isMissingCodeColumn } from "./productColumns.js";

/** Codes stay short and readable: letters, digits and a numeric suffix. */
export const CODE_PATTERN = /^[A-Za-z0-9-]{2,24}$/;

/** How many `-n` variants to try before giving up. */
const MAX_SUFFIX = 500;

/**
 * Who owns `code`, or null when it is free.
 *
 * A case-insensitive lookup keeps `fas379` and `FAS379` from both being
 * stored. The comparison is done in the database because that is where the
 * unique index lives — the index uses `lower(code)` for the same reason.
 */
async function codeOwner(supabase, code) {
  const { data, error } = await supabase.from("products").select("id").ilike("code", code);
  if (error) {
    // apply-08 not applied yet: there is no column to collide in, and reads
    // still derive the code. Saving must not fail over a pending migration.
    if (isMissingCodeColumn(error)) return null;
    throw error;
  }
  return data?.[0]?.id ?? null;
}

/**
 * Pick an unused item code.
 *
 * New products get the code derived from their title/category/id, then
 * `-2`, `-3` … when that code is taken — the same rule the backfill uses,
 * so codes created before and after apply-08 follow one convention.
 * When an admin types a code explicitly, it is checked as-is and reported
 * as taken instead of being silently changed.
 */
export async function allocateProductCode(supabase, { title, category, id, preferred }) {
  const wanted = typeof preferred === "string" ? preferred.trim() : "";
  if (wanted) {
    if (!CODE_PATTERN.test(wanted)) return { invalid: true, code: wanted };
    const owner = await codeOwner(supabase, wanted);
    if (owner && String(owner) !== String(id)) return { taken: true, code: wanted };
    return { taken: false, code: wanted };
  }

  const base = generateProductCode(title, category, id);
  for (let n = 1; n <= MAX_SUFFIX; n += 1) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const owner = await codeOwner(supabase, candidate);
    if (!owner || String(owner) === String(id)) return { taken: false, code: candidate };
  }
  throw new Error("Could not allocate a unique product code.");
}
