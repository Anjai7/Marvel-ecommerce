/**
 * The document head of a CMS page.
 *
 * `applySeo` is the one place that writes the title, the description, the
 * canonical URL, the Open Graph tags and the robots directive. Every tag is
 * **created** when it is absent and **updated** when it is present, so the
 * function is safe to call on every render of a page.
 *
 * Two rules hold everywhere:
 *
 *   1. **Nothing is invented.** A field that is absent leaves its tag alone —
 *      an absent title never blanks the document title, and an absent
 *      description never writes an empty meta tag.
 *   2. **The robots tag is the exception.** It is a directive rather than a
 *      value: `noindex: true` writes `noindex,nofollow` and `noindex: false`
 *      removes the tag, because a leftover `noindex` from a preview must not
 *      hide a published page from a crawler.
 */

/** The content of the robots meta when the page must not be indexed. */
const NOINDEX_CONTENT = "noindex,nofollow";

/** True for a value that carries something: a non-blank string. */
function isPresent(value) {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Create the meta tag when it is missing, update it when it is there.
 *
 * The attribute that identifies the tag is passed in, because the Open Graph
 * tags use `property` and the description and robots tags use `name`.
 */
function upsertMeta(head, attribute, key, content) {
  let tag = head.querySelector(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, key);
    head.appendChild(tag);
  }
  tag.setAttribute("content", content);
  return tag;
}

/** Create the canonical link when it is missing, update it when it is there. */
function upsertCanonical(head, href) {
  let tag = head.querySelector('link[rel="canonical"]');
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", "canonical");
    head.appendChild(tag);
  }
  tag.setAttribute("href", href);
  return tag;
}

/**
 * Apply the robots directive.
 *
 * `true` writes the noindex directive, `false` removes the tag and
 * `undefined` leaves the head alone — an absent directive is not a request
 * to change one.
 */
function applyRobots(head, noindex) {
  const existing = head.querySelector('meta[name="robots"]');

  if (noindex === true) {
    if (existing) existing.setAttribute("content", NOINDEX_CONTENT);
    else upsertMeta(head, "name", "robots", NOINDEX_CONTENT);
    return;
  }

  if (noindex === false && existing) existing.remove();
}

/**
 * Write the SEO fields of a page into the document head.
 *
 * @param {object} [fields]
 * @param {string} [fields.title] - The document title and the `og:title`.
 * @param {string} [fields.description] - The description meta and `og:description`.
 * @param {string} [fields.canonical] - The canonical link and `og:url`.
 * @param {string} [fields.ogImage] - The `og:image`.
 * @param {boolean} [fields.noindex] - `true` writes `noindex,nofollow`, `false` removes the tag.
 */
export function applySeo(fields = {}) {
  if (typeof document === "undefined") return;

  const head = document.head;
  if (!head) return;

  const { title, description, canonical, ogImage, noindex } = fields ?? {};

  if (isPresent(title)) {
    document.title = title;
    upsertMeta(head, "property", "og:title", title);
  }

  if (isPresent(description)) {
    upsertMeta(head, "name", "description", description);
    upsertMeta(head, "property", "og:description", description);
  }

  if (isPresent(ogImage)) {
    upsertMeta(head, "property", "og:image", ogImage);
  }

  if (isPresent(canonical)) {
    upsertCanonical(head, canonical);
    upsertMeta(head, "property", "og:url", canonical);
  }

  applyRobots(head, noindex);
}
