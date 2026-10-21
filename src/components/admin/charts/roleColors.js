/* Colour + label lookup for the user-role donut.
 *
 * The console passes database role slugs (`super_admin`, `admin`, `vendor`,
 * `user`) as `data[].name`; the palette is keyed by exactly those slugs. The
 * lookup also normalises a display label ("Super Admin") so a caller can never
 * silently lose the colour and fall back to grey. */

import { ROLE_LABELS, displayValue } from "../adminConstants";

export const ROLE_COLORS = {
  super_admin: "#a855f7",
  admin: "#3b82f6",
  vendor: "#ec4899",
  user: "#2563eb",
};

/** Grey, used only for a role the palette does not know. */
export const ROLE_COLOR_FALLBACK = "#64748b";

function roleSlug(role) {
  const key = String(role ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (ROLE_COLORS[key]) return key;
  // Accept a display label ("Super Admin", "Customer") as well as the slug.
  const label = String(role ?? "").trim();
  const byLabel = Object.keys(ROLE_LABELS).find(
    (slug) => ROLE_LABELS[slug].toLowerCase() === label.toLowerCase()
  );
  return byLabel || key;
}

/**
 * Colour for a role slice.
 *
 * @param {string} role the database slug (`super_admin`) or its label (`Super Admin`)
 * @returns {string} a hex colour
 */
export function roleColor(role) {
  return ROLE_COLORS[roleSlug(role)] || ROLE_COLOR_FALLBACK;
}

/**
 * Display label for a role slice — from the API value, never invented.
 *
 * @param {string} role the database slug or its label
 */
export function roleLabel(role) {
  return ROLE_LABELS[roleSlug(role)] || displayValue(role);
}
