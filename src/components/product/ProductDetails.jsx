import React, { useState, useEffect, useRef } from "react";
import {
  Star, ShoppingCart, Zap, Heart, Truck, Shield, RefreshCw,
  MapPin, ChevronDown, ChevronUp, Tag, CreditCard, Package,
  Store, CheckCircle, AlertCircle, Share2, Check, Clock
} from "lucide-react";
import { Badge, useToast } from "../ui";

function fmt(n) {
  return "₹" + n.toLocaleString("en-IN");
}

function StarsDisplay({ rating, size = 14 }) {
  return (
    <span className="pd-stars-row">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          fill={s <= Math.round(rating) ? "#f59e0b" : "none"}
          color={s <= Math.round(rating) ? "#f59e0b" : "#d1d5db"}
        />
      ))}
    </span>
  );
}

// ── Live countdown timer ────────────────────────────────────────
function CountdownTimer({ seconds: initSecs }) {
  const [secs, setSecs] = useState(initSecs);
  useEffect(() => {
    const id = setInterval(() => setSecs(s => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);
  const h = String(Math.floor(secs / 3600)).padStart(2, "0");
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return <strong className="pd-countdown">{h}:{m}:{s}</strong>;
}

// ── Section divider label ───────────────────────────────────────
function SectionLabel({ children }) {
  return <div className="pd-section-label">{children}</div>;
}

export default function ProductDetails({ product }) {
  const [selectedColor, setSelectedColor] = useState(0);
  const [selectedSize,  setSelectedSize]  = useState(0);
  const [qty,           setQty]           = useState(1);
  const [pincode,       setPincode]       = useState("");
  const [pincodeMsg,    setPincodeMsg]    = useState(null);
  const [offersOpen,    setOffersOpen]    = useState(false);
  const [emiOpen,       setEmiOpen]       = useState(false);
  const [cartState,     setCartState]     = useState("idle");
  const [wishlisted,    setWishlisted]    = useState(false);
  const { addToast } = useToast();

  if (!product) return null;

  const { offerDetails, deliveryInfo, seller, highlights, sizes } = product;

  const handleCart = () => {
    if (cartState === "added") return;
    setCartState("added");
    addToast({ title: "Added to Cart", message: `${product.name} added to cart.`, type: "success" });
    setTimeout(() => setCartState("idle"), 2500);
  };

  const handleBuyNow = () => {
    addToast({ title: "Proceeding to Checkout", message: "Redirecting to checkout...", type: "info" });
  };

  const checkPincode = () => {
    if (pincode.length === 6) {
      setPincodeMsg({ ok: true, msg: `Delivery by ${deliveryInfo.estimatedDays} to ${pincode}` });
    } else {
      setPincodeMsg({ ok: false, msg: "Please enter a valid 6-digit pincode." });
    }
  };

  return (
    <div className="pd-root">
      {/* ── Brand + Stock Badges ── */}
      <div className="pd-top-row">
        <span className="pd-brand">{product.brand}</span>
        <div className="pd-badges-row">
          {product.tag && <Badge variant="secondary" size="sm">{product.tag}</Badge>}
          {product.inStock
            ? <Badge variant="success" size="sm">✓ In Stock</Badge>
            : <Badge variant="danger"  size="sm">Out of Stock</Badge>
          }
        </div>
      </div>

      {/* ── Product Name ── */}
      <h1 className="pd-name">{product.name}</h1>

      {/* ── Ratings & Social Proof ── */}
      <div className="pd-rating-row">
        <span className="pd-rating-chip">
          <StarsDisplay rating={product.rating} size={13} />
          <strong>{product.rating}</strong>
        </span>
        <span className="pd-review-count">{product.reviews.toLocaleString()} Ratings</span>
        <span className="pd-sep">·</span>
        <a href="#reviews" className="pd-review-link">{product.reviews.toLocaleString()} Reviews</a>
        <span className="pd-sep">·</span>
        <button className="pd-share-btn" aria-label="Share product">
          <Share2 size={14} /> Share
        </button>
      </div>

      {/* ─────────── 1. PRICE SECTION ─────────── */}
      <div className="pd-card-block pd-price-card">
        <div className="pd-price-main">
          <span className="pd-current-price">{fmt(product.price)}</span>
          <span className="pd-original-price">{fmt(product.originalPrice)}</span>
          <span className="pd-discount-badge">{product.discount}% OFF</span>
        </div>
        <div className="pd-price-sub">
          <span className="pd-inclusive">Inclusive of all taxes</span>
          <span className="pd-savings-pill">Save {fmt(product.originalPrice - product.price)}</span>
        </div>
        
        {/* ─────────── 2. OFFER / COUNTDOWN BANNER ─────────── */}
        <div className="pd-limited-offer">
          <Clock size={14} />
          <span>Limited Time Price — Deal ends in </span>
          <CountdownTimer seconds={16331} />
        </div>
      </div>

      {/* ─────────── 3. PAYMENT & EMI ─────────── */}
      <div className="pd-card-block pd-payment-block">
        <div className="pd-block-header">
          <CreditCard size={16} className="pd-icon-accent" />
          <span className="pd-block-title">Payment Options</span>
        </div>
        <div className="pd-payment-row">
          <button className="pd-emi-toggle" onClick={() => setEmiOpen(!emiOpen)}>
            <div className="pd-emi-info">
              <span>No Cost EMI from <strong>{fmt(offerDetails?.emiOptions?.[0]?.emi || Math.round(product.price / 3))}/mo</strong></span>
              <span className="pd-emi-sub">Standard & Bajaj Finserv Card EMIs available</span>
            </div>
            <span className="pd-emi-action">
              {emiOpen ? "Hide Plans" : "View Plans"}
              {emiOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </span>
          </button>

          {emiOpen && offerDetails?.emiOptions && (
            <div className="pd-emi-panel">
              <div className="pd-emi-title">Available EMI Plans</div>
              <div className="pd-emi-table">
                <div className="pd-emi-header">
                  <span>Tenure</span><span>Monthly EMI</span><span>Interest</span>
                </div>
                {offerDetails.emiOptions.map((opt) => (
                  <div className="pd-emi-row" key={opt.months}>
                    <span>{opt.months} Months</span>
                    <span>{fmt(opt.emi)}</span>
                    <span className={opt.interest === "No Cost" ? "pd-emi-free" : ""}>{opt.interest}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─────────── 4. QUANTITY & OPTIONS ─────────── */}
      <div className="pd-card-block pd-options-card">
        {/* Colors */}
        {product.colors && product.colors.length > 0 && (
          <div className="pd-option-group">
            <div className="pd-option-label">
              <span>Color: <strong>{product.colors[selectedColor || 0]?.name}</strong></span>
              <span className="pd-color-avail">
                {product.colors[selectedColor || 0]?.available ? "In Stock" : "Out of Stock"}
              </span>
            </div>
            <div className="pd-color-swatches">
              {product.colors.map((c, i) => (
                <button
                  key={c.name}
                  className={`pd-color-btn ${i === (selectedColor || 0) ? "active" : ""} ${!c.available ? "disabled" : ""}`}
                  onClick={() => setSelectedColor(i)}
                  title={`${c.name} (${c.available ? "In Stock" : "Out of Stock"})`}
                  disabled={!c.available}
                >
                  <span className="pd-color-circle" style={{ background: c.hex }} />
                  <span className="pd-color-name">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sizes */}
        {sizes && sizes.length > 1 && (
          <div className="pd-option-group">
            <div className="pd-option-label">
              <span>Select Size: <strong>{sizes[selectedSize]}</strong></span>
              <a href="#info" className="pd-size-guide">Size Guide →</a>
            </div>
            <div className="pd-size-pills">
              {sizes.map((s, i) => (
                <button
                  key={i}
                  className={`pd-size-pill ${i === selectedSize ? "active" : ""}`}
                  onClick={() => setSelectedSize(i)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quantity Stepper */}
        <div className="pd-option-group">
          <div className="pd-option-label">
            <span>Quantity</span>
            {qty >= 10 && <span className="pd-qty-max-hint">Max 10 per order</span>}
          </div>
          <div className="pd-qty-row">
            <button className="pd-qty-btn" onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Decrease quantity">−</button>
            <span className="pd-qty-val">{qty}</span>
            <button className="pd-qty-btn" onClick={() => setQty(q => Math.min(10, q + 1))} aria-label="Increase quantity">+</button>
          </div>
        </div>
      </div>

      {/* ── Key Highlights ── */}
      {highlights && highlights.length > 0 && (
        <div className="pd-card-block pd-highlights-block">
          <div className="pd-block-header">
            <CheckCircle size={15} className="pd-icon-accent" />
            <span className="pd-block-title">Key Features</span>
          </div>
          <ul className="pd-highlight-list">
            {highlights.map((h, i) => (
              <li key={i}>
                <Check size={14} className="pd-hl-check" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─────────── 5. CTA BUTTONS SECTION ─────────── */}
      <div className="pd-cta-wrapper">
        <div className="pd-cta-row">
          <button
            className={`pd-cta-cart ${cartState === "added" ? "added" : ""}`}
            onClick={handleCart}
            id="add-to-cart-btn"
          >
            {cartState === "added" ? (
              <><Check size={20} /> Added to Cart!</>
            ) : (
              <><ShoppingCart size={20} /> Add to Cart</>
            )}
          </button>
          <button className="pd-cta-buynow" onClick={handleBuyNow} id="buy-now-btn">
            <Zap size={20} /> Buy Now
          </button>
        </div>

        <button
          className={`pd-wishlist-btn ${wishlisted ? "active" : ""}`}
          onClick={() => {
            setWishlisted(w => !w);
            addToast({
              title: !wishlisted ? "Saved to Wishlist" : "Removed from Wishlist",
              message: `${product.name} ${!wishlisted ? "added to" : "removed from"} your favorites.`,
              type: !wishlisted ? "success" : "info"
            });
          }}
          id="wishlist-btn"
        >
          <Heart size={16} fill={wishlisted ? "#ef4444" : "none"} color={wishlisted ? "#ef4444" : "currentColor"} />
          {wishlisted ? "Saved to Wishlist" : "Add to Wishlist"}
        </button>
      </div>

      {/* ─────────── OFFERS & BANK DEALS ─────────── */}
      <div className="pd-card-block pd-offers-card">
        <div className="pd-offers-header">
          <div className="pd-offers-title-group">
            <Tag size={16} className="pd-icon-green" />
            <span className="pd-block-title">Available Offers & Coupons</span>
            <span className="pd-offers-badge">{((offerDetails?.bankOffers?.length || 0) + (offerDetails?.couponOffers?.length || 0))} Active</span>
          </div>
          <button className="pd-offers-viewall-btn" onClick={() => setOffersOpen(o => !o)}>
            {offersOpen ? "Show Less" : "View All"}
            {offersOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>

        {/* Featured Offer Snippets (Visible by default) */}
        <div className="pd-offers-preview">
          {offerDetails?.bankOffers?.[0] && (
            <div className="pd-offer-chip-item">
              <span className="pd-chip-tag">BANK</span>
              <span className="pd-chip-desc" title={`${offerDetails.bankOffers[0].bank}: ${offerDetails.bankOffers[0].offer}`}>{offerDetails.bankOffers[0].bank}: {offerDetails.bankOffers[0].offer}</span>
            </div>
          )}
          {offerDetails?.couponOffers?.[0] && (
            <div className="pd-offer-chip-item">
              <span className="pd-chip-tag coupon">COUPON</span>
              <span className="pd-chip-desc" title={offerDetails.couponOffers[0].desc}>{offerDetails.couponOffers[0].desc}</span>
              <span className="pd-chip-code">{offerDetails.couponOffers[0].code}</span>
            </div>
          )}
        </div>

        {/* Expanded Full Offers Panel */}
        {offersOpen && (
          <div className="pd-offers-panel">
            {offerDetails?.bankOffers?.length > 0 && (
              <>
                <div className="pd-offers-group-label">💳 Bank Discounts</div>
                {offerDetails.bankOffers.map((o, i) => (
                  <div className="pd-offer-item" key={i}>
                    <CreditCard size={15} className="pd-offer-icon" />
                    <div className="pd-offer-content">
                      <strong>{o.bank}:</strong> {o.offer}
                      {o.code && <span className="pd-offer-code-badge">Code: <strong>{o.code}</strong></span>}
                    </div>
                  </div>
                ))}
              </>
            )}

            {offerDetails?.couponOffers?.length > 0 && (
              <>
                <div className="pd-offers-group-label" style={{ marginTop: 14 }}>🏷️ Promo Coupons</div>
                {offerDetails.couponOffers.map((o, i) => (
                  <div className="pd-offer-item" key={i}>
                    <Tag size={15} className="pd-offer-icon" />
                    <div className="pd-offer-content">
                      <span>{o.desc}</span>
                      <span className="pd-offer-code-badge">Code: <strong>{o.code}</strong></span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* ─────────── DELIVERY & CHECK ─────────── */}
      <div className="pd-card-block pd-delivery-card">
        <div className="pd-block-header">
          <Truck size={16} className="pd-icon-accent" />
          <span className="pd-block-title">Delivery Options</span>
        </div>
        <div className="pd-pincode-row">
          <MapPin size={15} className="pd-pincode-icon" />
          <input
            className="pd-pincode-input"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="Enter 6-digit Pincode"
            value={pincode}
            onChange={(e) => { setPincode(e.target.value.replace(/\D/, "")); setPincodeMsg(null); }}
            onKeyDown={(e) => e.key === "Enter" && checkPincode()}
          />
          <button className="pd-pincode-btn" onClick={checkPincode}>Check Availability</button>
        </div>
        {pincodeMsg && (
          <p className={`pd-pincode-msg ${pincodeMsg.ok ? "ok" : "err"}`}>
            {pincodeMsg.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {pincodeMsg.msg}
          </p>
        )}
        <div className="pd-delivery-chips">
          {deliveryInfo?.freeShipping && (
            <span className="pd-delivery-chip good"><Truck size={13} /> Free Shipping</span>
          )}
          {deliveryInfo?.expressAvailable && (
            <span className="pd-delivery-chip good"><Zap size={13} /> Express Delivery</span>
          )}
          <span className="pd-delivery-chip"><RefreshCw size={13} /> {deliveryInfo?.returnDays || 14}-Day Easy Returns</span>
          <span className="pd-delivery-chip"><Shield size={13} /> {deliveryInfo?.warranty || "2 Years Marvel Warranty"}</span>
        </div>
      </div>

      {/* ── Seller Info ── */}
      <div className="pd-seller-card">
        <Store size={16} className="pd-seller-icon" />
        <div className="pd-seller-details">
          <div className="pd-seller-line">
            <span className="pd-seller-label">Seller: </span>
            <a href="#info" className="pd-seller-name">
              {seller?.name || "Verified Marvel Seller"}
              {seller?.verified && <CheckCircle size={13} className="pd-seller-verified" />}
            </a>
            <span className="pd-seller-rating-pill">{seller?.rating || 4.9} ★</span>
          </div>
          <div className="pd-seller-sub">{seller?.soldBy || "Verified Marvel Seller"} · 100% Genuine Product</div>
        </div>
      </div>
    </div>
  );
}
