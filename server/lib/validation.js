/**
 * Pure body validators shared by the content, banner, footer and menu routes.
 *
 * Every validator returns `null` when the body is valid, otherwise a
 * human-readable error string that the route returns as `400 { error }`.
 * With `{ partial: true }` required-field checks are skipped for fields that
 * are absent, and only fields present in the body are validated.
 *
 * No I/O, no database, no Express — these functions are safe to unit test.
 */

const BANNER_PLACEMENTS = ["home_banner_layout", "home_promo_carousel", "promo_strip"];

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const ISO_8601_PATTERN =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/;

const ORDER_INDEX_MESSAGE = "order_index must be an integer.";
const LEVEL_MESSAGE = "Category level must be an integer between 1 and 3.";

function urlFieldMessage(field) {
  return `Field '${field}' must be an https URL or a relative path.`;
}

/**
 * A required string field: present, a string, and not whitespace-only.
 * In partial mode an absent field is skipped instead of failing.
 */
function requiredString(body, field, message, partial) {
  if (partial && body[field] === undefined) return null;
  const value = body[field];
  if (typeof value !== "string" || value.trim() === "") return message;
  return null;
}

/** True for integers and for canonical integer strings ("12", not "01", "1.5" or "1e3"). */
function isExactInteger(value) {
  if (typeof value === "number") return Number.isInteger(value);
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return Number.isInteger(Number(trimmed)) && trimmed === String(Number(trimmed));
}

function validateOrderIndex(body) {
  if (body.order_index === undefined || body.order_index === null) return null;
  return isExactInteger(body.order_index) ? null : ORDER_INDEX_MESSAGE;
}

function validateUrlFields(body, fields) {
  for (const field of fields) {
    const value = body[field];
    if (value != null && value !== "" && !isHttpsOrRelative(value)) {
      return urlFieldMessage(field);
    }
  }
  return null;
}

function isIsoTimestamp(value) {
  return (
    typeof value === "string" && ISO_8601_PATTERN.test(value) && !Number.isNaN(Date.parse(value))
  );
}

/**
 * URL validation: empty/undefined allowed (optional fields);
 * otherwise must be an https:// URL or a site-relative path (/...).
 */
export function isHttpsOrRelative(value) {
  if (value == null || value === "") return true;
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (v.startsWith("/")) return true;
  return v.startsWith("https://");
}

export function validateHeroSlide(body = {}, opts = {}) {
  const partial = opts.partial === true;

  const titleError = requiredString(body, "title", "Hero slide title is required.", partial);
  if (titleError) return titleError;

  const orderError = validateOrderIndex(body);
  if (orderError) return orderError;

  return validateUrlFields(body, [
    "bg_image_url",
    "product_image_url",
    "fallback_image_url",
    "btn_path",
  ]);
}

export function validateCategory(body = {}, opts = {}) {
  const partial = opts.partial === true;

  const nameError = requiredString(body, "name", "Category name is required.", partial);
  if (nameError) return nameError;

  // The slug column is NOT NULL; an absent slug cannot match the pattern, so the
  // regex check doubles as the required check on create.
  if (!(partial && body.slug === undefined)) {
    if (typeof body.slug !== "string" || !SLUG_PATTERN.test(body.slug)) {
      return "slug must be lowercase letters, numbers and hyphens only.";
    }
  }

  if (body.level !== undefined && body.level !== null) {
    if (!Number.isInteger(body.level) || body.level < 1 || body.level > 3) {
      return LEVEL_MESSAGE;
    }
  }

  return validateUrlFields(body, ["image_url", "banner_image_url"]);
}

export function validateBanner(body = {}, opts = {}) {
  const partial = opts.partial === true;

  const titleError = requiredString(body, "title", "Banner title is required.", partial);
  if (titleError) return titleError;

  if (!(partial && body.placement === undefined)) {
    if (body.placement == null || body.placement === "") {
      return "Banner placement is required.";
    }
    if (!BANNER_PLACEMENTS.includes(body.placement)) {
      return `Banner placement must be one of: ${BANNER_PLACEMENTS.join(", ")}.`;
    }
  }

  const urlError = validateUrlFields(body, [
    "cta_path",
    "image_url",
    "bg_image_url",
    "fallback_image_url",
  ]);
  if (urlError) return urlError;

  for (const field of ["starts_at", "ends_at"]) {
    if (body[field] != null && body[field] !== "" && !isIsoTimestamp(body[field])) {
      return `${field} must be an ISO-8601 timestamp.`;
    }
  }

  if (body.starts_at && body.ends_at) {
    if (Date.parse(body.ends_at) <= Date.parse(body.starts_at)) {
      return "ends_at must be after starts_at.";
    }
  }

  return null;
}

export function validateFooterSection(body = {}, opts = {}) {
  const partial = opts.partial === true;
  return requiredString(body, "heading", "Footer section heading is required.", partial);
}

export function validateFooterLink(body = {}, opts = {}) {
  const partial = opts.partial === true;

  const labelError = requiredString(body, "label", "Footer link label is required.", partial);
  if (labelError) return labelError;

  if (partial && body.href === undefined) return null;
  const href = body.href;
  if (typeof href !== "string" || href.trim() === "") {
    return "Footer link href is required.";
  }
  if (!isHttpsOrRelative(href)) return urlFieldMessage("href");

  return null;
}

/**
 * Taxonomy depth: level 1 has no parent, level N > 1 needs a parent whose
 * level is exactly N - 1. `parent` is the looked-up parent row, or null.
 */
export function validateDepth(body = {}, parent = null) {
  const level = body.level === undefined ? 1 : body.level;
  const parentId = body.parent_id === undefined ? null : body.parent_id;

  if (!Number.isInteger(level) || level < 1 || level > 3) return LEVEL_MESSAGE;

  if (level === 1) {
    return parentId != null ? "Level 1 categories must not have a parent_id." : null;
  }

  if (!parentId) return "parent_id is required for categories below level 1.";
  if (!parent) return "Parent category not found.";
  if (parent.level !== level - 1) {
    return `Parent category must be at level ${level - 1} for a level ${level} category.`;
  }
  return null;
}

/** Lowercase, collapse every run outside [a-z0-9] to "-", then trim "-". */
export function slugify(name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
