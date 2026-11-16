import React, { useRef, useState, useEffect, useCallback } from "react";
import ProductCard from "./ProductCard";
import { ChevronLeft, ChevronRight, Award, Sparkles, RefreshCw } from "lucide-react";
import { apiFetchCategoryProducts } from "../api/backendApi";
import { navigateToPath } from "../lib/routes";
import { ProductCarouselSkeleton } from "./ui/ProductSkeleton";

// The carousel shows one screenful of the featured products. The whole
// catalogue is a thousand rows, so it is never downloaded to fill a rail.
const FEATURED_COUNT = 12;

export default function FeaturedProducts({ onQuickView, onNavigate, onSelectProduct }) {
  const [products, setProducts] = useState([]);
  // How many products the store has, so the link can say "View all (1,000)".
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  const loadFeatured = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetchCategoryProducts({
        scope: "all",
        pageSize: FEATURED_COUNT,
        sort: "featured",
      });
      setProducts(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number.isFinite(data?.total) ? data.total : 0);
    } catch (err) {
      console.error("Could not fetch featured products:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeatured();

    // Listen for live updates when an admin toggles 'is_featured' in Admin Console
    const handleCatalogUpdate = () => loadFeatured();
    window.addEventListener("marvel_catalog_updated", handleCatalogUpdate);
    return () => window.removeEventListener("marvel_catalog_updated", handleCatalogUpdate);
  }, [loadFeatured]);

  const updateArrows = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanLeft(scrollLeft > 6);
    setCanRight(scrollLeft + clientWidth < scrollWidth - 6);
  };

  const scroll = (dir) => {
    if (scrollRef.current) {
      const cardWidth = 280;
      scrollRef.current.scrollBy({ left: dir * cardWidth * 2, behavior: "smooth" });
      setTimeout(updateArrows, 320);
    }
  };

  const handleCardClick = (product) => {
    if (onSelectProduct) {
      onSelectProduct(product);
    } else if (onNavigate) {
      onNavigate(product);
    }
  };

  return (
    <section className="section-block section-block-featured" id="featured-products">
      <div className="container">
        <div className="section-head">
          <div className="section-head-group">
            <div className="section-head-icon is-navy">
              <Award size={22} color="var(--navy)" />
            </div>
            <div>
              <h2 className="section-title">⭐ Editor's Choice &amp; Featured Products</h2>
            </div>
          </div>

          <div className="section-head-group">
            <button onClick={loadFeatured} className="refresh-db-btn" title="Refresh from DB">
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
              id="featured-view-all"
            >
              View all ({total}) →
            </a>
          </div>
        </div>

        {/* Carousel Slider / Skeleton Loader */}
        {loading ? (
          <ProductCarouselSkeleton count={4} />
        ) : products.length === 0 ? (
          <div className="catalog-empty-state catalog-empty-state-featured">
            <p className="catalog-empty-note">
              No featured products marked yet. Open{" "}
              <strong>Admin Portal &gt; Product Moderation</strong> to feature items.
            </p>
          </div>
        ) : (
          <div className="featured-slider-wrap">
            <button
              className="featured-arrow featured-arrow-left"
              id="featured-prev"
              onClick={() => scroll(-1)}
              disabled={!canLeft}
              aria-label="Scroll left"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="featured-track" ref={scrollRef} onScroll={updateArrows}>
              {products.map((product) => (
                <div className="featured-slide-item" key={product.id}>
                  <ProductCard
                    product={product}
                    onQuickView={onQuickView}
                    onNavigate={() => handleCardClick(product)}
                  />
                </div>
              ))}
            </div>

            <button
              className="featured-arrow featured-arrow-right"
              id="featured-next"
              onClick={() => scroll(1)}
              disabled={!canRight}
              aria-label="Scroll right"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
