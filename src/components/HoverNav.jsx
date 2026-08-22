import { useState, useRef, useEffect, useCallback } from "react";
import { navCategories, megaMenuData } from "../data";
import BrowseCategoriesMenu from "./BrowseCategoriesMenu";
import { MegaMenu } from "./ui";
import { Menu, ChevronDown, ChevronLeft, ChevronRight, Store, ShieldCheck, Zap } from "lucide-react";

export default function HoverNav({ userRole = "user", onDynamicNavigate }) {
  const [activeMenu, setActiveMenu] = useState(null);
  const [browseOpen, setBrowseOpen] = useState(false);

  const navTimer = useRef(null);
  const browseTimer = useRef(null);
  const browseGroupRef = useRef(null);
  const scrollRef = useRef(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 6);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 6);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll]);

  const handleScroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -220 : 220, behavior: "smooth" });
  };

  const navEnter = (name) => {
    if (navTimer.current) clearTimeout(navTimer.current);
    setActiveMenu(name);
  };
  const navLeave = () => {
    navTimer.current = setTimeout(() => setActiveMenu(null), 220);
  };

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

        {/* Scroll Left Button */}
        {canScrollLeft && (
          <button
            className="hover-nav-scroll-btn left"
            onClick={() => handleScroll("left")}
            aria-label="Scroll navigation left"
          >
            <ChevronLeft size={16} />
          </button>
        )}

        {/* Scrollable Track for Nav Categories & Role Portals */}
        <div className="hover-nav-scroll-track" ref={scrollRef}>
          {filteredNavCategories.map((cat, idx) => {
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
                  <MegaMenu data={megaMenuData[cat.name]} alignRight={alignRight} />
                )}
              </div>
            );
          })}

          {/* Dynamic Role Navigation Portals */}
          {(userRole === "vendor" || userRole === "admin" || userRole === "super_admin") && (
            <button
              onClick={() => onDynamicNavigate && onDynamicNavigate("/vendor-dashboard")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: 6,
                border: "none",
                background: "rgba(124, 58, 237, 0.1)",
                color: "#7c3aed",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap"
              }}
            >
              <Store size={14} /> Vendor Store
            </button>
          )}

          {(userRole === "admin" || userRole === "super_admin") && (
            <button
              onClick={() => onDynamicNavigate && onDynamicNavigate("/admin-dashboard")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: 6,
                border: "none",
                background: "rgba(37, 99, 235, 0.1)",
                color: "#2563eb",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap"
              }}
            >
              <ShieldCheck size={14} /> Admin Console
            </button>
          )}

          {userRole === "super_admin" && (
            <button
              onClick={() => onDynamicNavigate && onDynamicNavigate("/superadmin-dashboard")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: 6,
                border: "none",
                background: "rgba(217, 119, 6, 0.1)",
                color: "#d97706",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                whiteSpace: "nowrap"
              }}
            >
              <Zap size={14} /> Super Admin
            </button>
          )}
        </div>

        {/* Scroll Right Button */}
        {canScrollRight && (
          <button
            className="hover-nav-scroll-btn right"
            onClick={() => handleScroll("right")}
            aria-label="Scroll navigation right"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </nav>
  );
}
