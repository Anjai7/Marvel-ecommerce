import { useState } from "react";
import { verticalCategories } from "../data";

export default function BrowseCategoriesMenu({ onClose }) {
  const [hoveredIdx, setHoveredIdx] = useState(0); // Default to first item for immediate visual richness

  const hoveredCat = hoveredIdx !== null ? verticalCategories[hoveredIdx] : null;

  return (
    <div
      className="vcm-overlay"
      role="menu"
      aria-label="Browse Categories Menu"
    >
      {/* Main category list */}
      <div className="vcm-overlay-list" role="menubar" aria-orientation="vertical">
        {verticalCategories.map((cat, i) => (
          <div
            key={cat.name}
            role="menuitem"
            tabIndex={0}
            className={`vcm-overlay-row ${hoveredIdx === i ? "active" : ""}`}
            onMouseEnter={() => setHoveredIdx(i)}
            onFocus={() => setHoveredIdx(i)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHoveredIdx((prev) => (prev + 1) % verticalCategories.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHoveredIdx((prev) => (prev - 1 + verticalCategories.length) % verticalCategories.length);
              } else if (e.key === "Escape" && onClose) {
                onClose();
              }
            }}
          >
            <div className="vcm-overlay-item">
              <span className="vcm-overlay-icon">{cat.icon}</span>
              <span className="vcm-overlay-name">{cat.name}</span>
              <span className="vcm-overlay-arrow">›</span>
            </div>
          </div>
        ))}
      </div>

      {/* Sub-panel — sits to the right of the list */}
      {hoveredCat && hoveredCat.subs?.length > 0 && (
        <div className="vcm-overlay-sub-panel" role="menu">
          <div className="vcm-overlay-sub-header">
            <span>{hoveredCat.icon}</span> {hoveredCat.name}
          </div>
          <div className="vcm-overlay-sub-list">
            {hoveredCat.subs.map((sub) => (
              <div
                key={sub}
                role="menuitem"
                tabIndex={0}
                className="vcm-overlay-sub-item"
              >
                {sub}
              </div>
            ))}
          </div>
          <div className="vcm-overlay-sub-footer" role="button" tabIndex={0}>
            View All in {hoveredCat.name} →
          </div>
        </div>
      )}
    </div>
  );
}
