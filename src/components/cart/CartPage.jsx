import React, { useState } from "react";
import {
  ShoppingBag,
  Minus,
  Plus,
  Trash2,
  Lock,
  ShieldCheck,
  Truck,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useCart } from "../../context/CartContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { Button, Badge, useToast } from "../ui";
import { formatCurrency } from "../../lib/currency";
import { formatOptionChoices } from "../../lib/productOptions";
import { apiCreateOrder } from "../../api/backendApi";
import { navigateToPath } from "../../lib/routes";

const FALLBACK_BANNER_IMG =
  "https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?w=400&h=300&fit=crop";

export function CartPage({ onNavigateHome, onCheckout, onNavigateAccount }) {
  const { items, cartCount, subtotal, savings, total, removeItem, updateQuantity, clearCart } =
    useCart();
  const { addToast } = useToast();
  const [checkingOut, setCheckingOut] = useState(false);

  let auth = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    auth = useAuth();
  } catch {
    auth = null;
  }
  const user = auth?.user ?? null;
  const isLoggedIn = auth?.isLoggedIn ?? false;

  const bannerImg =
    items && items.length > 0 && items[0]?.image ? items[0].image : FALLBACK_BANNER_IMG;

  const handleCheckout = async () => {
    if (!isLoggedIn) {
      addToast({
        title: "Sign In Required",
        message: "Please sign in to complete your checkout and track your order.",
        type: "info",
      });
      if (onCheckout) {
        onCheckout();
      } else {
        navigateToPath("/login");
      }
      return;
    }

    if (!items || items.length === 0) {
      addToast({
        title: "Cart is empty",
        message: "Please add products to your cart before proceeding.",
        type: "warning",
      });
      return;
    }

    setCheckingOut(true);
    try {
      const orderPayload = {
        userId: user?.id || null,
        customerName: user?.full_name || user?.name || user?.email?.split("@")[0] || "Customer",
        customerEmail: user?.email || "customer@marvel.com",
        vendorId: items[0]?.vendor_id || null,
        items: items.map((item) => ({
          id: item.id,
          title: item.title,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
          sku: item.sku,
          options: item.options,
        })),
        totalAmount: total,
        shippingAddress: user?.address || "742 Evergreen Terrace, Springfield, OR",
      };

      const placed = await apiCreateOrder(orderPayload);
      clearCart();
      addToast({
        title: "Order Placed Successfully!",
        message: `Your order #${placed?.id ? String(placed.id).slice(-8).toUpperCase() : ""} has been confirmed!`,
        type: "success",
      });
      if (onNavigateAccount) {
        onNavigateAccount();
      } else {
        navigateToPath("/account");
      }
    } catch (err) {
      addToast({
        title: "Checkout Error",
        message: err?.message || "Failed to place order. Please try again.",
        type: "error",
      });
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="container cart-page">
      {/* Unified banner: image + text as one unit */}
      <div className="cart-banner">
        <img src={bannerImg} alt="Shopping cart banner" className="cart-banner-img" />
        <div className="cart-banner-text">
          <h1>Your Cart</h1>
          <div aria-live="polite">
            <Badge variant="secondary">{cartCount} items</Badge>
          </div>
          <p className="cart-banner-subtitle">
            <Sparkles size={14} className="cart-banner-sparkle-icon" /> Items in your cart qualify
            for FREE Express Shipping!
          </p>
        </div>
      </div>

      {!items || items.length === 0 ? (
        <div className="cart-empty">
          <ShoppingBag size={48} aria-hidden="true" />
          <h2>Your cart is empty</h2>
          <Button variant="accent" onClick={onNavigateHome}>
            Continue Shopping
          </Button>
        </div>
      ) : (
        <div className="cart-content">
          <ul className="cart-items">
            {items.map((item) => {
              const title = item?.title || "Product";
              const qty = item?.quantity || 1;
              const lineTotal = Number(item?.price || 0) * qty;
              // A line is identified by the item and the combination it was bought as.
              const lineId = item.lineId ?? `${item.id}::${item.combination_id ?? ""}`;
              const choice = formatOptionChoices(item.options);
              return (
                <li key={lineId} className="cart-item">
                  <img src={item.image} alt={title} className="cart-item-img" />
                  <div className="cart-item-info">
                    <h3 className="cart-item-title">{title}</h3>
                    {choice && <div className="cart-item-options">{choice}</div>}
                    {item.sku && <div className="cart-item-sku">SKU: {item.sku}</div>}
                    {item.category && <div className="cart-item-category">{item.category}</div>}
                    <div className="cart-item-price">{formatCurrency(item.price)}</div>
                  </div>
                  <div className="cart-qty">
                    <button
                      type="button"
                      aria-label={`Decrease quantity for ${title}`}
                      onClick={() => updateQuantity(lineId, qty - 1)}
                    >
                      <Minus size={14} />
                    </button>
                    <span aria-label={`Quantity for ${title}`}>{qty}</span>
                    <button
                      type="button"
                      aria-label={`Increase quantity for ${title}`}
                      onClick={() => updateQuantity(lineId, qty + 1)}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="cart-item-total" aria-live="polite">
                    {formatCurrency(lineTotal)}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => removeItem(lineId)}
                    aria-label={`Remove ${title} from cart`}
                  >
                    <Trash2 size={14} /> Remove
                  </Button>
                </li>
              );
            })}
          </ul>

          <div className="cart-summary">
            <h2>Order Summary</h2>
            <div className="cart-summary-row">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {savings > 0 && (
              <div className="cart-summary-row cart-savings">
                <span>Savings</span>
                <span>−{formatCurrency(savings)}</span>
              </div>
            )}
            <div className="cart-summary-row">
              <span>Shipping</span>
              <span className="cart-free-shipping-tag">FREE</span>
            </div>
            <div className="cart-summary-row cart-total" aria-live="polite">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <p className="cart-tax-note">Inclusive of all taxes & free express delivery</p>

            {!isLoggedIn && (
              <div className="cart-guest-warning">
                <p className="cart-guest-warning-text">
                  Please <strong>sign in</strong> or <strong>create an account</strong> to save your
                  cart and proceed to checkout.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="cart-guest-signin-btn"
                  onClick={() => {
                    if (onCheckout) onCheckout();
                    else navigateToPath("/login");
                  }}
                >
                  Sign In / Sign Up
                </Button>
              </div>
            )}

            <div className="cart-summary-actions">
              <Button
                variant="accent"
                className="cart-checkout-btn"
                disabled={checkingOut}
                onClick={handleCheckout}
              >
                {checkingOut ? (
                  "Placing Order..."
                ) : (
                  <>
                    <Lock size={15} /> Proceed to Checkout
                  </>
                )}
              </Button>
              <Button variant="secondary" onClick={onNavigateHome}>
                Continue Shopping
              </Button>
            </div>

            <div className="cart-trust-badges">
              <div className="cart-trust-item">
                <ShieldCheck size={16} />
                <span>100% Secure Checkout</span>
              </div>
              <div className="cart-trust-item">
                <Truck size={16} />
                <span>Fast Express Delivery</span>
              </div>
              <div className="cart-trust-item">
                <RotateCcw size={16} />
                <span>Easy 7-Day Returns</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CartPage;
