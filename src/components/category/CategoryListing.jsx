import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import ProductCard from "../ProductCard";
import { apiFetchCategoryProducts } from "../../api/backendApi";

/**
 * The listing of one category: the products of the category path, with the
 * sort, the stock and the price filters and the pagination the page config
 * asks for.
 *
 * `config` is the page's listing configuration:
 *   `sort`       the initial sort (default "newest")
 *   `pageSize`   the page size; 0 (the default) means "no pagination" and
 *                shows every product of the category
 *   `showSort`   show the sort control (default true)
 *   `showFilters` show the stock and price controls (default true)
 */

const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "rating", label: "Top Rated" },
];

const DEFAULT_SORT = "newest";

const CONTROL_LABEL = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "#475569",
  marginBottom: 4,
};

const CONTROL = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 600,
};

const BUTTON = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

function messageOf(error, fallback) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

/** The listing settings, with the documented defaults for everything else. */
function readSettings(config) {
  const source = config && typeof config === "object" ? config : {};
  const sort = source.sort ?? source.defaultSort;
  const pageSize = Number(source.pageSize);

  return {
    layout: source.layout === "list" ? "list" : "grid",
    sort: SORT_OPTIONS.some((option) => option.value === sort) ? sort : DEFAULT_SORT,
    pageSize: Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 0,
    showSort: source.showSort === true,
    showFilters: source.showFilters === true,
  };
}

export default function CategoryListing({ path = "", config, onSelectProduct }) {
  const settings = useMemo(() => readSettings(config), [config]);

  const [sort, setSort] = useState(settings.sort);
  const [page, setPage] = useState(1);
  const [inStock, setInStock] = useState(false);
  // The price inputs are a draft: a request per keystroke would be wasteful.
  const [priceDraft, setPriceDraft] = useState({ min: "", max: "" });
  const [price, setPrice] = useState({ min: "", max: "" });
  const [listing, setListing] = useState({
    key: null,
    error: null,
    items: [],
    total: 0,
    hasMore: false,
  });

  // Any change of the listing resets to the first page.
  const resetToFirstPage = () => setPage(1);

  const commitPrices = () => {
    const next = { min: priceDraft.min.trim(), max: priceDraft.max.trim() };
    setPrice((current) => (next.min === current.min && next.max === current.max ? current : next));
    resetToFirstPage();
  };

  const params = useMemo(() => {
    const next = { path, sort, page, pageSize: settings.pageSize };
    if (inStock) next.inStock = "true";
    if (price.min !== "") next.minPrice = price.min;
    if (price.max !== "") next.maxPrice = price.max;
    return next;
  }, [path, sort, page, inStock, price.min, price.max, settings.pageSize]);

  // The key of the request a result belongs to: a result of another request is
  // stale, so the listing is loading until this one lands.
  const requestKey = JSON.stringify(params);

  useEffect(() => {
    let cancelled = false;

    apiFetchCategoryProducts(params)
      .then((data) => {
        if (cancelled) return;
        setListing({
          key: requestKey,
          error: null,
          items: Array.isArray(data?.items) ? data.items : [],
          total: Number.isFinite(data?.total) ? data.total : 0,
          hasMore: Boolean(data?.hasMore),
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setListing({
          key: requestKey,
          error: messageOf(error, "Could not load products."),
          items: [],
          total: 0,
          hasMore: false,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [params, requestKey]);

  const loading = listing.key !== requestKey;
  const totalPages =
    settings.pageSize > 0 ? Math.max(1, Math.ceil(listing.total / settings.pageSize)) : 1;
  const showPagination = settings.pageSize > 0;

  const changeSort = (value) => {
    setSort(value);
    resetToFirstPage();
  };

  const changeInStock = (value) => {
    setInStock(value);
    resetToFirstPage();
  };

  return (
    <div className="category-listing">
      {(settings.showSort || settings.showFilters) && (
        <div
          className="category-listing-controls"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            gap: 16,
            marginBottom: 20,
          }}
        >
          {settings.showSort && (
            <div>
              <label htmlFor="category-listing-sort" style={CONTROL_LABEL}>
                Sort by
              </label>
              <select
                id="category-listing-sort"
                style={CONTROL}
                value={sort}
                onChange={(event) => changeSort(event.target.value)}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {settings.showFilters && (
            <>
              <div>
                <span style={CONTROL_LABEL}>Availability</span>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#0f172a",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={inStock}
                    onChange={(event) => changeInStock(event.target.checked)}
                  />
                  In stock only
                </label>
              </div>

              <div>
                <label htmlFor="category-listing-min-price" style={CONTROL_LABEL}>
                  Min price
                </label>
                <input
                  id="category-listing-min-price"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  style={{ ...CONTROL, width: 120 }}
                  value={priceDraft.min}
                  onChange={(event) =>
                    setPriceDraft((current) => ({ ...current, min: event.target.value }))
                  }
                  onBlur={commitPrices}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitPrices();
                  }}
                />
              </div>

              <div>
                <label htmlFor="category-listing-max-price" style={CONTROL_LABEL}>
                  Max price
                </label>
                <input
                  id="category-listing-max-price"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Any"
                  style={{ ...CONTROL, width: 120 }}
                  value={priceDraft.max}
                  onChange={(event) =>
                    setPriceDraft((current) => ({ ...current, max: event.target.value }))
                  }
                  onBlur={commitPrices}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitPrices();
                  }}
                />
              </div>

              <button type="button" style={BUTTON} onClick={commitPrices}>
                Apply
              </button>
            </>
          )}
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: 14, color: "#64748b", display: "flex", gap: 8 }}>
          <Loader2 size={16} className="animate-spin" /> Loading products…
        </p>
      ) : listing.error ? (
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
            Could not load products.
          </h2>
          <p style={{ fontSize: 14, color: "#64748b" }}>{listing.error}</p>
        </div>
      ) : listing.items.length === 0 ? (
        <p style={{ fontSize: 14, color: "#64748b" }}>No products in this category yet.</p>
      ) : (
        <div
          className={`product-grid ${settings.layout === "list" ? "product-grid--list" : ""}`.trim()}
        >
          {listing.items.map((product) => (
            <ProductCard key={product.id} product={product} onNavigate={onSelectProduct} />
          ))}
        </div>
      )}

      {showPagination && !loading && !listing.error && (
        <div className="table-pagination-footer" style={{ marginTop: 24 }}>
          <span className="pagination-info">
            Page {page} of {totalPages}
          </span>
          <div className="pagination-buttons">
            <button
              type="button"
              style={{ ...BUTTON, opacity: page === 1 ? 0.5 : 1 }}
              disabled={page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft size={14} style={{ verticalAlign: "middle" }} /> Previous
            </button>
            <button
              type="button"
              style={{ ...BUTTON, opacity: listing.hasMore ? 1 : 0.5 }}
              disabled={!listing.hasMore}
              onClick={() => setPage((current) => current + 1)}
            >
              Next <ChevronRight size={14} style={{ verticalAlign: "middle" }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
