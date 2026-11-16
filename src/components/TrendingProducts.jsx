import { useState, useEffect } from "react";
import ProductCard from "./ProductCard";
import { TrendingUp, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { apiFetchCategoryProducts } from "../api/backendApi";
import { navigateToPath } from "../lib/routes";
import { ProductGridSkeleton } from "./ui/ProductSkeleton";

const COLS = 4;
const ROWS = 3;
const PAGE_SIZE = COLS * ROWS; // 12 items (3 rows x 4 columns)

export default function TrendingProducts({ onQuickView, onNavigate, onSelectProduct }) {
  const [products, setProducts] = useState([]);
  // How many products the store has, so the section can say "View all (1,000)"
  // and page through them without downloading the whole catalogue.
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const loadDynamicProducts = async () => {
    setLoading(true);
    try {
      const data = await apiFetchCategoryProducts({
        scope: "all",
        page,
        pageSize: PAGE_SIZE,
        sort: "newest",
      });
      setProducts(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number.isFinite(data?.total) ? data.total : 0);
    } catch (err) {
      console.error("Could not fetch live trending products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDynamicProducts();
    // `page` is in the request, so a new page is a new request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const visibleProducts = products;

  const handleCardClick = (product) => {
    if (onSelectProduct) {
      onSelectProduct(product);
    } else if (onNavigate) {
      onNavigate(product);
    }
  };

  return (
    <section className="section-block section-block-trending" id="trending-products">
      <div className="container">
        {/* Section Header */}
        <div className="section-head section-head-trending">
          <div className="section-head-group">
            <div className="section-head-icon is-orange">
              <TrendingUp size={22} color="var(--orange)" />
            </div>
            <div>
              <h2 className="section-title">🔥 Trending Now</h2>
              <p className="section-subtitle">
                Live catalog &amp; trending items from verified vendors
              </p>
            </div>
          </div>

          <div className="section-head-group">
            <button
              onClick={loadDynamicProducts}
              className="refresh-db-btn"
              title="Refresh from DB"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
            </button>

            <a
              href="/products"
              onClick={(e) => {
                e.preventDefault();
                // The whole catalogue, not the first product of it.
                navigateToPath("/products");
              }}
              className="view-all-link"
              id="trending-view-all"
            >
              View all ({total}) →
            </a>
          </div>
        </div>

        {/* Product Grid / Skeleton State */}
        {loading ? (
          <ProductGridSkeleton count={12} />
        ) : products.length === 0 ? (
          <div className="catalog-empty-state">
            <div className="catalog-empty-title">No products found in live database</div>
            <p className="catalog-empty-text">
              Seed synthetic catalog or add products from the Vendor Store Hub.
            </p>
            <button onClick={loadDynamicProducts} className="catalog-empty-retry">
              Retry Database Query
            </button>
          </div>
        ) : (
          <div className="trending-grid-wrap">
            {totalPages > 1 && (
              <button
                className="trending-nav-btn trending-nav-left"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous"
              >
                <ChevronLeft size={20} />
              </button>
            )}

            <div className="product-grid-4x3">
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onQuickView={onQuickView}
                  onNavigate={() => handleCardClick(product)}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <button
                className="trending-nav-btn trending-nav-right"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Next"
              >
                <ChevronRight size={20} />
              </button>
            )}
          </div>
        )}

        {/* Bottom Pagination / View More */}
        {!loading && products.length > 0 && (
          <div className="trending-pagination">
            <span className="trending-pagination-text">
              Showing {start + 1}–{Math.min(start + PAGE_SIZE, total)} of {total} Products (Page{" "}
              {page} of {totalPages})
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
