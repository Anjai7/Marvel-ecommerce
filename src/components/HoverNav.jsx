import { useState, useRef, useEffect } from "react";
import { navCategories, megaMenuData } from "../data";
import BrowseCategoriesMenu from "./BrowseCategoriesMenu";
import { Menu, ChevronDown } from "lucide-react";

function MegaMenu({ columns, alignRight }) {
  return (
    <div
      className={`mega-menu ${alignRight ? "align-right" : "align-left"}`}
      style={{
        "--cols": Math.min(columns.length, 6),
      }}
    >
      {columns.map((col) => (
        <div className="mega-menu-col" key={col.title}>
          <h4>
            <span>{col.icon}</span> {col.title}
          </h4>
          <ul>
            {col.items.map((item) => (
              <li key={item} tabIndex={0}>{item}</li>
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
  const browseGroupRef = useRef(null);

  /* ── Regular nav hover ── */
  const navEnter = (name) => {
    if (navTimer.current) clearTimeout(navTimer.current);
    setActiveMenu(name);
  };
  const navLeave = () => {
    navTimer.current = setTimeout(() => setActiveMenu(null), 220);
  };

  /* ── Browse Categories hover & click ── */
  const browseEnter = () => {
    if (browseTimer.current) clearTimeout(browseTimer.current);
    setBrowseOpen(true);
  };
  const browseLeave = () => {
    browseTimer.current = setTimeout(() => setBrowseOpen(false), 260);
  };
  const toggleBrowse = () => {
    if (browseTimer.current) clearTimeout(browseTimer.current);
    setBrowseOpen((prev) => !prev);
  };

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (browseGroupRef.current && !browseGroupRef.current.contains(e.target)) {
        setBrowseOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      if (navTimer.current) clearTimeout(navTimer.current);
      if (browseTimer.current) clearTimeout(browseTimer.current);
    };
  }, []);

  const filteredNavCategories = navCategories.filter((c) => c.name !== "All Categories");

  return (
    <nav className="hover-nav">
      <div className="container hover-nav-inner">
        {/* ☰ Browse Categories */}
        <div
          ref={browseGroupRef}
          className={`browse-cat-group ${browseOpen ? "active" : ""}`}
          onMouseEnter={browseEnter}
          onMouseLeave={browseLeave}
        >
          <button
            className={`browse-cat-btn ${browseOpen ? "open" : ""}`}
            id="browse-categories-btn"
            aria-expanded={browseOpen}
            aria-haspopup="true"
            onClick={toggleBrowse}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleBrowse();
              }
              if (e.key === "Escape") setBrowseOpen(false);
            }}
          >
            <Menu size={18} strokeWidth={2.5} />
            Browse Categories
          </button>

          {browseOpen && (
            <div
              className="browse-dropdown"
              onMouseEnter={browseEnter}
              onMouseLeave={browseLeave}
            >
              <BrowseCategoriesMenu onClose={() => setBrowseOpen(false)} />
            </div>
          )}
        </div>

        <span className="hnav-sep" />

        {/* Regular category nav links */}
        {filteredNavCategories.map((cat, idx) => {
          // Items in the second half of the navigation bar align their dropdowns to the right
          const alignRight = idx >= Math.floor(filteredNavCategories.length / 2);

          return (
            <div
              key={cat.name}
              className={`hover-nav-group ${alignRight ? "nav-group-right" : "nav-group-left"}`}
              onMouseEnter={() => cat.hasDropdown && navEnter(cat.name)}
              onMouseLeave={cat.hasDropdown ? navLeave : undefined}
              onFocus={() => cat.hasDropdown && navEnter(cat.name)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  navLeave();
                }
              }}
            >
              <span
                tabIndex={cat.hasDropdown ? 0 : undefined}
                className={`hover-nav-item ${activeMenu === cat.name ? "active" : ""}`}
                id={`nav-${cat.name.toLowerCase().replace(/[^a-z]/g, "-")}`}
                onKeyDown={(e) => {
                  if (cat.hasDropdown && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    setActiveMenu((prev) => (prev === cat.name ? null : cat.name));
                  }
                  if (e.key === "Escape") setActiveMenu(null);
                }}
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
                <MegaMenu columns={megaMenuData[cat.name]} alignRight={alignRight} />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
