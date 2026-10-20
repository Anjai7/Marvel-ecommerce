import { useContent } from "../context/ContentContext";
import {
  Button,
  Avatar,
  AvatarFallback,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "./ui";
import { X, Package, ShoppingCart, Heart, MapPin, ChevronRight } from "lucide-react";

export default function MobileMenu({ isOpen, onClose, isLoggedIn, onLogin }) {
  const { categoryTree, loading, error } = useContent();

  if (!isOpen) return null;

  const roots = Array.isArray(categoryTree) ? categoryTree : [];
  const notice = loading
    ? "Loading categories…"
    : error
      ? "Categories are temporarily unavailable."
      : roots.length === 0
        ? "No categories to show yet."
        : null;

  return (
    <>
      <div className="mobile-overlay" onClick={onClose} />
      <div className="mobile-drawer" id="mobile-drawer">
        {/* Header */}
        <div className="mobile-drawer-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src="/header.png"
              alt="Marvel Logo"
              className="logo-img"
              style={{ height: "44px", objectFit: "contain" }}
            />
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
              <Avatar size="lg">
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
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
          <Accordion type="single" collapsible style={{ padding: "0 12px" }}>
            {notice ? (
              <p style={{ padding: "8px", fontSize: 13, color: "var(--gray-500)" }}>{notice}</p>
            ) : (
              roots.map((cat) => (
                <AccordionItem key={cat.id ?? cat.name} value={cat.name}>
                  <AccordionTrigger style={{ padding: "12px 8px", fontSize: 13.5 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 16 }}>{cat.icon || "•"}</span>
                      <span>{cat.name}</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="mobile-subitems">
                      {(cat.children || []).map((sub) => (
                        <div
                          key={sub.id ?? sub.name}
                          className="mobile-subitem"
                          style={{ padding: "6px 12px", fontSize: 13, color: "var(--gray-600)" }}
                        >
                          {sub.name}
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))
            )}
          </Accordion>
        </div>
      </div>
    </>
  );
}
