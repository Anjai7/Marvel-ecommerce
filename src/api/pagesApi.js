// The CMS page endpoints. Transport lives in client.js; the admin operations
// (list, save, publish) live here too, so the whole page contract has one
// import site.
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

/* -------------------------------------------------------------------------- */
/* The admin operations                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The admin page list.
 *
 * `includeInactive` asks for the drafts and the hidden pages too — the
 * editor has to be able to see a page that is not live, otherwise it could
 * never bring it back.
 */
export const apiFetchPages = (opts = {}) =>
  apiFetch(`${PAGES}${query({ includeInactive: opts.includeInactive })}`);

/** One page with every section, the disabled ones included. */
export const apiFetchPage = (id) => apiFetch(`${PAGES}/${enc(id)}`);

/** Create a page. The server makes it a draft unless a status is sent. */
export const apiSavePage = (page) => apiFetch(PAGES, { method: "POST", body: page });

/** Patch the page metadata. Only the whitelisted columns are written. */
export const apiUpdatePage = (id, patch) =>
  apiFetch(`${PAGES}/${enc(id)}`, { method: "PATCH", body: patch });

/** Delete the page and its sections. */
export const apiDeletePage = (id) => apiFetch(`${PAGES}/${enc(id)}`, { method: "DELETE" });

/**
 * Replace the whole ordered section list in one call.
 *
 * A section with an id is an update, a section without one is an insert, and
 * a section left out of the array is deleted. The array order is the new
 * order — the server renumbers the positions itself.
 */
export const apiSavePageSections = (id, sections) =>
  apiFetch(`${PAGES}/${enc(id)}/sections`, { method: "PUT", body: { sections } });

/**
 * Publish the page, or schedule it.
 *
 * `status` is never sent: the publish route always sets `published`, and a
 * future `scheduled_at` is what makes the page wait for its moment. The
 * answer carries the derived `scheduled` flag.
 */
export const apiPublishPage = (id, schedule = {}) =>
  apiFetch(`${PAGES}/${enc(id)}/publish`, { method: "POST", body: schedule });

/** Send the page back to draft. */
export const apiUnpublishPage = (id) =>
  apiFetch(`${PAGES}/${enc(id)}/unpublish`, { method: "POST" });
