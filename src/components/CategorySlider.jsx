import { useRef, useState } from "react";
import { useContent } from "../context/ContentContext";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

/** Join a flat category's parent chain into its full ancestor path. */
function pathOf(category, byId) {
  const segments = [];
  const seen = new Set();
  let cursor = category;

  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    segments.unshift(cursor.slug);
    cursor = cursor.parent_id != null ? byId.get(cursor.parent_id) : null;
  }

  return segments.filter(Boolean).join("/");
}

export default function CategorySlider({ onNavigate }) {
  const { categories, loading, error } = useContent();
  const ref = useRef(null);
  const [activeCat, setActiveCat] = useState(null);

  const byId = new Map((Array.isArray(categories) ? categories : []).map((c) => [c.id, c]));
  const cats = (Array.isArray(categories) ? categories : [])
    .filter((category) => category && category.name && category.show_in_homepage === true)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((category) => ({
      id: category.id,
      name: category.name,
      image: category.image_url || "",
      path: pathOf(category, byId),
    }));

  const scroll = (dir) => {
    if (ref.current) ref.current.scrollLeft += dir * 280;
  };

  const openCategory = (category) => {
    if (!category.path) return;
    setActiveCat(category.name);
    const target = `/category/${category.path}`;
    // The callback takes router paths, while a bare hash assignment needs `#`.
    if (onNavigate) onNavigate(target);
    else window.location.hash = `#${target}`;
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
            {error ? (
              <p style={{ padding: "18px 12px", fontSize: 13, color: "var(--gray-500)" }}>
                Categories are temporarily unavailable.
              </p>
            ) : loading ? (
              <p style={{ padding: "18px 12px", fontSize: 13, color: "var(--gray-500)" }}>
                Loading categories…
              </p>
            ) : cats.length === 0 ? (
              <p style={{ padding: "18px 12px", fontSize: 13, color: "var(--gray-500)" }}>
                No categories to show yet.
              </p>
            ) : (
              cats.map((cat) => {
                const isActive = activeCat === cat.name;
                return (
                  <motion.div
                    className={`cat-item ${isActive ? "active" : ""}`}
                    key={cat.id ?? cat.name}
                    id={`cat-${cat.name.toLowerCase()}`}
                    onClick={() => openCategory(cat)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openCategory(cat);
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
              })
            )}
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
