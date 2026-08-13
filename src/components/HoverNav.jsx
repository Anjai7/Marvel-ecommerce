import { useState, useRef } from "react";
import { navCategories, megaMenuData } from "../data";
import BrowseCategoriesMenu from "./BrowseCategoriesMenu";
import { Menu, ChevronDown } from "lucide-react";

function MegaMenu({ columns }) {
  return (
    <div className="mega-menu">
      {columns.map((col) => (
        <div className="mega-menu-col" key={col.title}>
          <h4>
            <span>{col.icon}</span> {col.title}
          </h4>
          <ul>
            {col.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function HoverNav() {
  const [activeMenu, setActiveMenu] = useState(null);
  const [browseOpen, setBrowseOpen] = useState(false);

  const navTimer = useRef(null);
  const browseTimer = useRef(null);

  /* ── Regular nav hover ──
     All events handled on the outermost .hover-nav-group so the mouse
     can move freely between the trigger and the open panel without
     triggering spurious leave events. */
  const navEnter = (name) => {
    if (navTimer.current) clearTimeout(navTimer.current);
    setActiveMenu(name);
  };
  const navLeave = () => {
    // 200 ms gives the cursor enough time to travel from nav item → panel
    navTimer.current = setTimeout(() => setActiveMenu(null), 200);
  };

  /* ── Browse Categories hover ── */
  const browseEnter = () => {
    if (browseTimer.current) clearTimeout(browseTimer.current);
    setBrowseOpen(true);
  };
  const browseLeave = () => {
    browseTimer.current = setTimeout(() => setBrowseOpen(false), 200);
  };
  const browseMenuEnter = () => {
    if (browseTimer.current) clearTimeout(browseTimer.current);
  };

  return (
    <nav className="hover-nav">
      <div className="container hover-nav-inner">
        {/* ☰ Browse Categories */}
        <div
          className="browse-cat-group"
          onMouseEnter={browseEnter}
          onMouseLeave={browseLeave}
        >
          <button
            className={`browse-cat-btn ${browseOpen ? "open" : ""}`}
            id="browse-categories-btn"
            aria-expanded={browseOpen}
          >
            <Menu size={18} strokeWidth={2.5} />
            Browse Categories
          </button>

          {browseOpen && (
            <div
              className="browse-dropdown"
              onMouseEnter={browseMenuEnter}
              onMouseLeave={browseLeave}
            >
              <BrowseCategoriesMenu />
            </div>
          )}
        </div>

        <span className="hnav-sep" />

        {/* Regular category nav links */}
        {navCategories
          .filter((c) => c.name !== "All Categories")
          .map((cat) => (
            <div
              key={cat.name}
              className="hover-nav-group"
              onMouseEnter={() => cat.hasDropdown && navEnter(cat.name)}
              onMouseLeave={cat.hasDropdown ? navLeave : undefined}
            >
              <span
                className={`hover-nav-item ${activeMenu === cat.name ? "active" : ""}`}
                id={`nav-${cat.name.toLowerCase().replace(/[^a-z]/g, "-")}`}
              >
                {cat.name}
                {cat.hasDropdown && (
                  <ChevronDown
                    size={14}
                    className="nav-arrow"
                    style={{
                      transition: "transform 0.2s ease",
                      transform: activeMenu === cat.name ? "rotate(180deg)" : "none",
                    }}
                  />
                )}
              </span>

              {activeMenu === cat.name && megaMenuData[cat.name] && (
                <MegaMenu columns={megaMenuData[cat.name]} />
              )}
            </div>
          ))}
      </div>
    </nav>
  );
}
