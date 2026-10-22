import { useState, useRef, useEffect, useCallback } from "react";
import BrowseCategoriesMenu from "./BrowseCategoriesMenu";
import { LiveMegaMenu } from "./navigation/DynamicMenu";
import { useContent } from "../context/ContentContext";
import {
  Menu,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Store,
  ShieldCheck,
  Zap,
} from "lucide-react";

const byOrder = (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0);

/**
 * Normalize the menu API response to a tree. The API returns tree-shaped
 * nodes ({ children }) by default; older responses may be a legacy flat
 * list, which is rebuilt client-side via parent_id. Mirrors DynamicMenu.
 */
function normalizeToLiveTree(data) {
  const list = Array.isArray(data) ? data : Array.isArray(data?.menu) ? data.menu : [];
  if (list.length === 0) return [];
  if (list.some((item) => Array.isArray(item?.children))) {
    return [...list].sort(byOrder);
  }
  const byId = new Map();
  for (const row of list) {
    if (row && row.id != null) byId.set(row.id, { ...row, children: [] });
  }
  const roots = [];
  for (const node of byId.values()) {
    const parentId = node.parent_id ?? null;
    if (parentId == null || !byId.has(parentId) || parentId === node.id) {
      roots.push(node);
    } else {
      byId.get(parentId).children.push(node);
    }
  }
  const sortNodes = (nodes) => {
    nodes.sort(byOrder);
    nodes.forEach((n) => {
      n.children = sortNodes(Array.isArray(n.children) ? n.children : []);
    });
    return nodes;
  };
  return sortNodes(roots);
}

export default function HoverNav({ userRole = "user", onDynamicNavigate }) {
  const { menu, loading, errors } = useContent();
  const error = errors?.menu ?? null;
  const [activeMenu, setActiveMenu] = useState(null);
  const [browseOpen, setBrowseOpen] = useState(false);

  const roots = normalizeToLiveTree(menu).filter((node) => node && node.is_active !== false);

  const navTimer = useRef(null);
  const browseTimer = useRef(null);
  const browseGroupRef = useRef(null);
  const scrollRef = useRef(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeftPos = useRef(0);
  const wasDragging = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

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

    const onWheel = (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
      el.removeEventListener("wheel", onWheel);
    };
  }, [checkScroll]);

  const handleMouseDown = (e) => {
    if (e.button !== 0 || !scrollRef.current) return;
    isDown.current = true;
    startX.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeftPos.current = scrollRef.current.scrollLeft;
    wasDragging.current = false;
  };

  const handleMouseMove = (e) => {
    if (!isDown.current || !scrollRef.current) return;
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    if (Math.abs(walk) > 4) {
      wasDragging.current = true;
      if (!isDragging) setIsDragging(true);
    }
    scrollRef.current.scrollLeft = scrollLeftPos.current - walk;
  };

  const handleMouseUp = () => {
    isDown.current = false;
    setIsDragging(false);
    setTimeout(() => {
      wasDragging.current = false;
    }, 60);
  };

  const handleMouseLeave = () => {
    isDown.current = false;
    setIsDragging(false);
    setTimeout(() => {
      wasDragging.current = false;
    }, 60);
  };

  const handleScroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -280 : 280, behavior: "smooth" });
  };

  const navEnter = (name) => {
    if (isDragging || isDown.current) return;
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

  const handleLiveNavigate = (path) => {
    if (wasDragging.current) return;
    if (onDynamicNavigate) onDynamicNavigate(path);
  };

  const notice = loading
    ? "Loading navigation…"
    : error
      ? "Navigation is temporarily unavailable."
      : roots.length === 0
        ? "No navigation items configured yet."
        : null;

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
            <div className="browse-dropdown" onMouseEnter={browseEnter} onMouseLeave={browseLeave}>
              <BrowseCategoriesMenu onClose={() => setBrowseOpen(false)} />
            </div>
          )}
        </div>

        <span className="hnav-sep" />

        {/* Category Navigation Slider Container */}
        <div
          className={`hover-nav-slider-wrapper ${canScrollLeft ? "can-scroll-left" : ""} ${
            canScrollRight ? "can-scroll-right" : ""
          }`}
        >
          {/* Scroll Left Button */}
          {canScrollLeft && (
            <button
              type="button"
              className="hover-nav-scroll-btn left"
              onClick={() => handleScroll("left")}
              aria-label="Scroll navigation left"
            >
              <ChevronLeft size={16} />
            </button>
          )}

          {/* Scrollable Track for Nav Categories & Role Portals */}
          <div
            className={`hover-nav-scroll-track ${isDragging ? "is-dragging" : ""}`}
            ref={scrollRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          >
            {notice && (
              <span style={{ fontSize: 13, color: "var(--gray-500)", padding: "8px 12px" }}>
                {notice}
              </span>
            )}

            {roots.map((root, idx) => {
              const alignRight = idx >= Math.floor(roots.length / 2);
              const liveChildren = (Array.isArray(root.children) ? root.children : []).filter(
                (c) => c && c.is_active !== false
              );
              const hasLiveDropdown = liveChildren.length > 0;

              return (
                <div
                  key={root.id}
                  className={`hover-nav-group ${alignRight ? "nav-group-right" : "nav-group-left"}`}
                  onMouseEnter={() => hasLiveDropdown && navEnter(root.title)}
                  onMouseLeave={hasLiveDropdown ? navLeave : undefined}
                  onFocus={() => hasLiveDropdown && navEnter(root.title)}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) {
                      navLeave();
                    }
                  }}
                >
                  <span
                    tabIndex={hasLiveDropdown ? 0 : undefined}
                    className={`hover-nav-item ${activeMenu === root.title ? "active" : ""}`}
                    id={`nav-${root.title.toLowerCase().replace(/[^a-z]/g, "-")}`}
                    onClick={() => {
                      if (wasDragging.current) return;
                      if (hasLiveDropdown) {
                        setActiveMenu((prev) => (prev === root.title ? null : root.title));
                      } else {
                        handleLiveNavigate(root.path || "/");
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (hasLiveDropdown) {
                          setActiveMenu((prev) => (prev === root.title ? null : root.title));
                        } else {
                          handleLiveNavigate(root.path || "/");
                        }
                      }
                      if (e.key === "Escape") setActiveMenu(null);
                    }}
                  >
                    {root.title}
                    {hasLiveDropdown && (
                      <ChevronDown
                        size={14}
                        className="nav-arrow"
                        style={{
                          transition: "transform 0.2s ease",
                          transform: activeMenu === root.title ? "rotate(180deg)" : "none",
                        }}
                      />
                    )}
                  </span>

                  {activeMenu === root.title && hasLiveDropdown && (
                    <LiveMegaMenu
                      root={root}
                      alignRight={alignRight}
                      onNavigate={handleLiveNavigate}
                    />
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
                  whiteSpace: "nowrap",
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
                  whiteSpace: "nowrap",
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
                  whiteSpace: "nowrap",
                }}
              >
                <Zap size={14} /> Super Admin
              </button>
            )}
          </div>

          {/* Scroll Right Button */}
          {canScrollRight && (
            <button
              type="button"
              className="hover-nav-scroll-btn right"
              onClick={() => handleScroll("right")}
              aria-label="Scroll navigation right"
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
