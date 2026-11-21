import { useEffect, useState } from "react";
import { Check, Package, ShoppingBag } from "lucide-react";
import { Button } from "../ui";
import { navigateToPath } from "../../lib/routes";
import { formatCurrency } from "../../lib/currency";
import { apiFetchOrderById } from "../../api/backendApi";

/**
 * The order confirmation shown after the mock checkout.
 *
 * The order itself is real — it was written by POST /api/orders. The small
 * price breakdown is kept in session storage by the checkout, because the
 * order table stores the final total but not the coupon and delivery split
 * yet. If it is missing (a reload in a new tab, for example), the page shows
 * just the stored total and never invents the missing lines.
 */
export default function OrderConfirmationPage({ orderId }) {
  const order = useOrder(orderId);
  const breakdown = useStoredBreakdown(orderId);

  if (!order) {
    return (
      <div className="checkout-page">
        <div className="checkout-empty">
          <Package size={40} aria-hidden="true" />
          <h1>Order not found</h1>
          <p>We could not load that order. It may still be processing.</p>
          <Button onClick={() => navigateToPath("/account")}>See your orders</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <div className="container checkout-confirmation">
        <span className="checkout-confirmation-icon" aria-hidden="true">
          <Check size={30} />
        </span>
        <h1>Order confirmed</h1>
        <p className="checkout-confirmation-sub">
          Thank you — your order <strong>#{order.id}</strong> has been placed. You can follow it
          from your orders.
        </p>

        <div className="checkout-confirmation-card">
          <div className="checkout-confirmation-head">
            <span>Order #{order.id}</span>
            <span className="checkout-confirmation-status">{order.status}</span>
          </div>
          <ul>
            {(Array.isArray(order.items) ? order.items : []).map((item, index) => (
              <li key={item.id ?? index}>
                <span>{item.title}</span>
                <span>× {item.quantity}</span>
                <span>
                  {formatCurrency((Number(item.price) || 0) * (Number(item.quantity) || 1))}
                </span>
              </li>
            ))}
          </ul>
          <dl>
            <div>
              <dt>Total paid on this order</dt>
              <dd>{formatCurrency(order.total_amount)}</dd>
            </div>
            {breakdown?.discount > 0 && (
              <div>
                <dt>Coupon {breakdown.coupon}</dt>
                <dd>−{formatCurrency(breakdown.discount)}</dd>
              </div>
            )}
            {breakdown?.shippingFee > 0 && (
              <div>
                <dt>Delivery</dt>
                <dd>{formatCurrency(breakdown.shippingFee)}</dd>
              </div>
            )}
          </dl>
          <p className="checkout-confirmation-address">Delivering to {order.shipping_address}</p>
        </div>

        <div className="checkout-confirmation-actions">
          <Button variant="accent" onClick={() => navigateToPath("/account")}>
            Track this order
          </Button>
          <Button variant="outline" onClick={() => navigateToPath("/")}>
            <ShoppingBag size={15} aria-hidden="true" /> Continue shopping
          </Button>
        </div>
      </div>
    </div>
  );
}

/* The order is fetched once and kept only while this screen is open. */
function useOrder(orderId) {
  const [order, setOrder] = useState(null);
  useEffect(() => {
    if (!orderId) return undefined;
    let cancelled = false;
    apiFetchOrderById(orderId)
      .then((data) => !cancelled && setOrder(data))
      .catch(() => !cancelled && setOrder(null));
    return () => {
      cancelled = true;
    };
  }, [orderId]);
  return order;
}

function useStoredBreakdown(orderId) {
  const [breakdown, setBreakdown] = useState(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`marvel_last_order_${orderId}`);
      setBreakdown(raw ? JSON.parse(raw) : null);
    } catch {
      setBreakdown(null);
    }
  }, [orderId]);
  return breakdown;
}
