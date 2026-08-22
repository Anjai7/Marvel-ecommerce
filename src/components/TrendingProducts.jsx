import { useState, useEffect } from "react";
import ProductCard from "./ProductCard";
import { TrendingUp, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { apiFetchProducts } from "../api/backendApi";
import { ProductGridSkeleton } from "./ui/ProductSkeleton";

const COLS = 4;
const ROWS = 3;
const PAGE_SIZE = COLS * ROWS; // 12 items (3 rows x 4 columns)

export default function TrendingProducts({ onQuickView, onNavigate, onSelectProduct }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const loadDynamicProducts = async () => {
    setLoading(true);
    try {
      const liveProds = await apiFetchProducts();
      if (liveProds && Array.isArray(liveProds)) {
        setProducts(liveProds);
      }
    } catch (err) {
      console.error("Could not fetch live trending products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDynamicProducts();
  }, []);

  const totalPages = Math.ceil(products.length / PAGE_SIZE) || 1;
  const start = page * PAGE_SIZE;
  const visibleProducts = products.slice(start, start + PAGE_SIZE);

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
        <div className="section-head" style={{ paddingBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="section-head-icon is-orange">
              <TrendingUp size={22} color="var(--orange)" />
            </div>
            <div>
              <h2 className="section-title" style={{ margin: 0 }}>
                🔥 Trending Now
              </h2>
              <p className="section-subtitle">
                Live catalog &amp; trending items from verified vendors
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={loadDynamicProducts}
              style={{
                background: "none",
                border: "none",
                color: "var(--gray-500)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12
              }}
              title="Refresh from DB"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
            </button>

            <a
              href="#all-products"
              onClick={(e) => {
                e.preventDefault();
                if (onNavigate && products.length > 0) onNavigate(products[0]);
              }}
              className="view-all-link"
              id="trending-view-all"
            >
              View all ({products.length}) →
            </a>
          </div>
        </div>

        {/* Product Grid / Skeleton State */}
        {loading ? (
          <ProductGridSkeleton count={12} />
        ) : products.length === 0 ? (
          <div style={{
            padding: "48px 24px",
            textAlign: "center",
            background: "#ffffff",
            borderRadius: 14,
            border: "1px solid #e2e8f0"
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>
              No products found in live database
            </div>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
              Seed synthetic catalog or add products from the Vendor Store Hub.
            </p>
            <button
              onClick={loadDynamicProducts}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                background: "var(--navy-light, #2563eb)",
                color: "#fff",
                border: "none",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Retry Database Query
            </button>
          </div>
        ) : (
          <div className="trending-grid-wrap">
            {totalPages > 1 && (
              <button
                className="trending-nav-btn trending-nav-left"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
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
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                aria-label="Next"
              >
                <ChevronRight size={20} />
              </button>
            )}
          </div>
        )}

        {/* Bottom Pagination / View More */}
        {!loading && products.length > PAGE_SIZE && (
          <div style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 12,
            marginTop: 24
          }}>
            <span style={{ fontSize: 13, color: "var(--gray-600)", fontWeight: 500 }}>
              Showing {start + 1}–{Math.min(start + PAGE_SIZE, products.length)} of {products.length} Products (Page {page + 1} of {totalPages})
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
