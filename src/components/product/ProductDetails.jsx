import React, { useEffect, useState } from "react";
import {
  Star,
  ShoppingCart,
  Zap,
  Heart,
  Truck,
  Shield,
  RefreshCw,
  MapPin,
  ChevronDown,
  ChevronUp,
  Tag,
  CreditCard,
  Store,
  CheckCircle,
  AlertCircle,
  Share2,
  Check,
  Clock,
} from "lucide-react";
import { Badge, useToast } from "../ui";
import { useCart } from "../../context/CartContext";
import { formatCurrency } from "../../lib/currency";

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

/** Seconds left until an ISO timestamp; 0 when absent, invalid or past. */
function secondsUntil(endsAt) {
  if (!endsAt) return 0;
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - Date.now()) / 1000));
}

/**
 * "Deal ends in" banner.
 *
 * Renders only while `product.offer_ends_at` is still in the future; with no
 * timestamp, an invalid one or an expired one it renders nothing at all.
 */
function OfferCountdown({ endsAt }) {
  const [secs, setSecs] = useState(() => secondsUntil(endsAt));

  useEffect(() => {
    setSecs(secondsUntil(endsAt));
    const id = setInterval(() => setSecs(secondsUntil(endsAt)), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (secs <= 0) return null;

  const h = String(Math.floor(secs / 3600)).padStart(2, "0");
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");

  return (
    <div className="pd-limited-offer">
      <Clock size={14} />
      <span>Deal ends in</span>
      <strong className="pd-countdown">
        {h}:{m}:{s}
      </strong>
    </div>
  );
}

function offerText(offer) {
  return offer?.description || offer?.title || null;
}

/** The human label of every option kind — "color" reads as "Colour". */
const OPTION_KIND_LABELS = {
  color: "Colour",
  size: "Size",
  capacity: "Capacity",
  storage: "Storage",
  material: "Material",
  style: "Style",
  weight: "Weight",
  flavour: "Flavour",
};

/** "color" → "Colour"; an unknown kind reads as its own capitalised word. */
function optionKindLabel(kind) {
  if (typeof kind !== "string") return "";
  const key = kind.trim().toLowerCase();
  if (!key) return "";
  if (OPTION_KIND_LABELS[key]) return OPTION_KIND_LABELS[key];
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * The option values of one product, grouped by kind.
 *
 * The kinds keep the order in which they first appear and every kind keeps
 * the order the API returned its values in.
 */
function groupOptionValues(variantOptions) {
  const groups = [];
  const byKind = new Map();
  for (const option of variantOptions) {
    if (!option || typeof option !== "object") continue;
    const kind = typeof option.kind === "string" ? option.kind.trim() : "";
    const label = typeof option.label === "string" ? option.label.trim() : "";
    if (!kind || !label) continue;
    if (!byKind.has(kind)) {
      const group = { kind, label: optionKindLabel(kind), values: [] };
      byKind.set(kind, group);
      groups.push(group);
    }
    byKind.get(kind).values.push({ ...option, kind, label });
  }
  return groups;
}

/**
 * The combination that stands for the customer's choice.
 *
 * A combination matches when it holds a value of the same kind and label for
 * every kind the customer chose. A combination that covers exactly those
 * kinds wins over one that covers only some of them.
 */
function matchCombination(groups, combinations) {
  if (groups.length === 0 || !Array.isArray(combinations)) return null;

  const covers = (candidate, exact) => {
    const options = Array.isArray(candidate?.options) ? candidate.options : [];
    if (options.length === 0) return false;
    const matches = groups.every((group) =>
      options.some((option) => option?.kind === group.kind && option?.label === group.chosen.label)
    );
    if (!matches) return false;
    return exact ? options.length === groups.length : true;
  };

  return (
    combinations.find((candidate) => covers(candidate, true)) ??
    combinations.find((candidate) => covers(candidate, false)) ??
    null
  );
}

export default function ProductDetails({ product }) {
  const [selection, setSelection] = useState({});
  const [qty, setQty] = useState(1);
  const [pincode, setPincode] = useState("");
  const [pincodeMsg, setPincodeMsg] = useState(null);
  const [offersOpen, setOffersOpen] = useState(false);
  const [emiOpen, setEmiOpen] = useState(false);
  const [cartState, setCartState] = useState("idle");
  const [wishlisted, setWishlisted] = useState(false);
  const { addToast } = useToast();
  const { addItem } = useCart();

  if (!product) return null;

  const {
    offers = { emi: [], bank: [], coupon: [] },
    variantOptions = [],
    combinations = [],
    highlights = [],
    reviewSummary = { overall: null, total: 0 },
    deliveryInfo = { estimatedDays: null, lines: [] },
    seller,
  } = product;

  // One choice per kind. The first value of a kind is the default, and a kind
  // whose values changed falls back to its first value as well.
  const optionGroups = groupOptionValues(variantOptions).map((group) => ({
    ...group,
    chosen: group.values.find((value) => value.label === selection[group.kind]) ?? group.values[0],
  }));

  const selectedOptions = optionGroups.map((group) => ({
    kind: group.kind,
    label: group.chosen.label,
    value: group.chosen.value ?? null,
  }));

  // The combination that stands for the customer's choice — its price, stock
  // and SKU are what the page shows and what goes into the cart.
  const combination = matchCombination(optionGroups, combinations);
  const productPrice = product.price ?? null;
  const originalPrice = product.originalPrice ?? null;
  const resolvedPrice = combination?.price != null ? combination.price : productPrice;
  const combinationStock = combination?.stock ?? null;
  const resolvedStock = combinationStock !== null ? combinationStock : (product.stock ?? null);
  const resolvedInStock = combinationStock !== null ? resolvedStock > 0 : (product.inStock ?? null);
  const resolvedSku = combination?.sku ?? product.sku ?? null;
  const combinationId = combination?.id ?? null;
  const discountPercent =
    resolvedPrice !== null && originalPrice !== null && originalPrice > resolvedPrice
      ? Math.round(((originalPrice - resolvedPrice) / originalPrice) * 100)
      : null;

  const emiLead = offers.emi[0] ?? null;
  const bankLead = offers.bank[0] ?? null;
  const couponLead = offers.coupon[0] ?? null;
  const offerCount = offers.emi.length + offers.bank.length + offers.coupon.length;

  const deliveryLines = deliveryInfo?.lines ?? [];
  const hasDelivery = deliveryLines.length > 0 || Boolean(deliveryInfo?.estimatedDays);
  const hasWarranty = Boolean(product.warranty);
  const hasRating = typeof reviewSummary?.overall === "number";
  const hasReviews = (reviewSummary?.total ?? 0) > 0;

  const handleCart = () => {
    if (cartState === "added") return;
    setCartState("added");
    addItem(
      {
        ...product,
        price: resolvedPrice,
        sku: resolvedSku,
        combination_id: combinationId,
        options: selectedOptions,
      },
      qty
    );
    addToast({
      title: "Added to Cart",
      message: `${product.name} added to cart.`,
      type: "success",
    });
    setTimeout(() => setCartState("idle"), 2500);
  };

  const handleBuyNow = () => {
    addToast({
      title: "Proceeding to Checkout",
      message: "Redirecting to checkout...",
      type: "info",
    });
  };

  const checkPincode = () => {
    if (!/^\d{6}$/.test(pincode)) {
      setPincodeMsg({ ok: false, msg: "Please enter a valid 6-digit pincode." });
      return;
    }
    if (!deliveryInfo?.estimatedDays) {
      setPincodeMsg({
        ok: false,
        msg: `No delivery estimate is configured for ${pincode} yet.`,
      });
      return;
    }
    setPincodeMsg({ ok: true, msg: `Delivery in ${deliveryInfo.estimatedDays} to ${pincode}` });
  };

  return (
    <div className="pd-root">
      {/* ── Brand + Stock Badges ── */}
      <div className="pd-top-row">
        <span className="pd-brand">{product.brand ?? ""}</span>
        <div className="pd-badges-row">
          {product.featured && (
            <Badge variant="secondary" size="sm">
              Featured
            </Badge>
          )}
          {resolvedInStock === true && (
            <Badge variant="success" size="sm">
              ✓ In Stock
            </Badge>
          )}
          {resolvedInStock === false && (
            <Badge variant="danger" size="sm">
              Out of Stock
            </Badge>
          )}
        </div>
      </div>

      {/* ── Product Name ── */}
      <h1 className="pd-name">{product.name}</h1>

      {/* ── Ratings, sourced from stored reviews only ── */}
      <div className="pd-rating-row">
        {hasRating && (
          <span className="pd-rating-chip">
            <StarsDisplay rating={reviewSummary.overall} size={13} />
            <strong>{reviewSummary.overall}</strong>
          </span>
        )}
        {hasReviews && (
          <>
            <a href="#reviews" className="pd-review-link">
              {reviewSummary.total.toLocaleString()} Reviews
            </a>
            <span className="pd-sep">·</span>
          </>
        )}
        <button className="pd-share-btn" aria-label="Share product">
          <Share2 size={14} /> Share
        </button>
      </div>

      {/* ─────────── 1. PRICE SECTION ─────────── */}
      <div className="pd-card-block pd-price-card">
        <div className="pd-price-main">
          <span className="pd-current-price">
            {resolvedPrice === null ? "—" : formatCurrency(resolvedPrice)}
          </span>
          {originalPrice !== null && resolvedPrice !== null && (
            <span className="pd-original-price">{formatCurrency(originalPrice)}</span>
          )}
          {discountPercent !== null && (
            <span className="pd-discount-badge">{discountPercent}% OFF</span>
          )}
        </div>
        <div className="pd-price-sub">
          {originalPrice !== null && resolvedPrice !== null && originalPrice > resolvedPrice && (
            <span className="pd-savings-pill">
              Save {formatCurrency(originalPrice - resolvedPrice)}
            </span>
          )}
          {product.offerText && <span className="pd-inclusive">{product.offerText}</span>}
        </div>

        <OfferCountdown endsAt={product.offerEndsAt} />
      </div>

      {/* ─────────── 2. PAYMENT & EMI (stored offers only) ─────────── */}
      {emiLead && (
        <div className="pd-card-block pd-payment-block">
          <div className="pd-block-header">
            <CreditCard size={16} className="pd-icon-accent" />
            <span className="pd-block-title">Payment Options</span>
          </div>
          <div className="pd-payment-row">
            <button className="pd-emi-toggle" onClick={() => setEmiOpen(!emiOpen)}>
              <div className="pd-emi-info">
                <span>
                  {emiLead.title ||
                    (emiLead.months !== null ? `${emiLead.months} Month EMI` : "EMI")}
                </span>
                {(emiLead.amount !== null || emiLead.interest) && (
                  <span className="pd-emi-sub">
                    {[
                      emiLead.amount !== null ? `${formatCurrency(emiLead.amount)}/mo` : null,
                      emiLead.interest,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </div>
              <span className="pd-emi-action">
                {emiOpen ? "Hide Plans" : "View Plans"}
                {emiOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </span>
            </button>

            {emiOpen && (
              <div className="pd-emi-panel">
                <div className="pd-emi-title">Available EMI Plans</div>
                <div className="pd-emi-table">
                  <div className="pd-emi-header">
                    <span>Tenure</span>
                    <span>Monthly EMI</span>
                    <span>Interest</span>
                  </div>
                  {offers.emi.map((opt, index) => (
                    <div className="pd-emi-row" key={`${opt.months}-${index}`}>
                      <span>{opt.months !== null ? `${opt.months} Months` : "—"}</span>
                      <span>{opt.amount !== null ? formatCurrency(opt.amount) : "—"}</span>
                      <span className={opt.interest === "No Cost" ? "pd-emi-free" : ""}>
                        {opt.interest ?? "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────── 3. QUANTITY & OPTIONS ─────────── */}
      <div className="pd-card-block pd-options-card">
        {optionGroups.map((group) => (
          <div className="pd-option-group" key={group.kind}>
            <div className="pd-option-label">
              <span>
                {group.label}: <strong>{group.chosen.label}</strong>
              </span>
            </div>
            {group.kind === "color" ? (
              <div className="pd-color-swatches">
                {group.values.map((value) => (
                  <button
                    key={value.id ?? `${group.kind}-${value.label}`}
                    className={`pd-color-btn ${value.label === group.chosen.label ? "active" : ""}`}
                    onClick={() =>
                      setSelection((current) => ({ ...current, [group.kind]: value.label }))
                    }
                    title={value.label}
                  >
                    <span
                      className="pd-color-circle"
                      style={
                        value.value ? { "--pd-swatch-color": value.value } : undefined
                      } /* inline-style: allowed */
                    />
                    <span className="pd-color-name">{value.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="pd-option-pills">
                {group.values.map((value) => (
                  <button
                    key={value.id ?? `${group.kind}-${value.label}`}
                    className={`pd-option-pill ${value.label === group.chosen.label ? "active" : ""}`}
                    onClick={() =>
                      setSelection((current) => ({ ...current, [group.kind]: value.label }))
                    }
                  >
                    {value.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Quantity Stepper */}
        <div className="pd-option-group">
          <div className="pd-option-label">
            <span>Quantity</span>
            {qty >= 10 && <span className="pd-qty-max-hint">Max 10 per order</span>}
          </div>
          <div className="pd-qty-row">
            <button
              className="pd-qty-btn"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="pd-qty-val">{qty}</span>
            <button
              className="pd-qty-btn"
              onClick={() => setQty((q) => Math.min(10, q + 1))}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* ── Key Highlights (stored) ── */}
      {highlights.length > 0 && (
        <div className="pd-card-block pd-highlights-block">
          <div className="pd-block-header">
            <CheckCircle size={15} className="pd-icon-accent" />
            <span className="pd-block-title">Key Features</span>
          </div>
          <ul className="pd-highlight-list">
            {highlights.map((highlight, index) => (
              <li key={index}>
                <Check size={14} className="pd-hl-check" />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─────────── 4. CTA BUTTONS SECTION ─────────── */}
      <div className="pd-cta-wrapper">
        <div className="pd-cta-row">
          <button
            className={`pd-cta-cart ${cartState === "added" ? "added" : ""}`}
            onClick={handleCart}
            id="add-to-cart-btn"
          >
            {cartState === "added" ? (
              <>
                <Check size={20} /> Added to Cart!
              </>
            ) : (
              <>
                <ShoppingCart size={20} /> Add to Cart
              </>
            )}
          </button>
          <button className="pd-cta-buynow" onClick={handleBuyNow} id="buy-now-btn">
            <Zap size={20} /> Buy Now
          </button>
        </div>

        <button
          className={`pd-wishlist-btn ${wishlisted ? "active" : ""}`}
          onClick={() => {
            setWishlisted((w) => !w);
            addToast({
              title: !wishlisted ? "Saved to Wishlist" : "Removed from Wishlist",
              message: `${product.name} ${!wishlisted ? "added to" : "removed from"} your favorites.`,
              type: !wishlisted ? "success" : "info",
            });
          }}
          id="wishlist-btn"
        >
          <Heart
            size={16}
            fill={wishlisted ? "#ef4444" : "none"}
            color={wishlisted ? "#ef4444" : "currentColor"}
          />
          {wishlisted ? "Saved to Wishlist" : "Add to Wishlist"}
        </button>
      </div>

      {/* ─────────── 5. OFFERS & BANK DEALS (stored) ─────────── */}
      {offerCount > 0 && (
        <div className="pd-card-block pd-offers-card">
          <div className="pd-offers-header">
            <div className="pd-offers-title-group">
              <Tag size={16} className="pd-icon-green" />
              <span className="pd-block-title">Available Offers &amp; Coupons</span>
              <span className="pd-offers-badge">{offerCount} Active</span>
            </div>
            <button className="pd-offers-viewall-btn" onClick={() => setOffersOpen((o) => !o)}>
              {offersOpen ? "Show Less" : "View All"}
              {offersOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>

          {/* Featured Offer Snippets (Visible by default) */}
          <div className="pd-offers-preview">
            {bankLead && (
              <div className="pd-offer-chip-item">
                <span className="pd-chip-tag">BANK</span>
                <span className="pd-chip-desc">
                  {[bankLead.bank, offerText(bankLead)].filter(Boolean).join(": ")}
                </span>
              </div>
            )}
            {couponLead && (
              <div className="pd-offer-chip-item">
                <span className="pd-chip-tag coupon">COUPON</span>
                <span className="pd-chip-desc">{offerText(couponLead) ?? couponLead.code}</span>
                {couponLead.code && <span className="pd-chip-code">{couponLead.code}</span>}
              </div>
            )}
          </div>

          {/* Expanded Full Offers Panel */}
          {offersOpen && (
            <div className="pd-offers-panel">
              {offers.bank.length > 0 && (
                <>
                  <div className="pd-offers-group-label">Bank Discounts</div>
                  {offers.bank.map((offer, index) => (
                    <div className="pd-offer-item" key={index}>
                      <CreditCard size={15} className="pd-offer-icon" />
                      <div className="pd-offer-content">
                        {offer.bank && <strong>{offer.bank}: </strong>}
                        {offerText(offer)}
                        {offer.code && (
                          <span className="pd-offer-code-badge">
                            Code: <strong>{offer.code}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {offers.coupon.length > 0 && (
                <>
                  <div className="pd-offers-group-label" style={{ marginTop: 14 }}>
                    Promo Coupons
                  </div>
                  {offers.coupon.map((offer, index) => (
                    <div className="pd-offer-item" key={index}>
                      <Tag size={15} className="pd-offer-icon" />
                      <div className="pd-offer-content">
                        <span>{offerText(offer)}</span>
                        {offer.code && (
                          <span className="pd-offer-code-badge">
                            Code: <strong>{offer.code}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────── 6. DELIVERY & WARRANTY (stored only) ─────────── */}
      {(hasDelivery || hasWarranty) && (
        <div className="pd-card-block pd-delivery-card">
          <div className="pd-block-header">
            <Truck size={16} className="pd-icon-accent" />
            <span className="pd-block-title">Delivery Options</span>
          </div>

          {hasDelivery && (
            <>
              <div className="pd-pincode-row">
                <MapPin size={15} className="pd-pincode-icon" />
                <input
                  className="pd-pincode-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit Pincode"
                  value={pincode}
                  onChange={(e) => {
                    setPincode(e.target.value.replace(/\D/g, ""));
                    setPincodeMsg(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && checkPincode()}
                />
                <button className="pd-pincode-btn" onClick={checkPincode}>
                  Check Availability
                </button>
              </div>
              {pincodeMsg && (
                <p className={`pd-pincode-msg ${pincodeMsg.ok ? "ok" : "err"}`}>
                  {pincodeMsg.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                  {pincodeMsg.msg}
                </p>
              )}
            </>
          )}

          <div className="pd-delivery-chips">
            {deliveryLines.map((line, index) => (
              <span className="pd-delivery-chip good" key={index}>
                {index === 0 ? <Truck size={13} /> : <RefreshCw size={13} />}
                {line}
              </span>
            ))}
            {hasWarranty && (
              <span className="pd-delivery-chip">
                <Shield size={13} /> {product.warranty}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Seller Info (stored vendor only) ── */}
      {seller?.name && (
        <div className="pd-seller-card">
          <Store size={16} className="pd-seller-icon" />
          <div className="pd-seller-details">
            <div className="pd-seller-line">
              <span className="pd-seller-label">Seller: </span>
              <a href="#info" className="pd-seller-name">
                {seller.name}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
