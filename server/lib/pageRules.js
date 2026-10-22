/**
 * The rules a CMS page must satisfy before it is stored.
 *
 * This module is the single source of truth for three things:
 *
 *   1. **Which slugs are reserved** — `RESERVED_PAGE_SLUGS` and
 *      `isReservedSlug`. A page slug becomes a URL segment, so it may not
 *      shadow a route, a static asset or an admin area.
 *   2. **What a valid page looks like** — `validatePage` and `validateSeo`,
 *      following the house validator convention of `server/lib/validation.js`:
 *      return `null` when the body is valid, otherwise a human-readable error
 *      string. With `{ partial: true }` an absent field is skipped, but a
 *      *present* bad field still fails.
 *   3. **What "publicly visible" means** — `isPublicPage`. The API, the
 *      sitemap and the RLS policy all mirror this one predicate, so an
 *      unpublished URL is indistinguishable from a nonexistent one.
 *
 * No I/O, no database, no Express — these functions are safe to unit test.
 */

import { isSafeUrl } from "./sectionTypes.js";

/**
 * The slugs that may never name a page.
 *
 * They cover the API mount points, the admin area, the storefront routes that
 * already exist, the account routes and the files a crawler asks for. A page
 * called `cart` would shadow the cart route; a page called `robots.txt` would
 * shadow the robots file.
 */
export const RESERVED_PAGE_SLUGS = Object.freeze(
  new Set([
    "admin",
    "api",
    "assets",
    "account",
    "cart",
    "category",
    "checkout",
    "favicon.ico",
    "login",
    "logout",
    "manifest.json",
    "orders",
    "page",
    "pages",
    "product",
    "products",
    "public",
    "robots.txt",
    "search",
    "signup",
    "sitemap.xml",
    "static",
    "vendor",
  ])
);

/** The house slug shape: one lowercase segment of words joined by hyphens. */
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The house ISO-8601 shape: a date, optionally with a time and an offset. */
const ISO_8601_PATTERN =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/;

/** The kinds of page — mirrors the `pages_kind_check` constraint. */
export const PAGE_KINDS = Object.freeze([
  "landing",
  "policy",
  "about",
  "faq",
  "contact",
  "campaign",
  "brand",
  "category",
  "collection",
]);

/** The page templates — mirrors the `pages_template_check` constraint. */
export const PAGE_TEMPLATES = Object.freeze(["landing", "category", "standard"]);

/** The editorial lifecycle — mirrors the `pages_status_check` constraint. */
export const PAGE_STATUSES = Object.freeze(["draft", "scheduled", "published", "archived"]);

/** The only keys a `seo` block may carry. */
const SEO_FIELDS = Object.freeze(["title", "description", "canonical", "og_image", "noindex"]);

/** True for a value object (not an array, not null). */
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** True for a value that carries nothing: `undefined`, `null` or a blank string. */
function isBlank(value) {
  if (value === undefined || value === null) return true;
  return typeof value === "string" && value.trim() === "";
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

/** True for an ISO-8601 timestamp that also parses to a real instant. */
function isIsoTimestamp(value) {
  return (
    typeof value === "string" && ISO_8601_PATTERN.test(value) && !Number.isNaN(Date.parse(value))
  );
}

/**
 * True when a slug is reserved.
 *
 * The lookup trims and lowercases, so `"Admin"` and `" admin "` are both
 * reserved: the slug column is compared case-insensitively in the database
 * (`pages_slug_unique` is on `lower(slug)`), so a reserved word in any casing
 * would shadow the same route.
 */
export function isReservedSlug(slug) {
  return RESERVED_PAGE_SLUGS.has(
    String(slug ?? "")
      .trim()
      .toLowerCase()
  );
}

/**
 * Validate a `seo` block.
 *
 * Only the keys `title`, `description`, `canonical`, `og_image` and `noindex`
 * are accepted — an unknown key is an error, because a silently dropped typo
 * in the admin form is a bug the editor cannot see.
 *
 * A `canonical` must be an **absolute** `http`/`https` URL: a site-relative
 * path or a hash route is not a valid canonical, because a canonical points at
 * the one true URL of the page and the storefront is hash-routed. An `og_image`
 * only has to be a safe URL, so a site-relative image path is allowed — but
 * like every other asset URL it may not be a hash route, which would render
 * nothing.
 *
 * Returns `null` when the block is acceptable, otherwise the first error
 * string.
 */
export function validateSeo(seo) {
  if (seo === undefined || seo === null) return null;
  if (!isPlainObject(seo)) return "seo must be an object.";

  for (const [name, value] of Object.entries(seo)) {
    if (!SEO_FIELDS.includes(name)) {
      return `seo.${name} is not a known SEO field.`;
    }
    if (isBlank(value)) continue;

    switch (name) {
      case "title":
      case "description":
        if (typeof value !== "string") return `seo.${name} must be a string.`;
        break;
      case "canonical": {
        if (typeof value !== "string") return "seo.canonical must be a string.";
        const v = value.trim();
        if (!isSafeUrl(v) || !/^https?:\/\//i.test(v)) {
          return "seo.canonical must be an absolute http or https URL.";
        }
        break;
      }
      case "og_image":
        if (typeof value !== "string") return "seo.og_image must be a string.";
        if (value.trim().startsWith("#")) {
          return "seo.og_image must be an asset URL, not a hash route.";
        }
        if (!isSafeUrl(value.trim())) {
          return "seo.og_image must be a safe URL (http, https, mailto, tel or a site-relative path).";
        }
        break;
      case "noindex":
        if (typeof value !== "boolean") return "seo.noindex must be true or false.";
        break;
      default:
        break;
    }
  }

  return null;
}

/**
 * Validate a page body.
 *
 * The checks, in order: `title` is required; `slug` must match the house slug
 * pattern and must not be reserved; `kind`, `template` and `status` must be in
 * their allowlists; `scheduled_at` and `expired_at` must be ISO-8601 and, when
 * both are present, `expired_at` must be after `scheduled_at`; `seo` must pass
 * `validateSeo`.
 *
 * With `{ partial: true }` an absent field is skipped — that is the update
 * path, where only the submitted fields are checked. A field that *is* present
 * is always checked, so a partial update cannot smuggle in a bad value.
 *
 * Returns `null` when the body is acceptable, otherwise the first error
 * string.
 */
export function validatePage(body = {}, opts = {}) {
  const partial = opts.partial === true;
  const data = isPlainObject(body) ? body : {};

  const titleError = requiredString(data, "title", "Page title is required.", partial);
  if (titleError) return titleError;

  // The slug column is NOT NULL; an absent slug cannot match the pattern, so
  // the regex check doubles as the required check on create.
  if (!(partial && data.slug === undefined)) {
    if (typeof data.slug !== "string" || !SLUG_PATTERN.test(data.slug)) {
      return "slug must be lowercase letters, numbers and hyphens only.";
    }
    if (isReservedSlug(data.slug)) {
      return `slug '${data.slug}' is reserved and cannot be used for a page.`;
    }
  }

  if (data.description !== undefined && data.description !== null) {
    if (typeof data.description !== "string") return "description must be a string.";
  }

  if (data.category_id !== undefined && data.category_id !== null) {
    if (typeof data.category_id !== "string" || data.category_id.trim() === "") {
      return "category_id must be a string.";
    }
  }

  if (data.kind !== undefined && data.kind !== null && !PAGE_KINDS.includes(data.kind)) {
    return `kind must be one of: ${PAGE_KINDS.join(", ")}.`;
  }

  if (
    data.template !== undefined &&
    data.template !== null &&
    !PAGE_TEMPLATES.includes(data.template)
  ) {
    return `template must be one of: ${PAGE_TEMPLATES.join(", ")}.`;
  }

  if (data.status !== undefined && data.status !== null && !PAGE_STATUSES.includes(data.status)) {
    return `status must be one of: ${PAGE_STATUSES.join(", ")}.`;
  }

  for (const field of ["scheduled_at", "expired_at"]) {
    const value = data[field];
    if (isBlank(value)) continue;
    if (!isIsoTimestamp(value)) return `${field} must be an ISO-8601 timestamp.`;
  }

  if (!isBlank(data.scheduled_at) && !isBlank(data.expired_at)) {
    if (Date.parse(data.expired_at) <= Date.parse(data.scheduled_at)) {
      return "expired_at must be after scheduled_at.";
    }
  }

  if (data.seo !== undefined && data.seo !== null) {
    const seoError = validateSeo(data.seo);
    if (seoError) return seoError;
  }

  return null;
}

/**
 * The single behavioural definition of "publicly visible".
 *
 * A page is public when it is `published` **and** it is inside its visibility
 * window: `scheduled_at` is null or already reached, and `expired_at` is null
 * or not yet reached.
 *
 * The API, the sitemap and the `pages` RLS policy all mirror this, so an
 * unpublished URL answers 404 exactly like a nonexistent one — a draft, a
 * scheduled page whose time has not come and an expired page are all
 * indistinguishable to a shopper.
 */
export function isPublicPage(row, now = new Date()) {
  if (!isPlainObject(row)) return false;
  if (row.status !== "published") return false;

  const at = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (Number.isNaN(at)) return false;

  if (!isBlank(row.scheduled_at)) {
    const scheduled = Date.parse(row.scheduled_at);
    if (Number.isNaN(scheduled)) return false;
    if (scheduled > at) return false;
  }

  if (!isBlank(row.expired_at)) {
    const expired = Date.parse(row.expired_at);
    if (Number.isNaN(expired)) return false;
    if (expired <= at) return false;
  }

  return true;
}
