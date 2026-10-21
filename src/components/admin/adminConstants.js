/* Shared constants and neutral display helpers for the admin console.
 *
 * Rule (see docs/superpowers/specs/2026-10-21-backend-owned-content.md): the
 * console never invents a business value. When the API has no value the screen
 * shows `EMPTY`, a neutral em dash — never a made-up name, email, date, plan or
 * number. Enumerations here mirror the database exactly so the client cannot
 * drift from the server. */

/** Rendered wherever the API returned nothing. Never a fabricated placeholder. */
export const EMPTY = "—";

/**
 * Order lifecycle stages — exactly the `order_status` enum in Postgres
 * (`pending, processing, shipped, delivered, cancelled`). This is the single
 * source of truth for order-status filters, pills and charts.
 */
export const ORDER_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"];

/** Human labels for {@link ORDER_STATUSES}, keyed by the database value. */
export const ORDER_STATUS_LABELS = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/**
 * Units-per-product at or below which stock counts as low.
 *
 * A single exported constant so the metric card, the inventory report and the
 * inventory chart can never drift apart. A later stage serves this from
 * `GET /api/settings` (`inventory.low_stock_threshold`); until then this is the
 * one place the number lives.
 */
export const LOW_STOCK_THRESHOLD = 5;

/** Account role slugs stored in `profiles.role` → display label. */
export const ROLE_LABELS = {
  super_admin: "Super Admin",
  admin: "Admin",
  vendor: "Vendor",
  user: "Customer",
};

/**
 * The API value, or `EMPTY` when there is none.
 *
 * `0` and `false` are real values and are kept; only `null`, `undefined` and
 * blank strings fall back to the em dash.
 */
export function displayValue(value) {
  if (value === null || value === undefined) return EMPTY;
  const text = String(value).trim();
  return text ? value : EMPTY;
}

/**
 * First letter of a real, API-provided name — used for avatars.
 * `EMPTY` when there is no name to abbreviate, so an avatar never spells a
 * person that does not exist.
 */
export function displayInitial(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.charAt(0).toUpperCase() : EMPTY;
}

/**
 * Low-stock band shared by every screen.
 *
 * @param {number|string} stock the units on hand
 * @returns {boolean} true only for a real, positive stock at or below the threshold
 */
export function isLowStock(stock) {
  const units = parseInt(stock, 10);
  return Number.isFinite(units) && units > 0 && units <= LOW_STOCK_THRESHOLD;
}

const DATE_OPTIONS = { day: "2-digit", month: "short", year: "numeric" };

/**
 * An API date in the platform locale (`en-IN`, India-only), or `EMPTY`.
 *
 * @param {string|number|Date|null|undefined} value the stored timestamp
 * @param {Intl.DateTimeFormatOptions} [options] override the default format
 */
export function formatAdminDate(value, options = DATE_OPTIONS) {
  if (!value) return EMPTY;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? EMPTY : date.toLocaleDateString("en-IN", options);
}
