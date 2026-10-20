import { useState } from "react";
import { useContent } from "../context/ContentContext";

export default function BrowseCategoriesMenu({ onClose }) {
  const { categoryTree, loading, error } = useContent();
  const [hoveredIdx, setHoveredIdx] = useState(0); // Default to first item for immediate visual richness

  const roots = Array.isArray(categoryTree) ? categoryTree : [];
  const hoveredCat = roots[hoveredIdx] ?? roots[0] ?? null;

  const notice = loading
    ? "Loading categories…"
    : error
      ? "Categories are temporarily unavailable."
      : roots.length === 0
        ? "No categories to show yet."
        : null;

  return (
    <div className="vcm-overlay" role="menu" aria-label="Browse Categories Menu">
      {notice ? (
        <p style={{ padding: 16, fontSize: 13, color: "var(--gray-500)" }}>{notice}</p>
      ) : (
        <>
          {/* Main category list */}
          <div className="vcm-overlay-list" role="menubar" aria-orientation="vertical">
            {roots.map((cat, i) => (
              <div
                key={cat.id ?? cat.name}
                role="menuitem"
                tabIndex={0}
                className={`vcm-overlay-row ${hoveredIdx === i ? "active" : ""}`}
                onMouseEnter={() => setHoveredIdx(i)}
                onFocus={() => setHoveredIdx(i)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHoveredIdx((prev) => (prev + 1) % roots.length);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHoveredIdx((prev) => (prev - 1 + roots.length) % roots.length);
                  } else if (e.key === "Escape" && onClose) {
                    onClose();
                  }
                }}
              >
                <div className="vcm-overlay-item">
                  <span className="vcm-overlay-icon">{cat.icon || "•"}</span>
                  <span className="vcm-overlay-name">{cat.name}</span>
                  <span className="vcm-overlay-arrow">›</span>
                </div>
              </div>
            ))}
          </div>

          {/* Sub-panel — sits to the right of the list */}
          {hoveredCat && hoveredCat.children?.length > 0 && (
            <div className="vcm-overlay-sub-panel" role="menu">
              <div className="vcm-overlay-sub-header">
                <span>{hoveredCat.icon || "•"}</span> {hoveredCat.name}
              </div>
              <div className="vcm-overlay-sub-list">
                {hoveredCat.children.map((sub) => (
                  <div
                    key={sub.id ?? sub.name}
                    role="menuitem"
                    tabIndex={0}
                    className="vcm-overlay-sub-item"
                  >
                    {sub.name}
                  </div>
                ))}
              </div>
              <div className="vcm-overlay-sub-footer" role="button" tabIndex={0}>
                View All in {hoveredCat.name} →
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
