/**
 * The shared shell of every CMS section, plus the one helper every section
 * that can hold a link needs.
 *
 * The shell is the only place that reads the `style` block: the background,
 * the vertical padding and the maximum width become the modifier classes
 * `bg-*`, `pt-*`, `pb-*` and `mw-*`, which `sections.css` styles.
 *
 * `safeHref` is the single gate a stored link passes through. A stored link
 * is a hash route (`#/category/electronics`), a site-relative path
 * (`/category/electronics`) or an absolute URL (`https://…`). Anything else —
 * `javascript:` in particular — is dropped instead of rendered, so a section
 * can never carry a script URL into the DOM.
 */

import { isSafeUrl } from "../../server/lib/sectionTypes.js";
import { toAppHref } from "../components/ui/linkTarget";
import "./sections.css";

export function SectionShell({ style, children, className = "" }) {
  return (
    <section
      className={`section-shell bg-${style?.background ?? "none"} pt-${style?.padding_top ?? "md"} pb-${style?.padding_bottom ?? "md"} mw-${style?.max_width ?? "content"} ${className}`}
    >
      {children}
    </section>
  );
}

/**
 * A link that looks like the house button.
 *
 * The house `Button` cannot render as a link: it wraps its children in a
 * content span, and the Radix slot it uses for `asChild` expects exactly one
 * element child — it throws on the button's own three children. A call to
 * action is a *destination*, so it stays a real anchor (middle-click,
 * ctrl-click and "copy the link address" all keep working) and carries the
 * button's own classes.
 */
export function SectionLink({ href, variant = "accent", size = "lg", className = "", children }) {
  return (
    <a href={href} className={`ui-btn ui-btn-${variant} ui-btn-${size} ${className}`}>
      {children}
    </a>
  );
}

/**
 * The href for a stored link, or `null` when the link is missing or unsafe.
 *
 * `isSafeUrl` resolves the scheme against an allowlist, so `javascript:`,
 * `data:` and a newline-obfuscated `java\nscript:` are all rejected. A
 * site-relative path becomes a hash route, because this app has no
 * path-based router.
 */
// The shell and the link rule are the shared base of the section family; the
// Fast Refresh rule does not apply to them.
// oxlint-disable-next-line react/only-export-components
export function safeHref(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!isSafeUrl(trimmed)) return null;
  // A fragment or a hash route is already a destination.
  if (trimmed.startsWith("#")) return trimmed;
  // An absolute URL leaves the app as it is.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return toAppHref(trimmed);
}
