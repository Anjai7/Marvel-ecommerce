import React, { useState } from "react";
import { Card, Badge, Button, Rating, ProductPrice, SimpleTooltip, useToast } from "./ui";
import { Heart, ShoppingCart, Check, Eye } from "lucide-react";

export function ProductCard({ product, onQuickView }) {
  const [wishlisted, setWishlisted] = useState(false);
  const [cartState, setCartState] = useState("idle"); // idle | loading | added
  const [imageLoaded, setImageLoaded] = useState(false);
  const { addToast } = useToast();

  const handleWishlist = (e) => {
    e.stopPropagation();
    const nextState = !wishlisted;
    setWishlisted(nextState);
    addToast({
      title: nextState ? "Saved to Wishlist" : "Removed from Wishlist",
      message: `${product.name} ${nextState ? "added to" : "removed from"} your favorites.`,
      type: nextState ? "success" : "info",
    });
  };

  const handleCart = (e) => {
    e.stopPropagation();
    if (cartState !== "idle") return;
    setCartState("loading");
    setTimeout(() => {
      setCartState("added");
      addToast({
        title: "Added to Cart",
        message: `${product.name} was added to your shopping cart.`,
        type: "success",
      });
      setTimeout(() => setCartState("idle"), 2000);
    }, 400);
  };

  return (
    <Card className="product-card" id={`product-${product.id}`}>
      {product.badge && (
        <Badge variant="accent" className="product-badge">
          {product.badge}
        </Badge>
      )}
      {product.tag && (
        <Badge variant="secondary" className="product-tag">
          {product.tag}
        </Badge>
      )}

      {/* Image Container with aspect ratio 1/1 & skeleton shimmer */}
      <div className="product-img-container">
        {!imageLoaded && <div className="product-img-skeleton" />}
        <img
          src={product.image}
          alt={product.name}
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
        <div className="product-name" title={product.name}>
          {product.name}
        </div>
        {product.desc && <div className="product-desc">{product.desc}</div>}

        <div className="product-rating-row">
          <Rating rating={product.rating} count={product.reviews} />
        </div>

        <div className="product-price-row">
          <ProductPrice
            price={product.price}
            originalPrice={product.originalPrice}
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
