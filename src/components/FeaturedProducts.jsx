import React, { useRef, useState } from "react";
import ProductCard from "./ProductCard";
import { featuredProducts } from "../data";
import { ChevronLeft, ChevronRight, Award, Sparkles } from "lucide-react";

export default function FeaturedProducts({ onQuickView, onNavigate }) {
  const scrollRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  const updateArrows = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanLeft(scrollLeft > 4);
    setCanRight(scrollLeft + clientWidth < scrollWidth - 6);
  };

  const scroll = (dir) => {
    if (scrollRef.current) {
      const cardWidth = 280;
      scrollRef.current.scrollBy({ left: dir * cardWidth * 2, behavior: "smooth" });
      setTimeout(updateArrows, 320);
    }
  };

  return (
    <section className="section-block section-block-featured" id="featured-products">
      <div className="container">
        <div className="section-head" style={{ alignItems: "center", justifyContent: "space-between", paddingBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="section-head-icon is-navy">
              <Award size={22} color="var(--navy)" />
            </div>
            <div>
              <h2 className="section-title" style={{ margin: 0 }}>
                ⭐ Editor's Choice &amp; Featured Products
              </h2>
              <p className="section-subtitle">
                Hand-picked trending items with top verified ratings &amp; exclusive deals
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <a href="#" className="view-all-link" id="featured-view-all">
              View all →
            </a>
          </div>
        </div>

        {/* Carousel Slider */}
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
            {featuredProducts.map((product) => (
              <div className="featured-slide-item" key={product.id}>
                <ProductCard product={product} onQuickView={onQuickView} onNavigate={onNavigate} />
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
      </div>
    </section>
  );
}
