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

export function QuickViewDialog({ product, isOpen, onClose, onViewFull }) {
  const [cartState, setCartState] = useState("idle");
  const [wishlisted, setWishlisted] = useState(false);
  const { addToast } = useToast();

  if (!product) return null;

  const handleCart = () => {
    if (cartState === "added") return;
    setCartState("added");
    addToast({
      title: "Added to Cart",
      message: `${product.name} has been added to your shopping cart.`,
      type: "success",
    });
    setTimeout(() => setCartState("idle"), 2000);
  };

  const handleWishlist = () => {
    const next = !wishlisted;
    setWishlisted(next);
    addToast({
      title: next ? "Saved to Wishlist" : "Removed from Wishlist",
      message: `${product.name} ${next ? "added to" : "removed from"} your favorites.`,
      type: next ? "success" : "info",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="quickview-dialog-content">
        <div className="quickview-grid">
          {/* Left: Product Image */}
          <div className="quickview-image-wrap">
            <img src={product.image} alt={product.name} className="quickview-image" />
            {product.badge && (
              <Badge variant="accent" className="quickview-badge">
                {product.badge}
              </Badge>
            )}
          </div>

          {/* Right: Details */}
          <div className="quickview-details">
            <DialogHeader style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <Badge variant="success" size="sm">
                  In Stock - Ships Tomorrow
                </Badge>
              </div>
              <DialogTitle style={{ fontSize: 20, marginTop: 8 }}>{product.name}</DialogTitle>
            </DialogHeader>

            {product.desc && (
              <p style={{ fontSize: 13, color: "var(--gray-600)", lineHeight: 1.5, marginBottom: 12 }}>
                {product.desc}
              </p>
            )}

            <div style={{ marginBottom: 14 }}>
              <Rating rating={product.rating} count={product.reviews} size={16} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <ProductPrice price={product.price} originalPrice={product.originalPrice} discount={product.discount} size="lg" />
            </div>

            {/* Key Features / Badges */}
            <div className="quickview-features">
              <div className="qv-feature">
                <Truck size={16} color="var(--orange)" />
                <span>Free Express Shipping</span>
              </div>
              <div className="qv-feature">
                <ShieldCheck size={16} color="var(--navy)" />
                <span>1 Year Brand Warranty</span>
              </div>
              <div className="qv-feature">
                <RefreshCw size={16} color="var(--green)" />
                <span>7 Days Easy Return</span>
              </div>
            </div>

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

              <Button
                variant="outline"
                size="lg"
                onClick={handleWishlist}
                aria-label="Wishlist"
              >
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
                onClick={() => { onClose(); onViewFull && onViewFull(); }}
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
