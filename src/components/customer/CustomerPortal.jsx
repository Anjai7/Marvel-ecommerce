import { useState, useEffect, useCallback } from "react";
import {
  Package,
  Heart,
  User,
  MapPin,
  CheckCircle2,
  Truck,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import {
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  useToast,
} from "../ui";
import CustomerWishlistTab from "./CustomerWishlistTab";
import CustomerProfileTab from "./CustomerProfileTab";
import { apiFetchOrders } from "../../api/backendApi";
import { apiFetchWishlist, apiAddToWishlist, apiRemoveFromWishlist } from "../../api/wishlistApi";
import { useCart } from "../../context/CartContext";
import { formatCurrency } from "../../lib/currency";
import "./customer-portal.css";

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

/**
 * The customer's choice for one item as a readable line: "Colour: Blue · Size: M".
 *
 * Older orders carry no options at all and a stored option may be missing its
 * label, so the array is read defensively and "" is returned whenever there is
 * nothing worth showing — the caller then leaves the cell exactly as it was.
 */
function formatOptions(options) {
  if (!Array.isArray(options)) return "";
  const parts = [];
  for (const option of options) {
    if (!option || typeof option !== "object") continue;
    const kind = typeof option.kind === "string" ? option.kind.trim().toLowerCase() : "";
    const kindLabel = OPTION_KIND_LABELS[kind];
    // The label is what the customer reads; the value is the machine value (a
    // hex for a colour), so it only stands in when there is no label and it
    // reads like a word.
    const text = [option.label, option.value]
      .map((candidate) => (typeof candidate === "string" ? candidate.trim() : ""))
      .find((candidate) => candidate && !candidate.startsWith("#"));
    if (!text) continue;
    parts.push(kindLabel ? `${kindLabel}: ${text}` : text);
  }
  return parts.join(" · ");
}

export default function CustomerPortal({ currentUser, onNavigateHome, onSelectProduct }) {
  const [activeTab, setActiveTab] = useState("orders"); // orders, wishlist, profile
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const { addToast } = useToast();
  const { addItem } = useCart();

  // The wishlist is the user's stored rows, never a demo list.
  const [wishlist, setWishlist] = useState([]);
  const [wishlistLoading, setWishlistLoading] = useState(true);
  const [wishlistError, setWishlistError] = useState(null);

  const loadWishlist = useCallback(async () => {
    setWishlistLoading(true);
    try {
      const data = await apiFetchWishlist();
      setWishlist(Array.isArray(data?.items) ? data.items : []);
      setWishlistError(null);
    } catch (e) {
      setWishlist([]);
      setWishlistError(
        e instanceof Error && e.message ? e.message : "Could not load your wishlist."
      );
    } finally {
      setWishlistLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentUser?.id) {
      setWishlist([]);
      setWishlistLoading(false);
      return;
    }
    loadWishlist();
  }, [currentUser, loadWishlist]);

  useEffect(() => {
    loadOrders();
  }, [currentUser]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await apiFetchOrders({ userId: currentUser?.id, role: "user" });
      setOrders(data);
      if (data.length > 0) setSelectedOrder(data[0]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getStatusStep = (status) => {
    switch (status) {
      case "processing":
        return 1;
      case "shipped":
        return 2;
      case "delivered":
        return 3;
      default:
        return 0;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "delivered":
        return (
          <span className="customer-status-badge customer-status-badge--delivered">Delivered</span>
        );
      case "shipped":
        return (
          <span className="customer-status-badge customer-status-badge--shipped">
            In Transit (Shipped)
          </span>
        );
      case "processing":
        return (
          <span className="customer-status-badge customer-status-badge--processing">
            Processing Order
          </span>
        );
      default:
        return (
          <span className="customer-status-badge customer-status-badge--default">{status}</span>
        );
    }
  };

  const handleRemoveWishlist = async (productId, title) => {
    if (!productId) return;
    try {
      await apiRemoveFromWishlist(productId);
      setWishlist((previous) => previous.filter((item) => item.product_id !== productId));
      addToast({ title: "Removed from Wishlist", message: title, type: "info" });
    } catch {
      addToast({
        title: "Could not remove",
        message: "The wishlist could not be updated. Please try again.",
        type: "error",
      });
    }
  };

  const handleAddWishlist = async (productId, title) => {
    if (!productId) return;
    try {
      await apiAddToWishlist(productId);
      await loadWishlist();
      addToast({ title: "Saved to Wishlist", message: title, type: "success" });
    } catch {
      addToast({
        title: "Could not save",
        message: "The wishlist could not be updated. Please try again.",
        type: "error",
      });
    }
  };

  // A row without its joined product cannot be rendered honestly; the empty
  // state describes the visible list rather than a blank grid.
  const savedWishlist = wishlist.filter((entry) => entry?.product);

  return (
    <div className="customer-portal">
      <div className="container customer-portal__inner">
        {/* Top Breadcrumb & User Bar */}
        <div className="customer-welcome">
          <div className="customer-welcome__identity">
            <div className="customer-welcome__avatar">
              {currentUser?.full_name ? currentUser.full_name[0].toUpperCase() : "U"}
            </div>
            <div>
              <h2 className="customer-welcome__title">
                Welcome back, {currentUser?.full_name || "Valued Customer"}
              </h2>
              <div className="customer-welcome__meta">
                <span>{currentUser?.email || "user@marvel.com"}</span>
                <span>•</span>
                <span className="customer-welcome__member">Prime Customer Member</span>
              </div>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={onNavigateHome}
            leftIcon={<ArrowLeft size={16} />}
            className="customer-welcome__back"
          >
            Back to Marketplace Store
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="customer-tabs">
          <button
            onClick={() => setActiveTab("orders")}
            className={`customer-tab${activeTab === "orders" ? " customer-tab--active" : ""}`}
          >
            <Package size={18} /> My Orders &amp; Deliveries ({orders.length})
          </button>

          <button
            onClick={() => setActiveTab("wishlist")}
            className={`customer-tab${activeTab === "wishlist" ? " customer-tab--active" : ""}`}
          >
            <Heart size={18} /> Saved Wishlist ({savedWishlist.length})
          </button>

          <button
            onClick={() => setActiveTab("profile")}
            className={`customer-tab${activeTab === "profile" ? " customer-tab--active" : ""}`}
          >
            <User size={18} /> Account Settings &amp; Addresses
          </button>
        </div>

        {/* TAB 1: ORDERS & TRACKING */}
        {activeTab === "orders" && (
          <div className="customer-orders">
            {/* Orders List */}
            <div className="table-responsive-wrapper">
              <Table className="ui-table--cards">
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Order</TableHead>
                    <TableHead scope="col">Date</TableHead>
                    <TableHead scope="col">Status</TableHead>
                    <TableHead scope="col">Items</TableHead>
                    <TableHead scope="col" className="text-right">
                      Total
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Tracking
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((ord) => {
                    const isSelected = selectedOrder?.id === ord.id;
                    return (
                      <TableRow
                        key={ord.id}
                        onClick={() => setSelectedOrder(ord)}
                        data-selected={isSelected}
                        className="customer-order-row"
                      >
                        <TableCell>
                          <div className="customer-order-card__title">
                            Order #{ord.id.toUpperCase()}
                          </div>
                        </TableCell>
                        <TableCell data-label="Date">
                          <div className="customer-order-card__date">
                            Placed on{" "}
                            {new Date(ord.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
                        </TableCell>
                        <TableCell data-label="Status">{getStatusBadge(ord.status)}</TableCell>
                        <TableCell data-label="Items">
                          <div className="customer-order-items">
                            {ord.items?.map((item, i) => {
                              const optionsText = formatOptions(item?.options);
                              const sku = typeof item?.sku === "string" ? item.sku.trim() : "";
                              return (
                                <div key={i} className="customer-order-item">
                                  <img
                                    className="customer-order-item__thumb"
                                    src={
                                      item.image ||
                                      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100"
                                    }
                                    alt={item.title}
                                  />
                                  <div>
                                    <div className="customer-order-item__title">{item.title}</div>
                                    {optionsText && (
                                      <div className="customer-order-item__options">
                                        {[optionsText, sku ? `SKU: ${sku}` : ""]
                                          .filter(Boolean)
                                          .join(" · ")}
                                      </div>
                                    )}
                                    <div className="customer-order-item__meta">
                                      Qty: {item.quantity} • {formatCurrency(item.price)}
                                    </div>
                                  </div>
                                  {item.product_id && (
                                    <button
                                      type="button"
                                      aria-label={`Save ${item.title} to wishlist`}
                                      title="Save to wishlist"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddWishlist(item.product_id, item.title);
                                      }}
                                      className="customer-wishlist-button"
                                    >
                                      <Heart size={16} />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell data-label="Total" className="text-right">
                          <span className="customer-order-footer__total">
                            Total:{" "}
                            <strong className="customer-order-footer__amount">
                              {formatCurrency(ord.total_amount)}
                            </strong>
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="customer-order-footer__link">
                            View Tracking Details <ChevronRight size={14} />
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Selected Order Detailed Live Tracker */}
            {selectedOrder && (
              <div className="customer-tracker">
                <div className="customer-tracker__header">
                  <div>
                    <span className="customer-tracker__eyebrow">Package Tracking</span>
                    <h3 className="customer-tracker__title">
                      Order #{selectedOrder.id.toUpperCase()}
                    </h3>
                  </div>
                  {getStatusBadge(selectedOrder.status)}
                </div>

                {/* Progress Step Bar */}
                <div className="customer-tracker__steps">
                  <div className="customer-tracker__steps-row">
                    {["Order Confirmed", "Processing", "Shipped", "Delivered"].map((step, idx) => {
                      const currentStep = getStatusStep(selectedOrder.status);
                      const isComplete = idx <= currentStep;
                      return (
                        <div key={step} className="customer-tracker__step">
                          <div
                            className={`customer-tracker__step-dot${
                              isComplete ? " customer-tracker__step-dot--done" : ""
                            }`}
                          >
                            {isComplete ? <CheckCircle2 size={16} /> : idx + 1}
                          </div>
                          <span
                            className={`customer-tracker__step-label${
                              isComplete ? " customer-tracker__step-label--done" : ""
                            }`}
                          >
                            {step}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Courier & Tracking Details */}
                <div className="customer-tracker__details">
                  <div className="customer-tracker__detail">
                    <div className="customer-tracker__detail-label">Carrier</div>
                    <div className="customer-tracker__detail-value">
                      <Truck size={14} color="#2563eb" />{" "}
                      {selectedOrder.carrier || "Express Courier"}
                    </div>
                  </div>

                  <div className="customer-tracker__detail">
                    <div className="customer-tracker__detail-label">Tracking Number</div>
                    <div className="customer-tracker__detail-value customer-tracker__detail-value--accent">
                      {selectedOrder.tracking_number || "TRK-9849201"}
                    </div>
                  </div>
                </div>

                {/* Delivery Location */}
                <div className="customer-tracker__address">
                  <div className="customer-tracker__address-label">
                    <MapPin size={12} /> Shipping Address
                  </div>
                  <div className="customer-tracker__address-value">
                    {selectedOrder.shipping_address}
                  </div>
                </div>

                <div className="customer-tracker__actions">
                  <Button
                    variant="primary"
                    className="customer-button--grow"
                    onClick={() =>
                      addToast({
                        title: "Order Receipt",
                        message: "Receipt sent to your email",
                        type: "success",
                      })
                    }
                  >
                    Download Invoice PDF
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      addToast({
                        title: "Support Requested",
                        message: "Support ticket opened for order",
                        type: "info",
                      })
                    }
                  >
                    Need Help?
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: WISHLIST (GET /api/account/wishlist) */}
        {activeTab === "wishlist" && (
          <CustomerWishlistTab
            wishlistLoading={wishlistLoading}
            wishlistError={wishlistError}
            savedWishlist={savedWishlist}
            onNavigateHome={onNavigateHome}
            onAddToCart={(product, title) => {
              addItem(product, 1);
              addToast({ title: "Moved to Cart", message: title, type: "success" });
            }}
            onRemoveWishlist={handleRemoveWishlist}
          />
        )}

        {/* TAB 3: PROFILE & ADDRESSES */}
        {activeTab === "profile" && <CustomerProfileTab currentUser={currentUser} />}
      </div>
    </div>
  );
}
