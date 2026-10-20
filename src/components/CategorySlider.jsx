import { useRef, useState, useEffect } from "react";
import { categorySliderItems } from "../data";
import { apiFetchSiteCategories } from "../api/backendApi";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

export default function CategorySlider() {
  const ref = useRef(null);
  const [activeCat, setActiveCat] = useState(null);
  const [liveCats, setLiveCats] = useState([]);

  useEffect(() => {
    let cancelled = false;
    apiFetchSiteCategories()
      .then((rows) => {
        if (cancelled) return;
        const list = (Array.isArray(rows) ? rows : [])
          .filter((c) => c && c.is_active !== false && c.name)
          .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
          .map((c) => ({ name: c.name, image: c.image_url || "" }));
        setLiveCats(list);
      })
      .catch((error) => {
        // Fall back to static categorySliderItems below, but leave a trace for outages.
        console.error("Failed to load site categories; using static fallback.", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Live categories win when non-empty; otherwise static fallback (never blank).
  const cats = liveCats.length > 0 ? liveCats : categorySliderItems;

  const scroll = (dir) => {
    if (ref.current) ref.current.scrollLeft += dir * 280;
  };

  return (
    <div className="cat-slider-section">
      <div className="container">
        <div className="cat-slider-wrap">
          <button
            className="cat-scroll-btn cat-scroll-left"
            id="cat-scroll-left"
            onClick={() => scroll(-1)}
            aria-label="Scroll left"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="cat-slider" ref={ref}>
            {cats.map((cat) => {
              const isActive = activeCat === cat.name;
              return (
                <motion.div
                  className={`cat-item ${isActive ? "active" : ""}`}
                  key={cat.name}
                  id={`cat-${cat.name.toLowerCase()}`}
                  onClick={() => setActiveCat(isActive ? null : cat.name)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveCat(isActive ? null : cat.name);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isActive}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="cat-img-wrap">
                    {cat.image && <img src={cat.image} alt={cat.name} loading="lazy" />}
                  </div>
                  <span className="cat-label">{cat.name}</span>
                </motion.div>
              );
            })}
          </div>

          <button
            className="cat-scroll-btn cat-scroll-right"
            id="cat-scroll-right"
            onClick={() => scroll(1)}
            aria-label="Scroll right"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
