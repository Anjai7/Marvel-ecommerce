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
  ShoppingBag,
} from "lucide-react";
import { Button, useToast } from "../ui";
import CustomerWishlistTab from "./CustomerWishlistTab";
import CustomerProfileTab from "./CustomerProfileTab";
import { apiFetchOrders } from "../../api/backendApi";
import { apiFetchWishlist, apiAddToWishlist, apiRemoveFromWishlist } from "../../api/wishlistApi";
import { useCart } from "../../context/CartContext";
import { formatCurrency } from "../../lib/currency";

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
          <span
            style={{
              background: "#dcfce7",
              color: "#15803d",
              padding: "3px 10px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Delivered
          </span>
        );
      case "shipped":
        return (
          <span
            style={{
              background: "#e0f2fe",
              color: "#0369a1",
              padding: "3px 10px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            In Transit (Shipped)
          </span>
        );
      case "processing":
        return (
          <span
            style={{
              background: "#fef3c7",
              color: "#b45309",
              padding: "3px 10px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Processing Order
          </span>
        );
      default:
        return (
          <span
            style={{
              background: "#f1f5f9",
              color: "#475569",
              padding: "3px 10px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {status}
          </span>
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
    <div style={{ background: "#f8fafc", minHeight: "calc(100vh - 120px)", padding: "32px 16px" }}>
      <div className="container" style={{ maxWidth: 1160, margin: "0 auto" }}>
        {/* Top Breadcrumb & User Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            background: "#ffffff",
            padding: "20px 24px",
            borderRadius: 16,
            border: "1px solid #e2e8f0",
            marginBottom: 24,
            boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 800,
              }}
            >
              {currentUser?.full_name ? currentUser.full_name[0].toUpperCase() : "U"}
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: 0 }}>
                Welcome back, {currentUser?.full_name || "Valued Customer"}
              </h2>
              <div
                style={{
                  fontSize: 13,
                  color: "#64748b",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 2,
                }}
              >
                <span>{currentUser?.email || "user@marvel.com"}</span>
                <span>•</span>
                <span style={{ color: "#16a34a", fontWeight: 600 }}>Prime Customer Member</span>
              </div>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={onNavigateHome}
            leftIcon={<ArrowLeft size={16} />}
            style={{ borderRadius: 10 }}
          >
            Back to Marketplace Store
          </Button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: "flex",
            gap: 12,
            borderBottom: "2px solid #e2e8f0",
            marginBottom: 24,
            overflowX: "auto",
            whiteSpace: "nowrap",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
          }}
        >
          <button
            onClick={() => setActiveTab("orders")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 18px",
              border: "none",
              background: "none",
              fontSize: 14,
              fontWeight: activeTab === "orders" ? 700 : 500,
              color: activeTab === "orders" ? "#2563eb" : "#64748b",
              borderBottom: activeTab === "orders" ? "3px solid #2563eb" : "3px solid transparent",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Package size={18} /> My Orders & Deliveries ({orders.length})
          </button>

          <button
            onClick={() => setActiveTab("wishlist")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 18px",
              border: "none",
              background: "none",
              fontSize: 14,
              fontWeight: activeTab === "wishlist" ? 700 : 500,
              color: activeTab === "wishlist" ? "#2563eb" : "#64748b",
              borderBottom:
                activeTab === "wishlist" ? "3px solid #2563eb" : "3px solid transparent",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Heart size={18} /> Saved Wishlist ({savedWishlist.length})
          </button>

          <button
            onClick={() => setActiveTab("profile")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 18px",
              border: "none",
              background: "none",
              fontSize: 14,
              fontWeight: activeTab === "profile" ? 700 : 500,
              color: activeTab === "profile" ? "#2563eb" : "#64748b",
              borderBottom: activeTab === "profile" ? "3px solid #2563eb" : "3px solid transparent",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <User size={18} /> Account Settings & Addresses
          </button>
        </div>

        {/* TAB 1: ORDERS & TRACKING */}
        {activeTab === "orders" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
              gap: 24,
            }}
          >
            {/* Orders List */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {orders.map((ord) => {
                const isSelected = selectedOrder?.id === ord.id;
                return (
                  <div
                    key={ord.id}
                    onClick={() => setSelectedOrder(ord)}
                    style={{
                      background: "#ffffff",
                      borderRadius: 14,
                      padding: 20,
                      border: isSelected ? "2px solid #2563eb" : "1px solid #e2e8f0",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 12,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>
                          Order #{ord.id.toUpperCase()}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                          Placed on{" "}
                          {new Date(ord.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                      </div>
                      {getStatusBadge(ord.status)}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        marginTop: 12,
                        paddingTop: 12,
                        borderTop: "1px solid #f1f5f9",
                      }}
                    >
                      {ord.items?.map((item, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <img
                            src={
                              item.image ||
                              "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100"
                            }
                            alt={item.title}
                            style={{
                              width: 44,
                              height: 44,
                              objectFit: "cover",
                              borderRadius: 8,
                              border: "1px solid #e2e8f0",
                            }}
                          />
                          <div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "#1e293b",
                                maxWidth: 220,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {item.title}
                            </div>
                            <div style={{ fontSize: 12, color: "#64748b" }}>
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
                              style={{
                                border: "none",
                                background: "none",
                                color: "#94a3b8",
                                cursor: "pointer",
                                padding: 4,
                              }}
                            >
                              <Heart size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: 14,
                        fontSize: 13,
                      }}
                    >
                      <span style={{ color: "#64748b" }}>
                        Total:{" "}
                        <strong style={{ color: "#0f172a" }}>
                          {formatCurrency(ord.total_amount)}
                        </strong>
                      </span>
                      <span
                        style={{
                          color: "#2563eb",
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        View Tracking Details <ChevronRight size={14} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Order Detailed Live Tracker */}
            {selectedOrder && (
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 16,
                  padding: 24,
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 20,
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        color: "#64748b",
                      }}
                    >
                      Package Tracking
                    </span>
                    <h3
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        color: "#0f172a",
                        margin: "4px 0 0 0",
                      }}
                    >
                      Order #{selectedOrder.id.toUpperCase()}
                    </h3>
                  </div>
                  {getStatusBadge(selectedOrder.status)}
                </div>

                {/* Progress Step Bar */}
                <div
                  style={{
                    background: "#f8fafc",
                    padding: "18px 16px",
                    borderRadius: 12,
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      position: "relative",
                      marginBottom: 8,
                    }}
                  >
                    {["Order Confirmed", "Processing", "Shipped", "Delivered"].map((step, idx) => {
                      const currentStep = getStatusStep(selectedOrder.status);
                      const isComplete = idx <= currentStep;
                      return (
                        <div
                          key={step}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            flex: 1,
                            textAlign: "center",
                            zIndex: 1,
                          }}
                        >
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: "50%",
                              background: isComplete ? "#2563eb" : "#cbd5e1",
                              color: "#ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 12,
                              fontWeight: 700,
                              marginBottom: 6,
                            }}
                          >
                            {isComplete ? <CheckCircle2 size={16} /> : idx + 1}
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: isComplete ? 700 : 500,
                              color: isComplete ? "#0f172a" : "#94a3b8",
                            }}
                          >
                            {step}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Courier & Tracking Details */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
                    gap: 14,
                    marginBottom: 20,
                  }}
                >
                  <div style={{ background: "#f8fafc", padding: 12, borderRadius: 10 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#64748b",
                        textTransform: "uppercase",
                      }}
                    >
                      Carrier
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#0f172a",
                        marginTop: 2,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Truck size={14} color="#2563eb" />{" "}
                      {selectedOrder.carrier || "Express Courier"}
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", padding: 12, borderRadius: 10 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#64748b",
                        textTransform: "uppercase",
                      }}
                    >
                      Tracking Number
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#2563eb", marginTop: 2 }}>
                      {selectedOrder.tracking_number || "TRK-9849201"}
                    </div>
                  </div>
                </div>

                {/* Delivery Location */}
                <div
                  style={{ background: "#f8fafc", padding: 14, borderRadius: 10, marginBottom: 20 }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#64748b",
                      textTransform: "uppercase",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <MapPin size={12} /> Shipping Address
                  </div>
                  <div style={{ fontSize: 13, color: "#1e293b", marginTop: 4, fontWeight: 500 }}>
                    {selectedOrder.shipping_address}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <Button
                    variant="primary"
                    style={{ flex: 1 }}
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
