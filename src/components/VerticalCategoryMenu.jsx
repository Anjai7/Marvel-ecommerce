import { useState } from "react";
import { verticalCategories } from "../data";

export default function VerticalCategoryMenu() {
  const [hovered, setHovered] = useState(null);

  return (
    <div className="vcm">
      {verticalCategories.map((cat, i) => (
        <div
          key={cat.name}
          className="vcm-item-wrap"
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
        >
          <div className={`vcm-item ${hovered === i ? "active" : ""}`} id={`vcm-${i}`}>
            <div className="vcm-item-left">
              <span className="vcm-icon">{cat.icon}</span>
              <span className="vcm-name">{cat.name}</span>
            </div>
            <span className="vcm-arrow">›</span>
          </div>

          {hovered === i && (
            <div className="vcm-submenu">
              <div className="vcm-sub-header">{cat.name}</div>
              {cat.subs.map((sub) => (
                <div key={sub} className="vcm-sub-item">{sub}</div>
              ))}
              <div className="vcm-view-all">View All ›</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
