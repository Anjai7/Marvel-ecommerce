// The CMS page endpoints. Transport lives in client.js; the admin operations
// (list, save, publish) join this module in the admin task.
import { apiFetch } from "./client.js";

const enc = encodeURIComponent;

/** Build `?preview=1`; empty values are omitted. */
function query(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    search.set(key, value === true ? "1" : String(value));
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
}

const PAGES = "/pages";

/**
 * The page of one slug, with its sections.
 *
 * `preview` reveals a draft, but only to a request that carries an admin
 * token: the client sends the Bearer token automatically, so the same call
 * serves the storefront and the admin preview.
 */
export const apiFetchPageBySlug = (slug, { preview } = {}) =>
  apiFetch(`${PAGES}/slug/${enc(slug)}${query({ preview: preview ? 1 : "" })}`);

/**
 * The page bound to one category, or `null` when the category has none.
 *
 * A category without a custom page is a normal case and not a failure, so
 * this resolves `null` rather than throwing.
 */
export const apiFetchCategoryPage = (categoryId, { preview } = {}) =>
  apiFetch(`${PAGES}/category/${enc(categoryId)}${query({ preview: preview ? 1 : "" })}`);

/**
 * The `{ page, sections }` shape every page read answers with.
 *
 * `GET /api/pages/slug/:slug` answers a hybrid envelope — the page's fields
 * are at the top level *and* under `page` — while `GET /api/pages/category/:id`
 * answers flat. This normalises both into one shape.
 */
export function normalisePagePayload(payload) {
  if (!payload || typeof payload !== "object") return { page: null, sections: [] };

  const row = payload.page && typeof payload.page === "object" ? payload.page : payload;
  const sections = Array.isArray(payload.sections) ? payload.sections : [];

  return { page: row, sections };
}
