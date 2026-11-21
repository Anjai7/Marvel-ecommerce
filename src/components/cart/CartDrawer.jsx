import { useEffect, useRef } from "react";
import { ArrowRight, Lock, ShoppingBag, X } from "lucide-react";
import { Button } from "../ui";
import { formatCurrency } from "../../lib/currency";

/**
 * The cart as a slide-over panel from the right of the storefront.
 *
 * It is deliberately a drawer rather than the old popover: the order summary
 * needs room for the lines, the totals and the checkout action, and the panel
 * must be dismissible without leaving the page. A guest can open it and see
 * the local cart; only checkout asks them to sign in.
 */
export default function CartDrawer({
  open,
  onClose,
  items = [],
  cartCount = 0,
  subtotal = 0,
  savings = 0,
  onViewCart,
  onCheckout,
  isLoggedIn,
}) {
  const closeRef = useRef(null);

  // Focus the close button and let Escape dismiss the panel. Focus returns to
  // whatever opened it when the drawer closes.
  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open, onClose]);

  return (
    <div className={`cart-drawer-root${open ? " is-open" : ""}`} aria-hidden={!open}>
      <div className="cart-drawer-overlay" onClick={onClose} />
      <aside
        className="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
      >
        <div className="cart-drawer-head">
          <div>
            <h2 id="cart-drawer-title">Your cart</h2>
            <span className="cart-drawer-count">{cartCount} items</span>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="cart-drawer-close"
            onClick={onClose}
            aria-label="Close cart"
          >
            <X size={20} />
          </button>
        </div>

        <div className="cart-drawer-body">
          {items.length === 0 ? (
            <div className="cart-drawer-empty">
              <ShoppingBag size={34} aria-hidden="true" />
              <p>Your cart is empty.</p>
              <span>Add something you like and it will show up here.</span>
            </div>
          ) : (
            <ul className="cart-drawer-items">
              {items.map((item) => (
                <li
                  key={item.lineId ?? `${item.id}-${item.combination_id ?? ""}`}
                  className="cart-drawer-item"
                >
                  <img src={item.image} alt="" className="cart-drawer-item-img" />
                  <div className="cart-drawer-item-text">
                    <span className="cart-drawer-item-title">{item.title}</span>
                    <span className="cart-drawer-item-meta">
                      Qty {item.quantity} ·{" "}
                      {formatCurrency((Number(item.price) || 0) * item.quantity)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="cart-drawer-summary">
            <h3>Order summary</h3>
            <dl>
              <div>
                <dt>Subtotal</dt>
                <dd>{formatCurrency(subtotal)}</dd>
              </div>
              {savings > 0 && (
                <div className="cart-drawer-savings">
                  <dt>Product savings</dt>
                  <dd>−{formatCurrency(savings)}</dd>
                </div>
              )}
              <div>
                <dt>Delivery</dt>
                <dd>Calculated at checkout</dd>
              </div>
              <div className="cart-drawer-total">
                <dt>Subtotal</dt>
                <dd>{formatCurrency(subtotal)}</dd>
              </div>
            </dl>
            <Button variant="outline" className="cart-drawer-view" onClick={onViewCart}>
              View cart <ArrowRight size={15} aria-hidden="true" />
            </Button>
            <Button variant="accent" className="cart-drawer-checkout" onClick={onCheckout}>
              <Lock size={15} aria-hidden="true" />
              {isLoggedIn ? "Proceed to checkout" : "Sign in to checkout"}
            </Button>
          </div>
        )}
      </aside>
    </div>
  );
}
