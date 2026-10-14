import React, { useState } from "react";
import { Card, Badge, Button, Rating, ProductPrice, SimpleTooltip, useToast } from "./ui";
import { Heart, ShoppingCart, Check, Eye } from "lucide-react";
import { useCart } from "../context/CartContext";

export function ProductCard({ product, onQuickView, onNavigate }) {
  const [wishlisted, setWishlisted] = useState(false);
  const [cartState, setCartState] = useState("idle"); // idle | loading | added
  const [imageLoaded, setImageLoaded] = useState(false);
  const { addToast } = useToast();
  const { addItem } = useCart();

  const title = product?.title || product?.name || "Product";
  const image = product?.image_url || product?.image || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500";
  const rating = product?.rating || 4.8;
  const reviews = product?.reviews_count || product?.reviews || 24;
  const price = product?.price || 0;
  const originalPrice = product?.original_price || product?.originalPrice;
  const desc = product?.description || product?.desc;

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

  // Genuine promotional offer detection (only shown on select items with offer/discount)
  const discountPercent = product?.discount ? Number(product.discount) : (originalPrice && Number(originalPrice) > Number(price) ? Math.round(((Number(originalPrice) - Number(price)) / Number(originalPrice)) * 100) : null);
  
  const hasOffer = Boolean(
    product?.is_on_sale ||
    product?.has_offer ||
    (discountPercent && discountPercent >= 20 && (product?.is_featured || (typeof product?.id === 'number' && product.id % 3 === 0) || (typeof product?.id === 'string' && product.id.charCodeAt(product.id.length - 1) % 3 === 0)))
  );

  const offerRibbonText = discountPercent ? `${discountPercent}% OFF` : (product?.offer_text || "SPECIAL DEAL");

  return (
    <Card
      className="product-card"
      id={`product-${product.id}`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      tabIndex={onNavigate ? 0 : undefined}
      role={onNavigate ? "link" : undefined}
      aria-label={onNavigate ? `View ${title}` : undefined}
      style={{ cursor: onNavigate ? "pointer" : "default" }}
    >
      {/* 45-Degree Slanted Gift Wrapper Offer Ribbon on Left Side (Only on Offer Items) */}
      {hasOffer && (
        <div className="product-card-offer-ribbon-left">
          <span className="card-ribbon-text">
            🎁 {offerRibbonText}
          </span>
        </div>
      )}

      {(product.tag || product.category) && (
        <Badge variant="secondary" className="product-tag">
          {product.tag || product.category}
        </Badge>
      )}

      {/* Image Container with aspect ratio 1/1 & skeleton shimmer */}
      <div className="product-img-container">
        {!imageLoaded && <div className="product-img-skeleton" />}
        <img
          src={image}
          alt={title}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
          className={`product-img-element ${imageLoaded ? "is-loaded" : "is-loading"}`}
        />

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

        <div className="product-rating-row">
          <Rating rating={rating} count={reviews} />
        </div>

        <div className="product-price-row">
          <ProductPrice
            price={price}
            originalPrice={originalPrice}
            discount={product.discount}
          />
        </div>

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
