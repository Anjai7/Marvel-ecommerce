/**
 * Where a stored link points.
 *
 * This app is a **hash router**: a route is `#/category/electronics`, never
 * `/category/electronics`. A stored link is therefore either a hash route or an
 * absolute `https://` URL.
 *
 * A bare path such as `/help` is not a route. Left alone it causes a full
 * page load that the server answers with a 404, so it is normalised to
 * `#/help` — the same route, expressed the way the router understands it.
 *
 * Every surface that renders or follows a stored link goes through this one
 * helper, so there is a single convention rather than one per component.
 */

/** The href an `<a>` should carry for a stored link. */
export function toAppHref(href) {
  const value = typeof href === "string" ? href.trim() : "";
  if (!value) return "#/";
  if (value.startsWith("#/")) return value;
  if (/^https:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `#${value}`;
  return "#/";
}

/** Follow a stored link: an absolute URL navigates away, anything else is a hash route. */
export function followStoredLink(href) {
  const value = typeof href === "string" ? href.trim() : "";
  if (!value) return;
  if (/^https:\/\//i.test(value)) {
    window.location.href = value;
    return;
  }
  window.location.hash = toAppHref(value);
}
