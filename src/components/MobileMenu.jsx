import { useState } from "react";
import { verticalCategories } from "../data";
import { Button } from "./ui";
import { X, User, Package, ShoppingCart, Heart, MapPin, ChevronRight, ChevronDown } from "lucide-react";

export default function MobileMenu({ isOpen, onClose, isLoggedIn, onLogin }) {
  const [expanded, setExpanded] = useState(null);

  if (!isOpen) return null;

  const toggle = (name) => setExpanded(expanded === name ? null : name);

  return (
    <>
      <div className="mobile-overlay" onClick={onClose} />
      <div className="mobile-drawer" id="mobile-drawer">
        {/* Header */}
        <div className="mobile-drawer-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/logo.png" alt="Logo" className="logo-img" style={{ height: "32px", objectFit: "contain" }} />
          </div>
          <button
            className="mobile-close"
            onClick={onClose}
            id="mobile-close-btn"
            aria-label="Close menu"
            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <X size={20} color="#fff" />
          </button>
        </div>

        {/* Auth */}
        <div className="mobile-auth">
          {isLoggedIn ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "var(--navy-bg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--navy)",
                }}
              >
                <User size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Hello, User</div>
                <div style={{ fontSize: 12, color: "var(--gray-500)" }}>Manage Account</div>
              </div>
            </div>
          ) : (
            <Button
              variant="accent"
              size="lg"
              style={{ width: "100%" }}
              id="mobile-signin-btn"
              rightIcon={<ChevronRight size={18} />}
              onClick={() => {
                onLogin();
                onClose();
              }}
            >
              Sign In to Your Account
            </Button>
          )}
        </div>

        {/* Quick Links */}
        <div className="mobile-quick-links">
          {[
            { icon: <Package size={18} />, label: "My Orders" },
            { icon: <ShoppingCart size={18} />, label: "My Cart" },
            { icon: <Heart size={18} />, label: "Wishlist" },
            { icon: <MapPin size={18} />, label: "Track Order" },
          ].map((l) => (
            <div
              key={l.label}
              className="mobile-quick-link"
              id={`mobile-${l.label.toLowerCase().replace(/\s/g, "-")}`}
            >
              <span style={{ color: "var(--navy)", display: "flex", alignItems: "center" }}>
                {l.icon}
              </span>
              <span>{l.label}</span>
            </div>
          ))}
        </div>

        {/* Categories */}
        <div style={{ padding: "8px 0 16px" }}>
          <div
            style={{
              padding: "8px 20px 6px",
              fontSize: 11,
              fontWeight: 700,
              color: "var(--gray-400)",
              textTransform: "uppercase",
              letterSpacing: "0.7px",
            }}
          >
            Shop by Category
          </div>
          {verticalCategories.map((cat) => (
            <div key={cat.name}>
              <div
                className="mobile-nav-link"
                id={`mobile-cat-${cat.name.toLowerCase().replace(/[^a-z]/g, "-")}`}
                onClick={() => toggle(cat.name)}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{cat.icon}</span>
                  <span>{cat.name}</span>
                </span>
                <span className="arrow" style={{ display: "flex", alignItems: "center" }}>
                  {expanded === cat.name ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
              </div>
              {expanded === cat.name && (
                <div className="mobile-subitems">
                  {cat.subs.map((sub) => (
                    <div key={sub} className="mobile-subitem">
                      {sub}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
