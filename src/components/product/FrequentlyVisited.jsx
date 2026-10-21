import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Heart, ShoppingCart, Star, Eye } from "lucide-react";
import { useToast } from "../ui";
import { useCart } from "../../context/CartContext";
import { apiFetchProducts } from "../../api/backendApi";
import { formatCurrency } from "../../lib/currency";

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function textOrNull(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function FVCard({ product, onView }) {
  const [wishlisted, setWishlisted] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);
  const { addToast } = useToast();
  const { addItem } = useCart();

  const title = textOrNull(product.title) || textOrNull(product.name) || "Product";
  const image = textOrNull(product.image_url) || textOrNull(product.image);
  const price = numberOrNull(product.price);
  const originalPrice = numberOrNull(product.original_price ?? product.originalPrice);
  const rating = numberOrNull(product.rating);
  const reviews = numberOrNull(product.reviews_count ?? product.reviews);

  const handleCart = (e) => {
    e.stopPropagation();
    setCartAdded(true);
    addItem(product, 1);
    addToast({ title: "Added to Cart", message: `${title} added to cart.`, type: "success" });
    setTimeout(() => setCartAdded(false), 2000);
  };

  const handleWish = (e) => {
    e.stopPropagation();
    setWishlisted((w) => !w);
    addToast({
      title: !wishlisted ? "Saved to Wishlist" : "Removed from Wishlist",
      message: `${title} ${!wishlisted ? "added to" : "removed from"} your favorites.`,
      type: !wishlisted ? "success" : "info",
    });
  };

  const discount =
    price !== null && originalPrice !== null && originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : null;

  const handleView = () => onView && onView(product);

  const handleKeyDown = (e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleView();
    }
  };

  return (
    <div
      className="fv-card"
      id={`fv-card-${product.id}`}
      onClick={handleView}
      onKeyDown={handleKeyDown}
      tabIndex={onView ? 0 : undefined}
      role={onView ? "link" : undefined}
      aria-label={onView ? `View ${title}` : undefined}
      style={{ cursor: onView ? "pointer" : "default" }}
    >
      {discount !== null && discount > 0 && (
        <span className="fv-badge fv-badge-discount">{discount}% OFF</span>
      )}
      <button className="fv-wish" onClick={handleWish} aria-label="Wishlist">
        <Heart
          size={16}
          fill={wishlisted ? "#ef4444" : "none"}
          color={wishlisted ? "#ef4444" : "#94a3b8"}
        />
      </button>

      <div className="fv-img-wrap">
        {image ? (
          <img src={image} alt={title} className="fv-img" loading="lazy" />
        ) : (
          <div className="fv-img" style={{ background: "#f1f5f9" }} aria-hidden="true" />
        )}
        <div className="fv-overlay">
          <Eye size={15} /> View Product
        </div>
      </div>

      <div className="fv-info">
        <div className="fv-name" title={title}>
          {title}
        </div>

        {rating !== null && (
          <div className="fv-rating-row">
            <span className="fv-rating-chip">
              <Star size={11} fill="#f59e0b" color="#f59e0b" />
              <strong>{rating}</strong>
            </span>
            {reviews !== null && reviews > 0 && (
              <span className="fv-review-count">({reviews.toLocaleString()})</span>
            )}
          </div>
        )}

        <div className="fv-price-row">
          {price !== null && <span className="fv-price">{formatCurrency(price)}</span>}
          {price !== null && originalPrice !== null && originalPrice > price && (
            <span className="fv-original">{formatCurrency(originalPrice)}</span>
          )}
        </div>

        <button
          className={`fv-cart-btn ${cartAdded ? "added" : ""}`}
          onClick={handleCart}
          id={`fv-cart-${product.id}`}
        >
          {cartAdded ? (
            "✓ Added"
          ) : (
            <>
              <ShoppingCart size={14} /> Add to Cart
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * "More From the Store" — other products from the catalogue.
 *
 * This strip is a plain catalogue list, so its heading says exactly that. There
 * is no view-tracking endpoint behind it and the copy must not claim one.
 */
export default function FrequentlyVisited({ onView, excludeId }) {
  const scrollRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);
  const [items, setItems] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const loadItems = async () => {
      try {
        const products = await apiFetchProducts();
        if (cancelled || !Array.isArray(products)) return;
        setItems(
          products
            .filter((product) => product && String(product.id) !== String(excludeId))
            .slice(0, 8)
        );
      } catch {
        if (!cancelled) setItems([]);
      }
    };

    loadItems();
    return () => {
      cancelled = true;
    };
  }, [excludeId]);

  // Group products into pairs of 2 for the 2-card slider design
  const pairs = [];
  for (let i = 0; i < items.length; i += 2) {
    pairs.push(items.slice(i, i + 2));
  }

  const updateArrows = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanLeft(scrollLeft > 4);
    setCanRight(scrollLeft + clientWidth < scrollWidth - 6);
  };

  const scroll = (dir) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir * 320, behavior: "smooth" });
      setTimeout(updateArrows, 320);
    }
  };

  if (items.length === 0) return null;

  return (
    <section className="fv-section" id="more-products">
      <div className="container">
        <div className="fv-header">
          <div>
            <h2 className="fv-title">More From the Store</h2>
            <p className="fv-subtitle">Other products currently listed in our catalogue</p>
          </div>
        </div>

        <div className="fv-slider-wrap">
          <button
            className="fv-arrow fv-arrow-left"
            onClick={() => scroll(-1)}
            disabled={!canLeft}
            aria-label="Scroll left"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="fv-track fv-track-pairs" ref={scrollRef} onScroll={updateArrows}>
            {pairs.map((pair, idx) => (
              <div className="fv-pair-column" key={idx}>
                {pair.map((product) => (
                  <FVCard key={product.id} product={product} onView={onView} />
                ))}
              </div>
            ))}
          </div>

          <button
            className="fv-arrow fv-arrow-right"
            onClick={() => scroll(1)}
            disabled={!canRight}
            aria-label="Scroll right"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </section>
  );
}
