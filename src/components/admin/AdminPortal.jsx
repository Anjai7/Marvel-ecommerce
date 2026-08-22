import { useState, useEffect } from "react";
import {
  ShieldCheck,
  Package,
  Store,
  Users,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  Search,
  ExternalLink,
  DollarSign,
  TrendingUp,
  RotateCcw
} from "lucide-react";
import { Button, Input, useToast } from "../ui";
import {
  apiFetchProducts,
  apiModerateProduct,
  apiFetchOrders,
  apiFetchAllUsers
} from "../../api/backendApi";

export default function AdminPortal({ currentUser, onNavigateHome }) {
  const [activeTab, setActiveTab] = useState("moderation"); // moderation, vendors, orders, categories
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const { addToast } = useToast();

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const prods = await apiFetchProducts();
      setProducts(prods);

      const ords = await apiFetchOrders({ role: "admin" });
      setOrders(ords);

      const usrs = await apiFetchAllUsers();
      setUsers(usrs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleModerate = async (productId, newStatus, isFeatured) => {
    try {
      const updated = await apiModerateProduct(productId, {
        moderation_status: newStatus,
        is_featured: isFeatured
      });
      setProducts(products.map(p => p.id === productId ? updated : p));
      window.dispatchEvent(new CustomEvent("marvel_catalog_updated"));
      addToast({
        title: "Product Moderated",
        message: `Product set to ${newStatus.toUpperCase()}${isFeatured ? " (Featured in Carousel)" : ""}`,
        type: "success"
      });
    } catch (err) {
      addToast({ title: "Error", message: err.message, type: "error" });
    }
  };

  const vendorsList = users.filter(u => u.role === "vendor");

  return (
    <div style={{ background: "#f8fafc", minHeight: "calc(100vh - 120px)", padding: "30px 20px" }}>
      <div className="container" style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* Admin Header Banner */}
        <div style={{
          background: "linear-gradient(135deg, #0c4a6e 0%, #0369a1 50%, #0284c7 100%)",
          color: "#ffffff",
          borderRadius: 16,
          padding: "24px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24,
          boxShadow: "0 10px 25px -5px rgba(2, 132, 199, 0.25)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "rgba(255, 255, 255, 0.2)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <ShieldCheck size={28} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "#fff" }}>
                  Platform Operations & Catalog Console
                </h2>
                <span style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: "3px 10px",
                  borderRadius: 20,
                  background: "#e0f2fe",
                  color: "#0369a1",
                  textTransform: "uppercase"
                }}>
                  Admin Level
                </span>
              </div>
              <p style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.8)", margin: "4px 0 0 0" }}>
                Operator: <strong>{currentUser?.full_name || "Sarah Jenkins"}</strong> ({currentUser?.email})
              </p>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={onNavigateHome}
            style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", borderRadius: 10 }}
          >
            <ExternalLink size={14} style={{ marginRight: 6 }} /> Open Public Storefront
          </Button>
        </div>

        {/* Platform Overview Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 28 }}>
          <div style={{ background: "#fff", padding: 20, borderRadius: 14, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Total Catalog Products</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#0284c7", marginTop: 4 }}>{products.length}</div>
            <div style={{ fontSize: 12, color: "#16a34a", marginTop: 4 }}>Active in marketplace</div>
          </div>

          <div style={{ background: "#fff", padding: 20, borderRadius: 14, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Registered Merchants</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#7c3aed", marginTop: 4 }}>{vendorsList.length}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Verified seller storefronts</div>
          </div>

          <div style={{ background: "#fff", padding: 20, borderRadius: 14, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Platform Orders</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#16a34a", marginTop: 4 }}>{orders.length}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Global customer orders</div>
          </div>

          <div style={{ background: "#fff", padding: 20, borderRadius: 14, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Pending Moderations</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#d97706", marginTop: 4 }}>
              {products.filter(p => p.moderation_status === "pending").length}
            </div>
            <div style={{ fontSize: 12, color: "#d97706", marginTop: 4 }}>Require review approval</div>
          </div>
        </div>

        {/* Tab Controls */}
        <div style={{ display: "flex", gap: 12, borderBottom: "2px solid #e2e8f0", marginBottom: 24 }}>
          <button
            onClick={() => setActiveTab("moderation")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 18px",
              border: "none",
              background: "none",
              fontSize: 14,
              fontWeight: activeTab === "moderation" ? 700 : 500,
              color: activeTab === "moderation" ? "#0284c7" : "#64748b",
              borderBottom: activeTab === "moderation" ? "3px solid #0284c7" : "3px solid transparent",
              cursor: "pointer"
            }}
          >
            <Package size={18} /> Product Moderation Queue ({products.length})
          </button>

          <button
            onClick={() => setActiveTab("vendors")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 18px",
              border: "none",
              background: "none",
              fontSize: 14,
              fontWeight: activeTab === "vendors" ? 700 : 500,
              color: activeTab === "vendors" ? "#0284c7" : "#64748b",
              borderBottom: activeTab === "vendors" ? "3px solid #0284c7" : "3px solid transparent",
              cursor: "pointer"
            }}
          >
            <Store size={18} /> Vendor Directory ({vendorsList.length})
          </button>

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
              color: activeTab === "orders" ? "#0284c7" : "#64748b",
              borderBottom: activeTab === "orders" ? "3px solid #0284c7" : "3px solid transparent",
              cursor: "pointer"
            }}
          >
            <Users size={18} /> Global Order Oversight ({orders.length})
          </button>
        </div>

        {/* TAB 1: PRODUCT MODERATION QUEUE */}
        {activeTab === "moderation" && (
          <div style={{ background: "#ffffff", padding: 24, borderRadius: 16, border: "1px solid #e2e8f0" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 18 }}>
              Vendor Product Review & Feature Controls
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {products.map(prod => (
                <div key={prod.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14, padding: 16, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <img
                      src={prod.image_url || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100"}
                      alt={prod.title}
                      style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 10, border: "1px solid #e2e8f0" }}
                    />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                        {prod.title}
                        {prod.is_featured && (
                          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "#fef3c7", color: "#b45309", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                            <Sparkles size={12} /> Featured
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                        Vendor: <strong>{prod.vendor_name || "TechGear"}</strong> • Category: {prod.category} • Price: <strong>${prod.price.toFixed(2)}</strong> • Stock: {prod.stock}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: 6,
                      textTransform: "uppercase",
                      background: prod.moderation_status === "approved" ? "#dcfce7" : prod.moderation_status === "flagged" ? "#fee2e2" : "#fef3c7",
                      color: prod.moderation_status === "approved" ? "#15803d" : prod.moderation_status === "flagged" ? "#dc2626" : "#b45309"
                    }}>
                      {prod.moderation_status || "Approved"}
                    </span>

                    <Button
                      variant={prod.moderation_status === "approved" ? "secondary" : "primary"}
                      size="sm"
                      onClick={() => handleModerate(prod.id, "approved", prod.is_featured)}
                    >
                      <CheckCircle2 size={14} style={{ marginRight: 6 }} /> Approve
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleModerate(prod.id, prod.moderation_status, !prod.is_featured)}
                      style={{ color: prod.is_featured ? "#b45309" : "#0284c7" }}
                    >
                      <Sparkles size={14} style={{ marginRight: 4 }} /> {prod.is_featured ? "Unfeature" : "Feature"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: VENDOR DIRECTORY */}
        {activeTab === "vendors" && (
          <div style={{ background: "#ffffff", padding: 24, borderRadius: 16, border: "1px solid #e2e8f0" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 18 }}>
              Active Merchant Storefronts ({vendorsList.length})
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
              {vendorsList.map(vendor => (
                <div key={vendor.id} style={{ background: "#f8fafc", padding: 20, borderRadius: 14, border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>
                      {vendor.store_name || vendor.full_name}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#dcfce7", color: "#15803d" }}>
                      Active Store
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#64748b" }}>Contact: {vendor.email}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Phone: {vendor.phone || "+1 555-0192"}</div>

                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <Button variant="secondary" size="sm" style={{ flex: 1 }} onClick={() => addToast({ title: "Vendor Store", message: "Viewing storefront analytics", type: "info" })}>
                      Store Analytics
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: GLOBAL ORDER OVERSIGHT */}
        {activeTab === "orders" && (
          <div style={{ background: "#ffffff", padding: 24, borderRadius: 16, border: "1px solid #e2e8f0" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 18 }}>
              Platform-Wide Customer Orders ({orders.length})
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {orders.map(ord => (
                <div key={ord.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div>
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>Order #{ord.id.toUpperCase()}</div>
                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                      Buyer: {ord.customer_name} ({ord.customer_email}) • Carrier: {ord.carrier} ({ord.tracking_number})
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 16 }}>${ord.total_amount.toFixed(2)}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: ord.status === "delivered" ? "#15803d" : "#0369a1" }}>
                      {ord.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
