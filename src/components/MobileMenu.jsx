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
import "./mobile-menu.css";

export default function MobileMenu({ isOpen, onClose, isLoggedIn, onLogin }) {
  const { categoryTree, loading, errors } = useContent();
  const error = errors?.categoryTree ?? null;

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
          <div className="mobile-menu-brand">
            <img src="/header.png" alt="Marvel Logo" className="mobile-menu-logo" />
          </div>
          <button
            className="mobile-close"
            onClick={onClose}
            id="mobile-close-btn"
            aria-label="Close menu"
          >
            <X size={20} color="#fff" />
          </button>
        </div>

        {/* Auth */}
        <div className="mobile-auth">
          {isLoggedIn ? (
            <div className="mobile-menu-user">
              <Avatar size="lg">
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
              <div>
                <div>
                  <div className="mobile-menu-user-name">Hello, User</div>
                  <div className="mobile-menu-user-sub">Manage Account</div>
                </div>
              </div>
            </div>
          ) : (
            <Button
              variant="accent"
              size="lg"
              className="mobile-menu-signin"
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
              <span className="mobile-menu-quick-icon">{l.icon}</span>
              <span>{l.label}</span>
            </div>
          ))}
        </div>

        {/* Categories */}
        <div className="mobile-menu-categories">
          <div className="mobile-menu-heading">Shop by Category</div>
          <Accordion type="single" collapsible className="mobile-menu-accordion">
            {notice ? (
              <p className="mobile-menu-notice">{notice}</p>
            ) : (
              roots.map((cat) => (
                <AccordionItem key={cat.id ?? cat.name} value={cat.name}>
                  <AccordionTrigger className="mobile-menu-trigger">
                    <span className="mobile-menu-trigger-row">
                      <span className="mobile-menu-trigger-icon">{cat.icon || "•"}</span>
                      <span>{cat.name}</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="mobile-subitems">
                      {(cat.children || []).map((sub) => (
                        <div key={sub.id ?? sub.name} className="mobile-menu-subitem">
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
