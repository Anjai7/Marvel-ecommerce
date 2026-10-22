import ProductCard from "../components/ProductCard";
import { SectionShell } from "./SectionShell";

/**
 * The category listing section: the product listing of a category page.
 *
 * The section does not fetch. The caller resolves the listing and passes it
 * in through `products`; this component applies the page's configuration —
 * the stock filter, the price range, the sort and the page size — and lays
 * the products out.
 *
 * `page_size` of 0 means "no pagination": every product of the listing is
 * shown.
 */

const SORTS = {
  featured: () => 0,
  newest: (a, b) => String(b?.created_at ?? "").localeCompare(String(a?.created_at ?? "")),
  price_asc: (a, b) => Number(a?.price ?? 0) - Number(b?.price ?? 0),
  price_desc: (a, b) => Number(b?.price ?? 0) - Number(a?.price ?? 0),
  rating: (a, b) => Number(b?.rating ?? 0) - Number(a?.rating ?? 0),
};

/** True when the product is in stock — or when nothing says that it is not. */
function isInStock(product) {
  const stock = product?.stock ?? product?.stock_quantity ?? product?.quantity;
  if (typeof stock === "number" && Number.isFinite(stock)) return stock > 0;
  const flag = product?.in_stock ?? product?.is_in_stock;
  if (typeof flag === "boolean") return flag;
  return true;
}

/**
 * The products a category listing shows.
 */
function selectListing(products, { sort, page_size, in_stock_only, min_price, max_price } = {}) {
  const list = Array.isArray(products) ? products.filter(Boolean) : [];

  let selected = list;
  if (in_stock_only) selected = selected.filter(isInStock);

  const min = Number(min_price);
  if (Number.isFinite(min) && min > 0) {
    selected = selected.filter((product) => Number(product?.price ?? 0) >= min);
  }
  const max = Number(max_price);
  if (Number.isFinite(max) && max > 0) {
    selected = selected.filter((product) => Number(product?.price ?? 0) <= max);
  }

  const comparator = SORTS[sort] ?? SORTS.featured;
  selected = [...selected].sort(comparator);

  const size = Number(page_size);
  if (Number.isFinite(size) && size > 0) selected = selected.slice(0, size);
  return selected;
}

export default function CategoryListingSection({
  layout,
  sort,
  page_size,
  in_stock_only,
  min_price,
  max_price,
  style,
  products,
  onNavigate,
}) {
  const items = selectListing(products, {
    sort,
    page_size,
    in_stock_only,
    min_price,
    max_price,
  });
  const mode = layout === "list" ? "list" : "grid";

  if (!items.length) return null;

  return (
    <SectionShell style={style} className={`section-listing section-listing--${mode}`}>
      <div className="section-listing__items">
        {items.map((product, index) => (
          <div
            className="section-listing__item"
            key={product?.id ?? `${product?.title ?? "product"}-${index}`}
          >
            <ProductCard product={product} onNavigate={onNavigate} />
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
