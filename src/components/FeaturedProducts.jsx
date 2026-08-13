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
    <section className="section-block section-block-featured" id="featured-products">
      <div className="container">
        <div className="section-head" style={{ alignItems: "center", justifyContent: "space-between", paddingBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                background: "var(--navy-bg)",
                padding: "10px",
                borderRadius: "var(--radius-md)",
                display: "flex",
                alignItems: "center",
                border: "1px solid rgba(40, 116, 240, 0.2)"
              }}
            >
              <Award size={22} color="var(--navy)" />
            </div>
            <div>
              <h2 className="section-title" style={{ margin: 0 }}>
                ⭐ Editor's Picks
              </h2>
              <p className="section-subtitle" style={{ fontSize: 13.5, color: "var(--gray-600)", margin: "2px 0 0", fontWeight: 500 }}>
                Our hand-picked top favorites
              </p>
            </div>
          </div>

          <a href="#" className="view-all-link" id="featured-view-all">
            View all →
          </a>
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
    </section>
  );
}
