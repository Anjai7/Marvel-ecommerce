import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Badge,
  Rating,
  ProductPrice,
  useToast,
} from "../ui";
import { ShoppingCart, Check, Heart, ShieldCheck, Truck, RefreshCw } from "lucide-react";
import { useCart } from "../../context/CartContext";
import { useSettings } from "../../context/SettingsContext";
import { deliverySummary } from "./dynamicProductBuilder";

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function textOrNull(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * The promises shown under the price.
 *
 * The platform-wide promises live in `settings.trust.promises`. When the
 * settings have none (or have not loaded) each promise comes from the product
 * row itself — `warranty` and `delivery_info`. A promise neither source makes
 * is not shown.
 */
function productPromises(product) {
  const promises = [];
  const warranty = textOrNull(product?.warranty);
  if (warranty) {
    promises.push({ key: "warranty", icon: ShieldCheck, color: "var(--navy)", label: warranty });
  }

  for (const line of deliverySummary(product?.delivery_info).lines) {
    const isShipping = /ship|delivery/i.test(line);
    promises.push({
      key: `delivery-${promises.length}`,
      icon: isShipping ? Truck : RefreshCw,
      color: isShipping ? "var(--orange)" : "var(--green)",
      label: line,
    });
  }

  return promises;
}

function iconForTitle(title) {
  if (/ship|deliver/i.test(title)) return { icon: Truck, color: "var(--orange)" };
  if (/return|refund/i.test(title)) return { icon: RefreshCw, color: "var(--green)" };
  return { icon: ShieldCheck, color: "var(--navy)" };
}

function trustPromises(product, settings) {
  const configured = settings?.trust?.promises;
  if (Array.isArray(configured)) {
    const rows = configured
      .map((promise, index) => {
        const title = textOrNull(promise?.title);
        const subtitle = textOrNull(promise?.subtitle);
        if (!title && !subtitle) return null;
        const { icon, color } = iconForTitle(title ?? "");
        return { key: `trust-${index}`, icon, color, label: title ?? subtitle, subtitle };
      })
      .filter(Boolean);
    if (rows.length > 0) return rows;
  }
  return productPromises(product);
}

export function QuickViewDialog({ product, isOpen, onClose, onViewFull }) {
  const [cartState, setCartState] = useState("idle");
  const [wishlisted, setWishlisted] = useState(false);
  const { addToast } = useToast();
  const { addItem } = useCart();
  const { settings } = useSettings();

  if (!product) return null;

  const title = textOrNull(product.title) || textOrNull(product.name) || "Product";
  const image = textOrNull(product.image_url) || textOrNull(product.image);
  const rating = numberOrNull(product.rating);
  const reviews = numberOrNull(product.reviews_count ?? product.reviews);
  const price = numberOrNull(product.price);
  const originalPrice = numberOrNull(product.original_price ?? product.originalPrice);
  const desc = textOrNull(product.description) || textOrNull(product.desc);
  const stock = numberOrNull(product.stock);
  const offerText = textOrNull(product.offer_text);
  const promises = trustPromises(product, settings);

  const handleCart = () => {
    if (cartState === "added") return;
    setCartState("added");
    addItem(product, 1);
    addToast({
      title: "Added to Cart",
      message: `${title} has been added to your shopping cart.`,
      type: "success",
    });
    setTimeout(() => setCartState("idle"), 2000);
  };

  const handleWishlist = () => {
    const next = !wishlisted;
    setWishlisted(next);
    addToast({
      title: next ? "Saved to Wishlist" : "Removed from Wishlist",
      message: `${title} ${next ? "added to" : "removed from"} your favorites.`,
      type: next ? "success" : "info",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="quickview-dialog-content">
        <div className="quickview-grid">
          {/* Left: Product Image */}
          <div className="quickview-image-wrap">
            {image ? (
              <img src={image} alt={title} className="quickview-image" />
            ) : (
              <div
                className="quickview-image"
                style={{ background: "#f1f5f9", minHeight: 220 }}
                aria-hidden="true"
              />
            )}
            {offerText && (
              <Badge variant="accent" className="quickview-badge">
                {offerText}
              </Badge>
            )}
          </div>

          {/* Right: Details */}
          <div className="quickview-details">
            <DialogHeader style={{ marginBottom: 8 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                {stock !== null && (
                  <Badge variant={stock > 0 ? "success" : "danger"} size="sm">
                    {stock > 0 ? "In Stock" : "Out of Stock"}
                  </Badge>
                )}
              </div>
              <DialogTitle style={{ fontSize: 20, marginTop: 8 }}>{title}</DialogTitle>
            </DialogHeader>

            {desc && (
              <p
                style={{
                  fontSize: 13,
                  color: "var(--gray-600)",
                  lineHeight: 1.5,
                  marginBottom: 12,
                }}
              >
                {desc}
              </p>
            )}

            {rating !== null && (
              <div style={{ marginBottom: 14 }}>
                <Rating rating={rating} count={reviews !== null ? reviews : undefined} size={16} />
              </div>
            )}

            {price !== null && (
              <div style={{ marginBottom: 16 }}>
                <ProductPrice price={price} originalPrice={originalPrice} size="lg" />
              </div>
            )}

            {/* Promises the product row actually makes */}
            {promises.length > 0 && (
              <div className="quickview-features">
                {promises.map(({ key, icon: Icon, color, label, subtitle }) => (
                  <div className="qv-feature" key={key}>
                    <Icon size={16} color={color} />
                    <span>
                      {label}
                      {subtitle && (
                        <span style={{ display: "block", fontSize: 12, color: "var(--gray-500)" }}>
                          {subtitle}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <Button
                variant={cartState === "added" ? "secondary" : "accent"}
                size="lg"
                style={{ flex: 1 }}
                onClick={handleCart}
                leftIcon={cartState === "added" ? <Check size={18} /> : <ShoppingCart size={18} />}
              >
                {cartState === "added" ? "Added to Cart!" : "Add to Cart"}
              </Button>

              <Button variant="outline" size="lg" onClick={handleWishlist} aria-label="Wishlist">
                <Heart
                  size={18}
                  fill={wishlisted ? "#ef4444" : "none"}
                  color={wishlisted ? "#ef4444" : "var(--gray-500)"}
                />
              </Button>
            </div>

            <div style={{ textAlign: "center", marginTop: 14 }}>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "var(--navy-light)",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
                onClick={() => {
                  onClose();
                  if (onViewFull) onViewFull();
                }}
              >
                View Full Product Details →
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
