import { useState, useEffect } from "react";
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
  Sparkles
} from "lucide-react";
import { apiFetchMenuItems } from "../../api/backendApi";

// Icon mapping helper
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
  Users
};

export default function DynamicMenu({ userRole = "user", onNavigate, activePath = "/" }) {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadMenu = async () => {
    setLoading(true);
    try {
      const items = await apiFetchMenuItems(userRole);
      setMenuItems(items);
    } catch (e) {
      console.error("Error loading dynamic menu:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMenu();

    // Listen for custom dynamic menu updates (broadcasted from Super Admin dynamic menu editor!)
    const handleMenuUpdate = () => loadMenu();
    window.addEventListener("marvel_menu_updated", handleMenuUpdate);
    return () => window.removeEventListener("marvel_menu_updated", handleMenuUpdate);
  }, [userRole]);

  return (
    <nav className="hover-nav" style={{ background: "#ffffff", borderBottom: "1px solid var(--gray-200, #e2e8f0)", boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}>
      <div className="container nav-inner" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 48 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", width: "100%" }}>
          {loading ? (
            <div style={{ fontSize: 13, color: "var(--gray-500)", padding: "8px 12px" }}>
              Loading Dynamic Menu...
            </div>
          ) : (
            menuItems.map((item) => {
              const IconComp = ICON_MAP[item.icon] || Layers;
              const isActive = activePath === item.path;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate && onNavigate(item.path, item)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "none",
                    background: isActive ? "var(--navy-light, #1e40af)" : "transparent",
                    color: isActive ? "#ffffff" : "var(--gray-700, #334155)",
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    position: "relative"
                  }}
                >
                  <IconComp size={16} color={isActive ? "#ffffff" : "var(--navy-light, #2563eb)"} />
                  <span>{item.title}</span>

                  {item.badge && (
                    <span style={{
                      fontSize: 9,
                      fontWeight: 800,
                      padding: "2px 6px",
                      borderRadius: 10,
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                      background: item.badge === "HOT" || item.badge === "PROMO"
                        ? "linear-gradient(135deg, #ef4444, #f97316)"
                        : item.badge === "ADMIN" || item.badge === "ROOT"
                        ? "linear-gradient(135deg, #8b5cf6, #ec4899)"
                        : "var(--navy-light, #2563eb)",
                      color: "#ffffff"
                    }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </nav>
  );
}
