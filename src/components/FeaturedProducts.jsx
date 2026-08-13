import { useRef, useState } from "react";
import ProductCard from "./ProductCard";
import { featuredProducts } from "../data";
import { Button } from "./ui";
import { ChevronLeft, ChevronRight, Award } from "lucide-react";

export default function FeaturedProducts({ onQuickView }) {
  const scrollRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  const updateArrows = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanLeft(scrollLeft > 0);
    setCanRight(scrollLeft + clientWidth < scrollWidth - 4);
  };

  const scroll = (dir) => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft += dir * 460;
      setTimeout(updateArrows, 320);
    }
  };

  return (
    <div className="container section-wrap" id="featured-products">
      <div className="section-head" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              background: "var(--navy-bg)",
              padding: "8px",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Award size={22} color="var(--navy)" />
          </div>
          <div>
            <h2 className="section-title" style={{ margin: 0 }}>
              Featured Products
            </h2>
            <p style={{ fontSize: 12, color: "var(--gray-500)", margin: 0 }}>
              Curated selection of our top customer favorites
            </p>
          </div>
        </div>

        <Button variant="outline" size="sm" className="view-all-btn" id="featured-view-all">
          View All ›
        </Button>
      </div>

      <div className="featured-wrap">
        <button
          className="featured-scroll-btn featured-scroll-left"
          id="featured-prev"
          onClick={() => scroll(-1)}
          disabled={!canLeft}
          aria-label="Scroll left"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="featured-scroll" ref={scrollRef} onScroll={updateArrows}>
          {featuredProducts.map((product) => (
            <div className="featured-card" key={product.id}>
              <ProductCard product={product} onQuickView={onQuickView} />
            </div>
          ))}
        </div>

        <button
          className="featured-scroll-btn featured-scroll-right"
          id="featured-next"
          onClick={() => scroll(1)}
          disabled={!canRight}
          aria-label="Scroll right"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
