import React, { useState } from "react";
import { Card, Badge, Button, Rating, ProductPrice, SimpleTooltip, useToast } from "./ui";
import { Heart, ShoppingCart, Check, Eye } from "lucide-react";
import { useCart } from "../context/CartContext";
import { offerBadgeLabel } from "../lib/offers";

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function textOrNull(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export function ProductCard({ product, onQuickView, onNavigate }) {
  const [wishlisted, setWishlisted] = useState(false);
  const [cartState, setCartState] = useState("idle"); // idle | loading | added
  const [imageLoaded, setImageLoaded] = useState(false);
  const { addToast } = useToast();
  const { addItem } = useCart();

  const title = textOrNull(product?.title) || textOrNull(product?.name) || "Product";
  const image = textOrNull(product?.image_url) || textOrNull(product?.image);
  const rating = numberOrNull(product?.rating);
  const reviews = numberOrNull(product?.reviews_count ?? product?.reviews);
  const price = numberOrNull(product?.price);
  const originalPrice = numberOrNull(product?.original_price ?? product?.originalPrice);
  const desc = textOrNull(product?.description) || textOrNull(product?.desc);
  const offerText = textOrNull(product?.offer_text);

  const handleWishlist = (e) => {
    e.stopPropagation();
    const nextState = !wishlisted;
    setWishlisted(nextState);
    addToast({
      title: nextState ? "Saved to Wishlist" : "Removed from Wishlist",
      message: `${title} ${nextState ? "added to" : "removed from"} your favorites.`,
      type: nextState ? "success" : "info",
    });
  };

  const handleCart = (e) => {
    e.stopPropagation();
    if (cartState !== "idle") return;
    setCartState("loading");
    setTimeout(() => {
      setCartState("added");
      addItem(product, 1);
      addToast({
        title: "Added to Cart",
        message: `${title} was added to your shopping cart.`,
        type: "success",
      });
      setTimeout(() => setCartState("idle"), 2000);
    }, 400);
  };

  const handleCardClick = () => {
    if (onNavigate) onNavigate(product);
  };

  const handleCardKeyDown = (e) => {
    if (e.target !== e.currentTarget) return;
    if ((e.key === "Enter" || e.key === " ") && onNavigate) {
      e.preventDefault();
      onNavigate(product);
    }
  };

  // The badge carries the offer's name; the figures stay with the price.
  const offerBadge = offerBadgeLabel(offerText);

  const discountPercent =
    price !== null && originalPrice !== null && originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : null;

  return (
    <Card
      id={`product-${product.id}`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      tabIndex={onNavigate ? 0 : undefined}
      role={onNavigate ? "link" : undefined}
      aria-label={onNavigate ? `View ${title}` : undefined}
      className={onNavigate ? "product-card" : "product-card product-card--static"}
    >
      {/* The offer label: the stored offer, shortened to the words a badge
          can hold. The full sentence belongs on the product page. */}
      {offerBadge && (
        <span className="product-card-offer-label" title={offerText}>
          {offerBadge}
        </span>
      )}

      {(product.tag || product.category) && (
        <Badge variant="secondary" className="product-tag">
          {product.tag || product.category}
        </Badge>
      )}

      {/* Image Container with aspect ratio 1/1 & skeleton shimmer */}
      <div className="product-img-container">
        {image ? (
          <>
            {!imageLoaded && <div className="product-img-skeleton" />}
            <img
              src={image}
              alt={title}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
              className={`product-img-element ${imageLoaded ? "is-loaded" : "is-loading"}`}
            />
          </>
        ) : (
          <div className="product-img-skeleton" aria-hidden="true" />
        )}

        {/* Quick View Button on Hover */}
        <button
          className="quickview-trigger-btn"
          onClick={(e) => {
            e.stopPropagation();
            if (onQuickView) onQuickView(product);
          }}
          aria-label="Quick View"
        >
          <Eye size={15} /> Quick View
        </button>

        {/* Wishlist Button */}
        <SimpleTooltip content={wishlisted ? "Remove from wishlist" : "Add to wishlist"}>
          <button
            className="product-wishlist"
            id={`wish-${product.id}`}
            onClick={handleWishlist}
            aria-label="Toggle wishlist"
          >
            <Heart
              size={18}
              className={wishlisted ? "wish-pop" : ""}
              fill={wishlisted ? "#ef4444" : "none"}
              color={wishlisted ? "#ef4444" : "#9ca3af"}
            />
          </button>
        </SimpleTooltip>
      </div>

      {/* Info Container */}
      <div className="product-info">
        <div className="product-name" title={title}>
          {title}
        </div>
        {desc && <div className="product-desc">{desc}</div>}

        {rating !== null && (
          <div className="product-rating-row">
            <Rating rating={rating} count={reviews !== null ? reviews : undefined} />
          </div>
        )}

        {price !== null && (
          <div className="product-price-row">
            <ProductPrice price={price} originalPrice={originalPrice} discount={discountPercent} />
          </div>
        )}

        <div className="product-actions">
          <Button
            variant={cartState === "added" ? "secondary" : "accent"}
            size="sm"
            isLoading={cartState === "loading"}
            className={`add-cart-btn ${cartState === "added" ? "added" : ""}`}
            id={`cart-${product.id}`}
            onClick={handleCart}
            leftIcon={cartState === "added" ? <Check size={16} /> : <ShoppingCart size={16} />}
          >
            {cartState === "added" ? "Added!" : "Add to Cart"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default ProductCard;
