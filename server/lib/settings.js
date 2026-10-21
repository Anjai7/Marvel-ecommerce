/**
 * The settings keys the store knows about.
 *
 * `site_settings` is a free-form key/value table, so nothing in the database
 * stops a typo from creating a row that no screen reads. This list is the
 * allow-list: the write route rejects a key that is not here, and the seed
 * asserts that the rows it writes match it.
 */
export const SETTINGS_KEYS = [
  "currency",
  "store",
  "shipping",
  "inventory",
  "footer",
  "trust",
  "reviews",
  "hero_fallback",
];

/** The group each key is filed under, for the settings screen. */
export const SETTINGS_GROUPS = {
  currency: "general",
  store: "general",
  shipping: "commerce",
  inventory: "commerce",
  footer: "chrome",
  trust: "chrome",
  reviews: "commerce",
  hero_fallback: "chrome",
};
