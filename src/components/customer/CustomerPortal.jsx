import { useState, useEffect } from "react";
import {
  Package,
  Heart,
  User,
  MapPin,
  Clock,
  CheckCircle2,
  Truck,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  CreditCard
} from "lucide-react";
import { Button, Badge, useToast } from "../ui";
import { apiFetchOrders } from "../../api/backendApi";

export default function CustomerPortal({ currentUser, onNavigateHome, onSelectProduct }) {
  const [activeTab, setActiveTab] = useState("orders"); // orders, wishlist, profile
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const { addToast } = useToast();

  const [wishlist, setWishlist] = useState([
    {
      id: "p1",
      title: "Wireless Noise-Canceling Headphones Pro",
      price: 199.99,
      original_price: 249.99,
      image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80",
      category: "Electronics",
      in_stock: true
    },
    {
      id: "p2",
      title: "Smart OLED Watch Ultra",
      price: 349.50,
      original_price: 399.00,
      image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=80",
      category: "Wearables",
      in_stock: true
    }
  ]);

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
      case "processing": return 1;
      case "shipped": return 2;
      case "delivered": return 3;
      default: return 0;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "delivered":
        return <span style={{ background: "#dcfce7", color: "#15803d", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>Delivered</span>;
      case "shipped":
        return <span style={{ background: "#e0f2fe", color: "#0369a1", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>In Transit (Shipped)</span>;
      case "processing":
        return <span style={{ background: "#fef3c7", color: "#b45309", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>Processing Order</span>;
      default:
        return <span style={{ background: "#f1f5f9", color: "#475569", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{status}</span>;
    }
  };

  const handleRemoveWishlist = (id, title) => {
    setWishlist(wishlist.filter(item => item.id !== id));
    addToast({ title: "Removed from Wishlist", message: title, type: "info" });
  };

  return (
    <div style={{ background: "#f8fafc", minHeight: "calc(100vh - 120px)", padding: "32px 16px" }}>
      <div className="container" style={{ maxWidth: 1160, margin: "0 auto" }}>
        
        {/* Top Breadcrumb & User Bar */}
        <div style={{
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
          boxShadow: "0 2px 10px rgba(0,0,0,0.02)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 800
            }}>
              {currentUser?.full_name ? currentUser.full_name[0].toUpperCase() : "U"}
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: 0 }}>
                Welcome back, {currentUser?.full_name || "Valued Customer"}
              </h2>
              <div style={{ fontSize: 13, color: "#64748b", display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
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
        <div style={{ display: "flex", gap: 12, borderBottom: "2px solid #e2e8f0", marginBottom: 24 }}>
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
              cursor: "pointer"
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
              borderBottom: activeTab === "wishlist" ? "3px solid #2563eb" : "3px solid transparent",
              cursor: "pointer"
            }}
          >
            <Heart size={18} /> Saved Wishlist ({wishlist.length})
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
              cursor: "pointer"
            }}
          >
            <User size={18} /> Account Settings & Addresses
          </button>
        </div>

        {/* TAB 1: ORDERS & TRACKING */}
        {activeTab === "orders" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
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
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>
                          Order #{ord.id.toUpperCase()}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                          Placed on {new Date(ord.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                      </div>
                      {getStatusBadge(ord.status)}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
                      {ord.items?.map((item, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <img
                            src={item.image || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100"}
                            alt={item.title}
                            style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }}
                          />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {item.title}
                            </div>
                            <div style={{ fontSize: 12, color: "#64748b" }}>
                              Qty: {item.quantity} • ${item.price.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, fontSize: 13 }}>
                      <span style={{ color: "#64748b" }}>Total: <strong style={{ color: "#0f172a" }}>${ord.total_amount.toFixed(2)}</strong></span>
                      <span style={{ color: "#2563eb", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                        View Tracking Details <ChevronRight size={14} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Order Detailed Live Tracker */}
            {selectedOrder && (
              <div style={{ background: "#ffffff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0", boxShadow: "0 4px 16px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#64748b" }}>Package Tracking</span>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: "4px 0 0 0" }}>
                      Order #{selectedOrder.id.toUpperCase()}
                    </h3>
                  </div>
                  {getStatusBadge(selectedOrder.status)}
                </div>

                {/* Progress Step Bar */}
                <div style={{ background: "#f8fafc", padding: "18px 16px", borderRadius: 12, marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", position: "relative", marginBottom: 8 }}>
                    {["Order Confirmed", "Processing", "Shipped", "Delivered"].map((step, idx) => {
                      const currentStep = getStatusStep(selectedOrder.status);
                      const isComplete = idx <= currentStep;
                      return (
                        <div key={step} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, textAlign: "center", zIndex: 1 }}>
                          <div style={{
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
                            marginBottom: 6
                          }}>
                            {isComplete ? <CheckCircle2 size={16} /> : idx + 1}
                          </div>
                          <span style={{ fontSize: 11, fontWeight: isComplete ? 700 : 500, color: isComplete ? "#0f172a" : "#94a3b8" }}>
                            {step}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Courier & Tracking Details */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                  <div style={{ background: "#f8fafc", padding: 12, borderRadius: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Carrier</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                      <Truck size={14} color="#2563eb" /> {selectedOrder.carrier || "Express Courier"}
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", padding: 12, borderRadius: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Tracking Number</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#2563eb", marginTop: 2 }}>
                      {selectedOrder.tracking_number || "TRK-9849201"}
                    </div>
                  </div>
                </div>

                {/* Delivery Location */}
                <div style={{ background: "#f8fafc", padding: 14, borderRadius: 10, marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
                    <MapPin size={12} /> Shipping Address
                  </div>
                  <div style={{ fontSize: 13, color: "#1e293b", marginTop: 4, fontWeight: 500 }}>
                    {selectedOrder.shipping_address}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <Button variant="primary" style={{ flex: 1 }} onClick={() => addToast({ title: "Order Receipt", message: "Receipt sent to your email", type: "success" })}>
                    Download Invoice PDF
                  </Button>
                  <Button variant="secondary" onClick={() => addToast({ title: "Support Requested", message: "Support ticket opened for order", type: "info" })}>
                    Need Help?
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: WISHLIST */}
        {activeTab === "wishlist" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {wishlist.map((item) => (
              <div key={item.id} style={{ background: "#ffffff", borderRadius: 16, padding: 18, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
                <img src={item.image} alt={item.title} style={{ width: "100%", height: 180, objectFit: "cover", borderRadius: 12, marginBottom: 12 }} />
                <div style={{ fontSize: 12, fontWeight: 700, color: "#2563eb", textTransform: "uppercase" }}>{item.category}</div>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: "4px 0 8px 0" }}>{item.title}</h4>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>${item.price.toFixed(2)}</span>
                  <span style={{ fontSize: 13, color: "#94a3b8", textDecoration: "line-through" }}>${item.original_price.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="primary" size="sm" style={{ flex: 1 }} onClick={() => addToast({ title: "Moved to Cart", message: item.title, type: "success" })}>
                    <ShoppingBag size={14} style={{ marginRight: 6 }} /> Move to Cart
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleRemoveWishlist(item.id, item.title)}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: PROFILE & ADDRESSES */}
        {activeTab === "profile" && (
          <div style={{ background: "#ffffff", borderRadius: 16, padding: 28, border: "1px solid #e2e8f0" }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 20 }}>
              Personal Details & Addresses
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 640 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 6 }}>Full Name</label>
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", fontWeight: 600 }}>
                  {currentUser?.full_name || "Alex Customer"}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 6 }}>Email Address</label>
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", fontWeight: 600 }}>
                  {currentUser?.email || "user@marvel.com"}
                </div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 6 }}>Primary Delivery Address</label>
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", fontWeight: 500 }}>
                  742 Evergreen Terrace, Springfield, OR 97477, United States
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
