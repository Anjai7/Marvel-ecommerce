import ProductCard from "../components/ProductCard";
import { SectionShell } from "./SectionShell";

/**
 * The product grid section: a grid, a carousel or a list of products.
 *
 * The section does not fetch. The caller resolves the products the section
 * refers to and passes them in through `products`; this component only
 * chooses which of them to show:
 *
 *   `product_ids`        an explicit list — the products are shown in the
 *                        order of the list, and a product that was not
 *                        resolved is simply skipped
 *   `source_category_id` the products of one category, when the products
 *                        themselves carry the category they belong to
 *   neither              every product the caller resolved (the newest
 *                        arrivals, for instance)
 *
 * `limit` caps the count afterwards, so a limit of 2 shows the first two
 * products of the selection.
 */

/** True when the product belongs to the section's source category. */
function matchesSourceCategory(product, sourceCategoryId) {
  if (!sourceCategoryId) return true;
  const categoryId = product?.category_id ?? product?.source_category_id ?? null;
  // The caller may have resolved the category's products already; only filter
  // when the products actually carry the category they belong to.
  if (categoryId === null || categoryId === undefined) return true;
  return String(categoryId) === String(sourceCategoryId);
}

/**
 * The products a product grid shows.
 */
function selectProducts(products, { product_ids, source_category_id, limit } = {}) {
  const list = Array.isArray(products) ? products.filter(Boolean) : [];
  const ids = Array.isArray(product_ids)
    ? product_ids.filter((id) => typeof id === "string" && id !== "")
    : [];

  let selected;
  if (ids.length) {
    const byId = new Map(list.map((product) => [String(product?.id), product]));
    selected = ids.map((id) => byId.get(String(id))).filter(Boolean);
  } else {
    selected = list.filter((product) => matchesSourceCategory(product, source_category_id));
  }

  const cap = Number(limit);
  if (Number.isFinite(cap) && cap > 0) selected = selected.slice(0, cap);
  return selected;
}

export default function ProductGridSection({
  product_ids,
  source_category_id,
  limit,
  columns,
  layout,
  show_price,
  style,
  products,
}) {
  const items = selectProducts(products, { product_ids, source_category_id, limit });
  const count = Number(columns);
  const columnCount = Number.isFinite(count) ? Math.min(4, Math.max(2, count)) : 4;
  const mode = layout === "carousel" || layout === "list" ? layout : "grid";

  // A grid with nothing in it renders nothing: an empty frame would only
  // add padding to the page.
  if (!items.length) return null;

  return (
    <SectionShell
      style={style}
      className={`section-product-grid section-product-grid--${mode}${
        show_price === false ? " is-no-price" : ""
      }`}
    >
      <div
        className="section-product-grid__items"
        style={{ "--section-product-columns": columnCount }}
      >
        {items.map((product, index) => (
          <div
            className="section-product-grid__item"
            key={product?.id ?? `${product?.title ?? "product"}-${index}`}
          >
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
