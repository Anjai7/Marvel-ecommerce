import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Heart, ShoppingCart, Star, Eye } from "lucide-react";
import { useToast } from "../ui";
import { apiFetchProducts } from "../../api/backendApi";

function FVCard({ product, onView }) {
  const [wishlisted, setWishlisted] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);
  const { addToast } = useToast();

  const title = product.title || product.name || "Product";
  const image = product.image_url || product.image || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500";
  const price = parseFloat(product.price) || 0;
  const originalPrice = parseFloat(product.original_price || product.originalPrice) || Math.round(price * 1.25);
  const rating = parseFloat(product.rating) || 4.8;
  const reviews = parseInt(product.reviews_count || product.reviews) || 48;

  const handleCart = (e) => {
    e.stopPropagation();
    setCartAdded(true);
    addToast({ title: "Added to Cart", message: `${title} added to cart.`, type: "success" });
    setTimeout(() => setCartAdded(false), 2000);
  };

  const handleWish = (e) => {
    e.stopPropagation();
    setWishlisted(w => !w);
    addToast({
      title: !wishlisted ? "Saved to Wishlist" : "Removed from Wishlist",
      message: `${title} ${!wishlisted ? "added to" : "removed from"} your favorites.`,
      type: !wishlisted ? "success" : "info",
    });
  };

  const discount = originalPrice > price
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : 0;

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
      {discount > 0 && (
        <span className="fv-badge fv-badge-discount">
          {discount}% OFF
        </span>
      )}
      <button className="fv-wish" onClick={handleWish} aria-label="Wishlist">
        <Heart size={16} fill={wishlisted ? "#ef4444" : "none"} color={wishlisted ? "#ef4444" : "#94a3b8"} />
      </button>

      <div className="fv-img-wrap">
        <img src={image} alt={title} className="fv-img" loading="lazy" />
        <div className="fv-overlay">
          <Eye size={15} /> Quick View
        </div>
      </div>

      <div className="fv-info">
        <div className="fv-name" title={title}>{title}</div>

        <div className="fv-rating-row">
          <span className="fv-rating-chip">
            <Star size={11} fill="#f59e0b" color="#f59e0b" />
            <strong>{rating}</strong>
          </span>
          <span className="fv-review-count">({reviews.toLocaleString()})</span>
        </div>

        <div className="fv-price-row">
          <span className="fv-price">${price.toFixed(2)}</span>
          {originalPrice > price && (
            <span className="fv-original">${originalPrice.toFixed(2)}</span>
          )}
        </div>

        <button
          className={`fv-cart-btn ${cartAdded ? "added" : ""}`}
          onClick={handleCart}
          id={`fv-cart-${product.id}`}
        >
          {cartAdded ? "✓ Added" : <><ShoppingCart size={14} /> Add to Cart</>}
        </button>
      </div>
    </div>
  );
}

export default function FrequentlyVisited({ onView }) {
  const scrollRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);
  const [items, setItems] = useState([]);

  useEffect(() => {
    const loadItems = async () => {
      try {
        const liveProds = await apiFetchProducts();
        if (liveProds && liveProds.length > 0) {
          setItems(liveProds.slice(0, 8));
        }
      } catch (err) {
        console.error("Error loading frequently visited:", err);
      }
    };
    loadItems();
  }, []);

  // Group products into pairs of 2 for 2-card slider design
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
    <section className="fv-section" id="frequently-visited">
      <div className="container">
        <div className="fv-header">
          <div>
            <h2 className="fv-title">Frequently Visited Together</h2>
            <p className="fv-subtitle">Customers who viewed this item also explored these products</p>
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
                {pair.map(product => (
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
