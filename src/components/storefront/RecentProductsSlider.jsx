import React, { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Sparkles, ShoppingBag } from "lucide-react";
import ProductCard from "../ProductCard";
import { apiFetchProducts } from "../../api/backendApi";
import { useSettings } from "../../context/SettingsContext";
import { ProductCarouselSkeleton } from "../ui/ProductSkeleton";
import "./widgets.css";

export default function RecentProductsSlider({ onQuickView, onNavigate, onSelectProduct }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);
  const [touchStart, setTouchStart] = useState(null);

  const { settings } = useSettings();
  const config = settings?.recent_products_slider;

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const all = await apiFetchProducts();
      if (all && Array.isArray(all)) {
        // If admin has configured specific product IDs, honor that list and ordering
        const configuredIds = config?.product_ids;
        if (Array.isArray(configuredIds) && configuredIds.length > 0) {
          const idMap = new Map(all.map((p) => [p.id, p]));
          const selected = configuredIds
            .map((id) => idMap.get(id))
            .filter((p) => Boolean(p && p.moderation_status !== "rejected"));
          setProducts(selected.length > 0 ? selected : all.slice(0, 10));
        } else {
          // Fallback to recent products
          setProducts(all.slice(0, 10));
        }
      }
    } catch (err) {
      console.error("Could not fetch recent products:", err);
    } finally {
      setLoading(false);
    }
  }, [config?.product_ids]);

  useEffect(() => {
    loadProducts();

    const handleCatalogUpdate = () => loadProducts();
    window.addEventListener("marvel_catalog_updated", handleCatalogUpdate);
    window.addEventListener("marvel_settings_updated", handleCatalogUpdate);

    return () => {
      window.removeEventListener("marvel_catalog_updated", handleCatalogUpdate);
      window.removeEventListener("marvel_settings_updated", handleCatalogUpdate);
    };
  }, [loadProducts]);

  const updateArrows = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanLeft(scrollLeft > 10);
    setCanRight(scrollLeft + clientWidth < scrollWidth - 10);
  };

  const scroll = (direction) => {
    if (!scrollRef.current) return;
    const scrollAmount = 300 * direction;
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    setTimeout(updateArrows, 350);
  };

  // Touch / swipe support
  const handleTouchStart = (e) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      scroll(diff > 0 ? 1 : -1);
    }
    setTouchStart(null);
  };

  const handleCardClick = (product) => {
    if (onSelectProduct) {
      onSelectProduct(product);
    } else if (onNavigate) {
      onNavigate(product);
    }
  };

  // If slider is disabled by admin in settings
  if (config && config.enabled === false) {
    return null;
  }

  const title = config?.title || "Recent Additions";
  const subtitle = config?.subtitle || "Handpicked new arrivals & recent drops";

  return (
    <section
      className="section-block section-block-recent-products recent-products-section"
      id="recent-products-slider"
    >
      <div className="container recent-products-container">
        {/* Header */}
        <div className="section-head recent-products-head">
          <div className="recent-products-head-main">
            <div className="recent-products-icon-badge">
              <Sparkles size={22} />
            </div>
            <div>
              <h2 className="section-title recent-products-title">{title}</h2>
              <p className="section-subtitle recent-products-subtitle">{subtitle}</p>
            </div>
          </div>

          {/* Navigation Arrows */}
          <div className="recent-products-nav">
            <button
              type="button"
              className="slider-nav-btn prev-btn"
              onClick={() => scroll(-1)}
              disabled={!canLeft}
              aria-label="Previous products"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="slider-nav-btn next-btn"
              onClick={() => scroll(1)}
              disabled={!canRight}
              aria-label="Next products"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <ProductCarouselSkeleton />
        ) : products.length === 0 ? (
          <div className="recent-products-empty">
            <ShoppingBag size={36} color="#94a3b8" className="recent-products-empty-icon" />
            <h4 className="recent-products-empty-title">No recent products selected yet</h4>
            <p className="recent-products-empty-text">
              Check back soon for latest arrivals and updates.
            </p>
          </div>
        ) : (
          <div
            ref={scrollRef}
            onScroll={updateArrows}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="recent-products-track"
          >
            {products.map((product) => (
              <div key={product.id} className="recent-products-slide">
                <ProductCard
                  product={product}
                  onQuickView={onQuickView}
                  onNavigate={handleCardClick}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
