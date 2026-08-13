import { useState } from "react";
import { verticalCategories } from "../data";

export default function BrowseCategoriesMenu() {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const hoveredCat = hoveredIdx !== null ? verticalCategories[hoveredIdx] : null;

  return (
    <div
      className="vcm-overlay"
      onMouseLeave={() => setHoveredIdx(null)}
    >
      {/* Main list */}
      <div className="vcm-overlay-list">
        {verticalCategories.map((cat, i) => (
          <div
            key={cat.name}
            className={`vcm-overlay-row ${hoveredIdx === i ? "active" : ""}`}
            onMouseEnter={() => setHoveredIdx(i)}
          >
            <div className="vcm-overlay-item">
              <span className="vcm-overlay-icon">{cat.icon}</span>
              <span className="vcm-overlay-name">{cat.name}</span>
              <span className="vcm-overlay-arrow">›</span>
            </div>
          </div>
        ))}
      </div>

      {/* Sub-panel — rendered once, positioned to the right of the list */}
      {hoveredCat && hoveredCat.subs?.length > 0 && (
        <div className="vcm-overlay-sub-panel">
          <div className="vcm-overlay-sub-header">{hoveredCat.name}</div>
          {hoveredCat.subs.map((sub) => (
            <div key={sub} className="vcm-overlay-sub-item">{sub}</div>
          ))}
          <div className="vcm-overlay-sub-footer">View All in {hoveredCat.name} ›</div>
        </div>
      )}
    </div>
  );
}

