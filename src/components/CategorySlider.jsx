import { useRef, useState } from "react";
import { categorySliderItems } from "../data";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

export default function CategorySlider() {
  const ref = useRef(null);
  const [activeCat, setActiveCat] = useState(null);

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
            {categorySliderItems.map((cat) => {
              const isActive = activeCat === cat.name;
              return (
                <motion.div
                  className={`cat-item ${isActive ? "active" : ""}`}
                  key={cat.name}
                  id={`cat-${cat.name.toLowerCase()}`}
                  onClick={() => setActiveCat(isActive ? null : cat.name)}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="cat-img-wrap">
                    <img src={cat.image} alt={cat.name} loading="lazy" />
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
