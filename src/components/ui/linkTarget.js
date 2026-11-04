import { navigateToPath } from "../../lib/routes";

/**
 * Where a stored link points.
 *
 * This app uses clean browser history routing (e.g. `/category/electronics`, `/admin`, `/cart`).
 * A stored link is either a site route or an absolute `https://` URL.
 */

/** The href an `<a>` should carry for a stored link. */
export function toAppHref(href) {
  const value = typeof href === "string" ? href.trim() : "";
  if (!value) return "/";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("javascript:") || value.startsWith("mailto:")) return "/";
  const clean = value.replace(/^#\/?/, "").replace(/^\/+/, "");
  return clean ? `/${clean}` : "/";
}

/** Follow a stored link: an absolute URL navigates away, anything else uses browser history routing. */
export function followStoredLink(href) {
  const value = typeof href === "string" ? href.trim() : "";
  if (!value) return;
  if (/^https?:\/\//i.test(value)) {
    if (typeof window !== "undefined") {
      window.location.href = value;
    }
    return;
  }
  const appPath = toAppHref(value);
  navigateToPath(appPath);
}
