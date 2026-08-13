import { useState } from "react";
import ProductCard from "./ProductCard";
import { trendingProducts } from "../data";
import { TrendingUp } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const COLS = 5;
const ROWS = 3;
const PAGE_SIZE = COLS * ROWS; // 15

export default function TrendingProducts({ onQuickView }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(trendingProducts.length / PAGE_SIZE);
  const start = page * PAGE_SIZE;
  const visibleProducts = trendingProducts.slice(start, start + PAGE_SIZE);

  return (
    <div className="container section-wrap" id="trending-products">
      {/* Section Header */}
      <div className="section-head" style={{ paddingBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              background: "var(--orange-light)",
              padding: "8px",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <TrendingUp size={22} color="var(--orange)" />
          </div>
          <div>
            <h2 className="section-title" style={{ margin: 0 }}>
              Trending Products
            </h2>
            <p style={{ fontSize: 12, color: "var(--gray-500)", margin: 0 }}>
              Handpicked hot deals selling fast right now
            </p>
          </div>
        </div>

        <a
          href="#"
          className="view-all-btn"
          id="trending-view-all"
          style={{ textDecoration: "none" }}
        >
          View all →
        </a>
      </div>

      {/* Product Grid — 5 cols × 3 rows with nav arrows */}
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

        <div className="product-grid">
          {visibleProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onQuickView={onQuickView}
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
    </div>
  );
}
