import React, { useEffect } from "react";
import { applySeo } from "../../lib/seo";

/**
 * The first value that carries something.
 *
 * A blank string is not a value: an empty SEO title falls back to the page
 * title rather than writing an empty document title.
 */
function firstText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return "";
}

/**
 * The canonical URL of a page that has none of its own.
 *
 * A hash URL is not part of the HTTP resource identity, so the canonical
 * points at the clean page URL `/pages/<slug>` — the address the sitemap
 * lists and the address a crawler asks for.
 */
function defaultCanonical(slug) {
  const value = typeof slug === "string" ? slug.trim() : "";
  if (!value) return "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return origin ? `${origin}/pages/${value}` : "";
}

/**
 * The document head of a CMS page.
 *
 * The component renders nothing — it only writes the head — and it writes it
 * from the page's `seo` block, falling back to the page's own title and
 * description when the editor left the SEO field empty.
 *
 * The canonical URL is the one the editor set, or the clean page URL
 * `/pages/<slug>`, which is what the sitemap lists. A preview is never
 * indexed, so the preview always sets `noindex`.
 */
export default function SeoHead({ page, preview = false }) {
  const seo = page?.seo && typeof page.seo === "object" && !Array.isArray(page.seo) ? page.seo : {};

  const title = firstText(seo.meta_title, seo.title, page?.title);
  const description = firstText(seo.meta_description, seo.description, page?.description);
  const ogImage = firstText(seo.og_image);
  const canonical = firstText(seo.canonical) || defaultCanonical(page?.slug);
  const noindex = preview === true || seo.noindex === true;

  useEffect(() => {
    applySeo({ title, description, canonical, ogImage, noindex });
  }, [title, description, canonical, ogImage, noindex]);

  return null;
}
