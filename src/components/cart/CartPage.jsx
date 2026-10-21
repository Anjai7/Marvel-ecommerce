import React from "react";
import { ShoppingBag, Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "../../context/CartContext.jsx";
import { Button, Badge, useToast } from "../ui";
import { formatCurrency } from "../../lib/currency";
import "./cart.css";

const FALLBACK_BANNER_IMG =
  "https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?w=400&h=300&fit=crop";

export function CartPage({ onNavigateHome, onCheckout }) {
  const { items, cartCount, subtotal, savings, total, removeItem, updateQuantity } = useCart();
  const { addToast } = useToast();

  const bannerImg =
    items && items.length > 0 && items[0]?.image ? items[0].image : FALLBACK_BANNER_IMG;

  const handleCheckout = () => {
    if (onCheckout) {
      onCheckout();
      return;
    }
    addToast({
      title: "Checkout",
      message: "Checkout is coming soon",
      type: "info",
    });
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
            Items in your cart qualify for FREE Express Shipping!
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
              return (
                <li key={item.id} className="cart-item">
                  <img
                    src={item.image}
                    alt={title}
                    className="cart-item-img"
                    style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8 }}
                  />
                  <div className="cart-item-info">
                    <h3 className="cart-item-title">{title}</h3>
                    {item.category && <div className="cart-item-category">{item.category}</div>}
                    <div className="cart-item-price">{formatCurrency(item.price)}</div>
                  </div>
                  <div className="cart-qty">
                    <button
                      type="button"
                      aria-label={`Decrease quantity for ${title}`}
                      onClick={() => updateQuantity(item.id, qty - 1)}
                    >
                      <Minus size={14} />
                    </button>
                    <span aria-label={`Quantity for ${title}`}>{qty}</span>
                    <button
                      type="button"
                      aria-label={`Increase quantity for ${title}`}
                      onClick={() => updateQuantity(item.id, qty + 1)}
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
                    onClick={() => removeItem(item.id)}
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
              <span>FREE</span>
            </div>
            <div className="cart-summary-row cart-total" aria-live="polite">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <div className="cart-summary-actions">
              <Button variant="secondary" onClick={onNavigateHome}>
                Continue Shopping
              </Button>
              <Button variant="accent" onClick={handleCheckout}>
                Proceed to Checkout
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CartPage;
