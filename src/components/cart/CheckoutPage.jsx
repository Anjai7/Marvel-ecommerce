import { useMemo, useState } from "react";
import { ChevronLeft, Lock, Tag, Check, ShoppingBag } from "lucide-react";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { Button, Input, useToast } from "../ui";
import { navigateToPath } from "../../lib/routes";
import { apiCreateOrder, apiValidateCoupon, apiRedeemCoupon } from "../../api/backendApi";
import { formatCurrency } from "../../lib/currency";

/**
 * A mock checkout.
 *
 * There is no payment provider yet. This screen collects a delivery address,
 * applies a coupon and a shipping choice, creates a real order through the
 * API, clears the cart and shows a confirmation. No card details are asked
 * for and no money moves — the order is the hand-off point for a payment
 * integration later.
 */

const SHIPPING = [
  { id: "standard", label: "Standard delivery", detail: "3–6 business days", fee: 0 },
  { id: "express", label: "Express delivery", detail: "1–2 business days", fee: 99 },
];

const EMPTY_ADDRESS = { fullName: "", phone: "", line: "", city: "", state: "", pincode: "" };

export default function CheckoutPage() {
  const { items, subtotal, savings, clearCart } = useCart();
  const { user, isLoggedIn } = useAuth();
  const { addToast } = useToast();

  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [shippingId, setShippingId] = useState("standard");
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState(null);
  const [couponMessage, setCouponMessage] = useState("");
  const [errors, setErrors] = useState({});
  const [placing, setPlacing] = useState(false);

  const shipping = SHIPPING.find((option) => option.id === shippingId) ?? SHIPPING[0];
  const discount = coupon?.discount ?? 0;
  const total = Math.max(0, subtotal - discount + shipping.fee);

  const setField = (key) => (event) => {
    const value = event.target.value;
    setAddress((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const applyCoupon = async () => {
    const value = code.trim();
    if (!value) return;
    setCouponMessage("");
    try {
      const result = await apiValidateCoupon({ code: value, subtotal });
      if (!result?.valid) {
        setCoupon(null);
        setCouponMessage(result?.reason ?? "That code could not be applied.");
        return;
      }
      setCoupon(result);
      setCouponMessage("");
      addToast({
        title: "Coupon applied",
        message: `${result.code} is on this order.`,
        type: "success",
      });
    } catch {
      setCoupon(null);
      setCouponMessage("Coupons are not available right now.");
    }
  };

  const validate = () => {
    const next = {};
    if (!address.fullName.trim()) next.fullName = "Enter the recipient's name.";
    if (!/^\d{10}$/.test(address.phone.replace(/\D/g, "")))
      next.phone = "Enter a 10-digit phone number.";
    if (!address.line.trim()) next.line = "Enter the street address.";
    if (!address.city.trim()) next.city = "Enter the city.";
    if (!address.state.trim()) next.state = "Enter the state.";
    if (!/^\d{6}$/.test(address.pincode.trim())) next.pincode = "Enter a 6-digit PIN code.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const placeOrder = async () => {
    if (items.length === 0 || !validate()) return;
    setPlacing(true);
    try {
      const order = await apiCreateOrder({
        userId: user?.id ?? null,
        customerName: address.fullName.trim(),
        customerEmail: user?.email ?? "guest@marvel.com",
        items,
        totalAmount: total,
        shippingAddress: `${address.line.trim()}, ${address.city.trim()}, ${address.state.trim()} ${address.pincode.trim()}`,
      });

      if (coupon?.code) {
        // Best effort: an order must not fail because the coupon counter did
        // not update. The discount is already in the total that was saved.
        apiRedeemCoupon({ code: coupon.code }).catch(() => {});
      }

      clearCart();
      sessionStorage.setItem(
        `marvel_last_order_${order.id}`,
        JSON.stringify({ discount, shippingFee: shipping.fee, coupon: coupon?.code ?? null })
      );
      addToast({ title: "Order placed", message: "Your order is confirmed.", type: "success" });
      navigateToPath(`/order/${order.id}`);
    } catch (err) {
      addToast({
        title: "Could not place the order",
        message: err?.message ?? "Please try again.",
        type: "error",
      });
    } finally {
      setPlacing(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="checkout-page">
        <div className="checkout-empty">
          <ShoppingBag size={40} aria-hidden="true" />
          <h1>Sign in to check out</h1>
          <p>Your cart belongs to your account, so sign in first to place an order.</p>
          <Button onClick={() => navigateToPath("/login")}>Sign in</Button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="checkout-page">
        <div className="checkout-empty">
          <ShoppingBag size={40} aria-hidden="true" />
          <h1>Your cart is empty</h1>
          <p>Add something to your cart before checking out.</p>
          <Button onClick={() => navigateToPath("/products")}>Browse products</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <div className="container checkout-inner">
        <button className="checkout-back" onClick={() => navigateToPath("/cart")}>
          <ChevronLeft size={16} /> Back to cart
        </button>

        <div className="checkout-heading">
          <h1>Checkout</h1>
          <p>No payment is taken here yet — this is a mock checkout that creates a real order.</p>
        </div>

        <div className="checkout-grid">
          <div className="checkout-main">
            <section className="checkout-card" aria-labelledby="checkout-address-title">
              <h2 id="checkout-address-title">Delivery address</h2>
              <div className="checkout-fields">
                <label className="checkout-field checkout-field--wide">
                  <span>Full name *</span>
                  <Input
                    value={address.fullName}
                    onChange={setField("fullName")}
                    autoComplete="name"
                  />
                  {errors.fullName && <small role="alert">{errors.fullName}</small>}
                </label>
                <label className="checkout-field checkout-field--wide">
                  <span>Phone number *</span>
                  <Input
                    value={address.phone}
                    onChange={setField("phone")}
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="10-digit mobile number"
                  />
                  {errors.phone && <small role="alert">{errors.phone}</small>}
                </label>
                <label className="checkout-field checkout-field--wide">
                  <span>Street address *</span>
                  <Input
                    value={address.line}
                    onChange={setField("line")}
                    autoComplete="street-address"
                  />
                  {errors.line && <small role="alert">{errors.line}</small>}
                </label>
                <label className="checkout-field">
                  <span>City *</span>
                  <Input
                    value={address.city}
                    onChange={setField("city")}
                    autoComplete="address-level2"
                  />
                  {errors.city && <small role="alert">{errors.city}</small>}
                </label>
                <label className="checkout-field">
                  <span>State *</span>
                  <Input
                    value={address.state}
                    onChange={setField("state")}
                    autoComplete="address-level1"
                  />
                  {errors.state && <small role="alert">{errors.state}</small>}
                </label>
                <label className="checkout-field">
                  <span>PIN code *</span>
                  <Input
                    value={address.pincode}
                    onChange={setField("pincode")}
                    inputMode="numeric"
                    autoComplete="postal-code"
                    placeholder="6-digit PIN"
                  />
                  {errors.pincode && <small role="alert">{errors.pincode}</small>}
                </label>
              </div>
            </section>

            <section className="checkout-card" aria-labelledby="checkout-shipping-title">
              <h2 id="checkout-shipping-title">Delivery speed</h2>
              <div className="checkout-shipping-options">
                {SHIPPING.map((option) => (
                  <label
                    key={option.id}
                    className={`checkout-shipping-option ${
                      shippingId === option.id ? "is-selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="shipping"
                      value={option.id}
                      checked={shippingId === option.id}
                      onChange={() => setShippingId(option.id)}
                    />
                    <span className="checkout-shipping-label">
                      <strong>{option.label}</strong>
                      <small>{option.detail}</small>
                    </span>
                    <span className="checkout-shipping-fee">
                      {option.fee === 0 ? "FREE" : formatCurrency(option.fee)}
                    </span>
                  </label>
                ))}
              </div>
            </section>
          </div>

          <aside className="checkout-summary" aria-labelledby="checkout-summary-title">
            <h2 id="checkout-summary-title">Order summary</h2>

            <div className="checkout-coupon">
              <label htmlFor="checkout-coupon-code">Have a coupon?</label>
              <div className="checkout-coupon-row">
                <Tag size={16} aria-hidden="true" />
                <input
                  id="checkout-coupon-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && applyCoupon()}
                  placeholder="Enter code"
                />
                <button type="button" onClick={applyCoupon} disabled={!code.trim()}>
                  Apply
                </button>
              </div>
              {couponMessage && (
                <p className="checkout-coupon-message" role="status">
                  {couponMessage}
                </p>
              )}
              {coupon?.valid && (
                <p className="checkout-coupon-applied">
                  <Check size={14} aria-hidden="true" /> {coupon.code} applied
                  <button
                    type="button"
                    onClick={() => {
                      setCoupon(null);
                      setCode("");
                    }}
                  >
                    Remove
                  </button>
                </p>
              )}
            </div>

            <ul className="checkout-items">
              {items.map((item) => (
                <li key={item.lineId ?? item.id}>
                  <span className="checkout-item-title">{item.title}</span>
                  <span className="checkout-item-qty">× {item.quantity}</span>
                  <span className="checkout-item-price">
                    {formatCurrency((Number(item.price) || 0) * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="checkout-totals">
              <div>
                <dt>Subtotal</dt>
                <dd>{formatCurrency(subtotal)}</dd>
              </div>
              {savings > 0 && (
                <div className="checkout-savings">
                  <dt>Product savings</dt>
                  <dd>−{formatCurrency(savings)}</dd>
                </div>
              )}
              {discount > 0 && (
                <div className="checkout-savings">
                  <dt>Coupon ({coupon.code})</dt>
                  <dd>−{formatCurrency(discount)}</dd>
                </div>
              )}
              <div>
                <dt>Delivery</dt>
                <dd>{shipping.fee === 0 ? "FREE" : formatCurrency(shipping.fee)}</dd>
              </div>
              <div className="checkout-total">
                <dt>To pay</dt>
                <dd>{formatCurrency(total)}</dd>
              </div>
            </dl>

            <Button onClick={placeOrder} disabled={placing} className="checkout-place-order">
              <Lock size={15} aria-hidden="true" />
              {placing ? "Placing order…" : "Place order (mock)"}
            </Button>
            <p className="checkout-note">
              Mock checkout: no card is charged. A real order is created and appears in your orders.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
