import { useState, useEffect, useRef } from "react";
import {
  Home,
  ShoppingBag,
  Grid,
  Tag,
  Store,
  ShieldCheck,
  Zap,
  Cpu,
  Shirt,
  Layers,
  Settings,
  Package,
  Users,
  ChevronDown,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useContent } from "../../context/ContentContext";
import { Badge, Button, Card, CardContent } from "../ui";

// Icon mapping helper — unknown icon names fall back to Layers.
const ICON_MAP = {
  Home,
  ShoppingBag,
  Grid,
  Tag,
  Store,
  ShieldCheck,
  Zap,
  Cpu,
  Shirt,
  Layers,
  Settings,
  Package,
  Users,
};

const byOrder = (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0);
const isVisible = (node) => node && node.is_active !== false;

/**
 * Normalize the menu API response to a tree. The API returns tree-shaped
 * nodes ({ children }) by default; older responses may be a legacy flat
 * list, which is rebuilt client-side via parent_id.
 */
function normalizeToTree(data) {
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

/** Group level-2 nodes by `section`, preserving first-seen order. */
function groupBySection(level2) {
  const groups = new Map();
  for (const node of level2) {
    const key = (node.section || "").trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(node);
  }
  return [...groups.values()].flat();
}

/**
 * Resolve an L2 `section_icon`: a matching ICON_MAP key renders the Lucide
 * component, anything else (seeds store emoji like 📱) renders as-is.
 */
function SectionIcon({ value }) {
  if (!value) return null;
  const Comp = ICON_MAP[value];
  if (Comp) {
    return (
      <span className="mega-menu-section-icon">
        <Comp size={16} />
      </span>
    );
  }
  return <span className="mega-menu-section-icon">{value}</span>;
}

/** Promo card for a menu root's `promo_*` columns. */
function MegaMenuFeaturedCard({
  title,
  subtitle,
  badge = "Featured",
  image,
  cta = "Shop Now",
  onSelect,
}) {
  return (
    <Card className="mega-menu-featured-card">
      {image && (
        <div className="mega-menu-featured-image-wrapper">
          <img src={image} alt={title} className="mega-menu-featured-image" />
          {badge && (
            <Badge
              variant="accent"
              size="sm"
              className="mega-menu-featured-badge"
              icon={<Sparkles size={11} />}
            >
              {badge}
            </Badge>
          )}
        </div>
      )}
      <CardContent className="mega-menu-featured-content">
        {title && <h5 className="mega-menu-featured-title">{title}</h5>}
        {subtitle && <p className="mega-menu-featured-subtitle">{subtitle}</p>}
        {cta && (
          <Button
            variant="outline"
            size="sm"
            className="mega-menu-featured-btn"
            rightIcon={<ArrowRight size={14} />}
            onClick={onSelect}
          >
            {cta}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Live mega-menu for one level-1 tree node: level-2 nodes become column
 * headers (ordered/grouped by `section`), level-3 nodes become links,
 * and a promo card renders when `promo_title` is set.
 */
export function LiveMegaMenu({ root, alignRight, onNavigate }) {
  const level2 = groupBySection((root.children || []).filter(isVisible).sort(byOrder));
  const featured = root.promo_title
    ? {
        title: root.promo_title,
        subtitle: root.promo_subtitle || "",
        image: root.promo_image_url || "",
        cta: root.promo_cta_text || "Shop Now",
      }
    : null;

  return (
    <div
      className={`mega-menu ${alignRight ? "align-right" : "align-left"}`}
      role="region"
      aria-label={`${root.title} submenu`}
    >
      <div className="mega-menu-grid">
        {level2.map((l2) => {
          const l3 = (l2.children || []).filter(isVisible).sort(byOrder);
          const items =
            l3.length > 0
              ? l3.map((leaf) => ({
                  key: leaf.id,
                  label: leaf.title,
                  path: leaf.path || "/",
                  badge: leaf.badge || null,
                  badgeVariant: leaf.badge_variant || "accent",
                }))
              : [
                  {
                    key: `${l2.id}-all`,
                    label: `All ${l2.title}`,
                    path: l2.path || "/",
                    badge: null,
                    badgeVariant: "accent",
                  },
                ];
          return (
            <div key={l2.id} className="mega-menu-col">
              <h4 className="mega-menu-section-header">
                <SectionIcon value={l2.section_icon} />
                <span className="mega-menu-section-title">{l2.title}</span>
              </h4>
              <ul className="mega-menu-item-list" role="menu">
                {items.map((item) => (
                  <li key={item.key} className="mega-menu-item-wrapper" role="none">
                    <button
                      type="button"
                      className="mega-menu-item-link dynamic-menu-leaf"
                      role="menuitem"
                      onClick={() => onNavigate && onNavigate(item.path, item)}
                    >
                      <span className="mega-menu-item-text-group">
                        <span className="mega-menu-item-label">{item.label}</span>
                      </span>
                      {item.badge && (
                        <Badge
                          variant={item.badgeVariant}
                          size="sm"
                          className="mega-menu-item-badge"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {featured && (
        <div className="mega-menu-featured-column">
          <MegaMenuFeaturedCard
            {...featured}
            onSelect={() => onNavigate && onNavigate(root.promo_cta_path || root.path || "/", root)}
          />
        </div>
      )}
    </div>
  );
}

export default function DynamicMenu({ onNavigate, activePath = "/" }) {
  const { menu, loading, errors } = useContent();
  const error = errors?.menu ?? null;
  const [activeMenu, setActiveMenu] = useState(null);
  const navTimer = useRef(null);

  useEffect(
    () => () => {
      if (navTimer.current) clearTimeout(navTimer.current);
    },
    []
  );

  const openMenu = (name) => {
    if (navTimer.current) clearTimeout(navTimer.current);
    setActiveMenu(name);
  };
  const scheduleClose = () => {
    navTimer.current = setTimeout(() => setActiveMenu(null), 220);
  };

  const handleLevelKeyDown = (e, name, targetPath, hasDropdown) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (hasDropdown) {
        setActiveMenu((prev) => (prev === name ? null : name));
      } else if (onNavigate) {
        onNavigate(targetPath, { title: name, path: targetPath });
      }
    }
    if (e.key === "Escape") setActiveMenu(null);
  };

  const renderLevelItem = (name, { hasDropdown, icon: IconComp, isActive, targetPath }) => (
    <span
      tabIndex={0}
      className={`hover-nav-item ${activeMenu === name || isActive ? "active" : ""}`}
      id={`dynamic-nav-${name.toLowerCase().replace(/[^a-z]/g, "-")}`}
      onClick={() => {
        if (hasDropdown) {
          setActiveMenu((prev) => (prev === name ? null : name));
        } else if (onNavigate) {
          onNavigate(targetPath, { title: name, path: targetPath });
        }
      }}
      onKeyDown={(e) => handleLevelKeyDown(e, name, targetPath, hasDropdown)}
    >
      {IconComp && <IconComp size={15} />}
      {name}
      {hasDropdown && (
        <ChevronDown
          size={14}
          className="nav-arrow"
          style={{
            transition: "transform 0.2s ease",
            transform: activeMenu === name ? "rotate(180deg)" : "none",
          }}
        />
      )}
    </span>
  );

  const menuItems = normalizeToTree(menu);
  const barItems = menuItems;
  const half = Math.floor(barItems.length / 2);
  const notice = loading
    ? "Loading Dynamic Menu..."
    : error
      ? "Navigation is temporarily unavailable."
      : barItems.length === 0
        ? "No navigation items configured yet."
        : null;

  return (
    <nav
      className="hover-nav dynamic-menu"
      style={{
        background: "#ffffff",
        borderBottom: "1px solid var(--gray-200, #e2e8f0)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
      }}
    >
      <div className="container hover-nav-inner">
        <div className="hover-nav-scroll-track">
          {notice ? (
            <div style={{ fontSize: 13, color: "var(--gray-500)", padding: "8px 12px" }}>
              {notice}
            </div>
          ) : (
            barItems.map((root, idx) => {
              const alignRight = idx >= half;
              const IconComp = ICON_MAP[root.icon] || Layers;
              const children = (root.children || []).filter(isVisible);
              const hasDropdown = children.length > 0;
              const isActive = activePath === root.path;
              return (
                <div
                  key={root.id}
                  className={`hover-nav-group ${alignRight ? "nav-group-right" : "nav-group-left"}`}
                  onMouseEnter={() => hasDropdown && openMenu(root.title)}
                  onMouseLeave={hasDropdown ? scheduleClose : undefined}
                  onFocus={() => hasDropdown && openMenu(root.title)}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) scheduleClose();
                  }}
                >
                  {renderLevelItem(root.title, {
                    hasDropdown,
                    icon: IconComp,
                    isActive,
                    targetPath: root.path || "/",
                  })}
                  {hasDropdown && activeMenu === root.title && (
                    <LiveMegaMenu root={root} alignRight={alignRight} onNavigate={onNavigate} />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </nav>
  );
}
