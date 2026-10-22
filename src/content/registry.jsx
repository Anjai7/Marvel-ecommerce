/**
 * The section registry: the map from a stored section `type` to the React
 * component that renders it.
 *
 * The registry is the single place that knows which component belongs to
 * which type. The renderer resolves a type through it, and the admin form
 * generator builds its controls from the same schema.
 */

import HeroSection from "../sections/HeroSection";
import RichTextSection from "../sections/RichTextSection";
import ImageSection from "../sections/ImageSection";
import GallerySection from "../sections/GallerySection";
import ProductGridSection from "../sections/ProductGridSection";
import CategoryGridSection from "../sections/CategoryGridSection";
import PromoBannerSection from "../sections/PromoBannerSection";
import CtaSection from "../sections/CtaSection";
import FaqSection from "../sections/FaqSection";
import VideoSection from "../sections/VideoSection";
import CategoryListingSection from "../sections/CategoryListingSection";
import SpacerSection from "../sections/SpacerSection";

/**
 * A Map, not a plain object.
 *
 * `REGISTRY[type]` on an object literal returns `Object.prototype.toString`
 * for the key "toString" and `Object.prototype` for "__proto__", so a
 * stored type string could resolve to a prototype member and be rendered as
 * a component. `Map.get` has no prototype chain.
 */
export const SECTION_REGISTRY = new Map([
  ["hero", HeroSection],
  ["richtext", RichTextSection],
  ["image", ImageSection],
  ["gallery", GallerySection],
  ["product_grid", ProductGridSection],
  ["category_grid", CategoryGridSection],
  ["promo_banner", PromoBannerSection],
  ["cta", CtaSection],
  ["faq", FaqSection],
  ["video", VideoSection],
  ["category_listing", CategoryListingSection],
  ["spacer", SpacerSection],
]);

/**
 * The component that renders a section type, or `null` when the type is
 * unknown.
 *
 * A non-string type is never a key of the registry, so it resolves to
 * `null` as well.
 */
// The registry and its resolver belong together; the Fast Refresh rule does
// not apply to a registry module.
// oxlint-disable-next-line react/only-export-components
export function resolveSection(type) {
  if (typeof type !== "string") return null;
  return SECTION_REGISTRY.get(type) ?? null;
}
