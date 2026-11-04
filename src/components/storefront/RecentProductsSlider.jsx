import React, { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Sparkles, RefreshCw, ShoppingBag } from "lucide-react";
import ProductCard from "../ProductCard";
import { apiFetchProducts } from "../../api/backendApi";
import { useSettings } from "../../context/SettingsContext";
import { ProductCarouselSkeleton } from "../ui/ProductSkeleton";

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
      className="section-block section-block-recent-products"
      id="recent-products-slider"
      style={{ padding: "40px 0" }}
    >
      <div className="container" style={{ maxWidth: 1240, margin: "0 auto", padding: "0 16px" }}>
        {/* Header */}
        <div
          className="section-head"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 20,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
              }}
            >
              <Sparkles size={22} />
            </div>
            <div>
              <h2
                className="section-title"
                style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "var(--navy, #0f172a)" }}
              >
                {title}
              </h2>
              <p
                className="section-subtitle"
                style={{ margin: "4px 0 0", fontSize: 14, color: "var(--gray-500, #64748b)" }}
              >
                {subtitle}
              </p>
            </div>
          </div>

          {/* Navigation Arrows */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="slider-nav-btn prev-btn"
              onClick={() => scroll(-1)}
              disabled={!canLeft}
              aria-label="Previous products"
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "1px solid #e2e8f0",
                background: canLeft ? "#ffffff" : "#f8fafc",
                color: canLeft ? "#0f172a" : "#cbd5e1",
                cursor: canLeft ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: canLeft ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="slider-nav-btn next-btn"
              onClick={() => scroll(1)}
              disabled={!canRight}
              aria-label="Next products"
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "1px solid #e2e8f0",
                background: canRight ? "#ffffff" : "#f8fafc",
                color: canRight ? "#0f172a" : "#cbd5e1",
                cursor: canRight ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: canRight ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <ProductCarouselSkeleton />
        ) : products.length === 0 ? (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              background: "#f8fafc",
              borderRadius: 16,
              border: "1px dashed #cbd5e1",
            }}
          >
            <ShoppingBag size={36} color="#94a3b8" style={{ margin: "0 auto 12px" }} />
            <h4 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 600, color: "#1e293b" }}>
              No recent products selected yet
            </h4>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
              Check back soon for latest arrivals and updates.
            </p>
          </div>
        ) : (
          <div
            ref={scrollRef}
            onScroll={updateArrows}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={{
              display: "flex",
              gap: 16,
              overflowX: "auto",
              scrollSnapType: "x mandatory",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              padding: "8px 4px 16px",
            }}
          >
            {products.map((product) => (
              <div
                key={product.id}
                style={{
                  flex: "0 0 280px",
                  scrollSnapAlign: "start",
                }}
              >
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
