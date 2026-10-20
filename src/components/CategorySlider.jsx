import { useRef, useState } from "react";
import { useContent } from "../context/ContentContext";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

/** Find a category's full ancestor path by walking the nested tree. */
function pathInTree(nodes, id, trail = []) {
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (!node) continue;
    const segments = [...trail, node.slug].filter(Boolean);
    if (node.id === id) return segments.join("/");

    const found = pathInTree(node.children, id, segments);
    if (found) return found;
  }
  return null;
}

export default function CategorySlider({ onNavigate }) {
  const { categories, categoryTree, loading, errors } = useContent();
  const error = errors?.categories ?? null;
  const ref = useRef(null);
  const [activeCat, setActiveCat] = useState(null);

  const tree = Array.isArray(categoryTree) ? categoryTree : [];
  const cats = (Array.isArray(categories) ? categories : [])
    .filter((category) => category && category.name && category.show_in_homepage === true)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((category) => ({
      id: category.id,
      name: category.name,
      image: category.image_url || "",
      // The nested tree carries the ancestry; a flat active-only list can miss
      // a parent and collapse the path to a bare, ambiguous slug.
      path: pathInTree(tree, category.id) ?? (category.parent_id == null ? category.slug : null),
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
