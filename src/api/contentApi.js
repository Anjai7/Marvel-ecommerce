// Content endpoints only — transport lives in client.js. One function per
// operation, `URLSearchParams` for queries, no state and no caching.
import { apiFetch } from "./client.js";

const enc = encodeURIComponent;

/** Build `?includeInactive=1&placement=...`; empty values are omitted. */
function query(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    search.set(key, value === true ? "1" : String(value));
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
}

const idPath = (base, id) => `${base}/${enc(id)}`;
const orders = (list) => ({ method: "PATCH", body: { orders: list } });

/* -------------------------------------------------------------------------- */
/* Hero slides — /content/hero                                                */
/* -------------------------------------------------------------------------- */
const HERO = "/content/hero";

export const apiFetchHeroSlides = (opts = {}) =>
  apiFetch(`${HERO}${query({ includeInactive: opts.includeInactive })}`);

export const apiSaveHeroSlide = (slide) => apiFetch(HERO, { method: "POST", body: slide });

export const apiUpdateHeroSlide = (id, patch) =>
  apiFetch(idPath(HERO, id), { method: "PATCH", body: patch });

export const apiDeleteHeroSlide = (id) => apiFetch(idPath(HERO, id), { method: "DELETE" });

export const apiReorderHeroSlides = (list) => apiFetch(`${HERO}/reorder`, orders(list));

/* -------------------------------------------------------------------------- */
/* Categories — /categories                                                   */
/* -------------------------------------------------------------------------- */
const CATEGORIES = "/categories";

export const apiFetchCategories = (opts = {}) =>
  apiFetch(`${CATEGORIES}${query({ includeInactive: opts.includeInactive })}`);

export const apiFetchCategoryTree = (opts = {}) =>
  apiFetch(`${CATEGORIES}/tree${query({ includeInactive: opts.includeInactive })}`);

export const apiFetchCategoryBySlug = (slug) => apiFetch(`${CATEGORIES}/slug/${enc(slug)}`);

export const apiFetchCategoryByPath = (path) => apiFetch(`${CATEGORIES}/path${query({ path })}`);

export const apiSaveCategory = (category) =>
  apiFetch(CATEGORIES, { method: "POST", body: category });

export const apiUpdateCategory = (id, patch) =>
  apiFetch(idPath(CATEGORIES, id), { method: "PATCH", body: patch });

export const apiDeleteCategory = (id) => apiFetch(idPath(CATEGORIES, id), { method: "DELETE" });

export const apiReorderCategories = (list) => apiFetch(`${CATEGORIES}/reorder`, orders(list));

/* -------------------------------------------------------------------------- */
/* Promo banners — /content/banners                                           */
/* -------------------------------------------------------------------------- */
const BANNERS = "/content/banners";

export const apiFetchBanners = (opts = {}) =>
  apiFetch(
    `${BANNERS}${query({ includeInactive: opts.includeInactive, placement: opts.placement })}`
  );

export const apiSaveBanner = (banner) => apiFetch(BANNERS, { method: "POST", body: banner });

export const apiUpdateBanner = (id, patch) =>
  apiFetch(idPath(BANNERS, id), { method: "PATCH", body: patch });

export const apiDeleteBanner = (id) => apiFetch(idPath(BANNERS, id), { method: "DELETE" });

export const apiReorderBanners = (list) => apiFetch(`${BANNERS}/reorder`, orders(list));

/* -------------------------------------------------------------------------- */
/* Footer — /content/footer                                                   */
/* -------------------------------------------------------------------------- */
const FOOTER = "/content/footer";
const FOOTER_SECTIONS = `${FOOTER}/sections`;
const FOOTER_LINKS = `${FOOTER}/links`;

export const apiFetchFooter = (opts = {}) =>
  apiFetch(`${FOOTER}${query({ includeInactive: opts.includeInactive })}`);

export const apiSaveFooterSection = (section) =>
  apiFetch(FOOTER_SECTIONS, { method: "POST", body: section });

export const apiUpdateFooterSection = (id, patch) =>
  apiFetch(idPath(FOOTER_SECTIONS, id), { method: "PATCH", body: patch });

export const apiDeleteFooterSection = (id) =>
  apiFetch(idPath(FOOTER_SECTIONS, id), { method: "DELETE" });

export const apiReorderFooterSections = (list) =>
  apiFetch(`${FOOTER_SECTIONS}/reorder`, orders(list));

export const apiSaveFooterLink = (link) => apiFetch(FOOTER_LINKS, { method: "POST", body: link });

export const apiUpdateFooterLink = (id, patch) =>
  apiFetch(idPath(FOOTER_LINKS, id), { method: "PATCH", body: patch });

export const apiDeleteFooterLink = (id) => apiFetch(idPath(FOOTER_LINKS, id), { method: "DELETE" });

export const apiReorderFooterLinks = (list) => apiFetch(`${FOOTER_LINKS}/reorder`, orders(list));

/* -------------------------------------------------------------------------- */
/* Navigation menu — /menu (the one bare-array response)                      */
/* -------------------------------------------------------------------------- */
const MENU = "/menu";

/** `GET /api/menu` resolves a bare `MenuNode[]`, not a wrapped object. */
export const apiFetchMenuItems = (role = "user", opts = {}) =>
  apiFetch(`${MENU}${query({ role, includeInactive: opts.includeInactive })}`);

export const apiSaveMenuItem = (item) => apiFetch(MENU, { method: "POST", body: item });

export const apiUpdateMenuItem = (id, patch) =>
  apiFetch(idPath(MENU, id), { method: "PATCH", body: patch });

export const apiDeleteMenuItem = (id) => apiFetch(idPath(MENU, id), { method: "DELETE" });

export const apiReorderMenuItems = (list) => apiFetch(`${MENU}/reorder`, orders(list));

/* -------------------------------------------------------------------------- */
/* Images — /upload                                                           */
/* -------------------------------------------------------------------------- */
export function apiUploadImage(file, folder = "marvel_products") {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("folder", folder);
  return apiFetch("/upload", { method: "POST", formData });
}
