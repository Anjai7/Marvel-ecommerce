import { useState, useEffect } from "react";
import {
  Store,
  Package,
  Plus,
  Edit2,
  Trash2,
  TrendingUp,
  Truck,
  CheckCircle2,
  AlertCircle,
  Search,
  ExternalLink,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Button, Input, useToast } from "../ui";
import CategoryPicker from "../admin/CategoryPicker";
import VendorProductModal from "./VendorProductModal";
import VendorFulfillmentModal from "./VendorFulfillmentModal";
import { apiFetchCategoryTree } from "../../api/contentApi";
import {
  apiFetchProducts,
  apiCreateProduct,
  apiUpdateProduct,
  apiDeleteProduct,
  apiFetchOrders,
  apiUpdateOrderStatus,
} from "../../api/backendApi";
import { formatCurrency } from "../../lib/currency";

/** Depth-first lookup of one node in a category tree. */
function findCategoryNode(nodes, id) {
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (node.id === id) return node;
    const found = findCategoryNode(node.children || [], id);
    if (found) return found;
  }
  return null;
}

/**
 * The selected category plus every descendant id, mirroring the server's
 * `.in("category_id", ids)` expansion. Returns null when the tree is not loaded
 * or the id is absent, so the caller can fall back to an exact match.
 */
function collectCategoryIds(nodes, id) {
  const root = findCategoryNode(nodes, id);
  if (!root) return null;

  const ids = new Set();
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    ids.add(node.id);
    stack.push(...(node.children || []));
  }
  return ids;
}

export default function VendorDashboard({ currentUser, onNavigateHome }) {
  const [activeTab, setActiveTab] = useState("overview"); // overview, products, orders, settings
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState({ id: null, name: null });
  const [categoryTree, setCategoryTree] = useState([]);

  // Product Modal State
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    title: "",
    price: "",
    original_price: "",
    category: "Electronics",
    category_id: null,
    stock: "15",
    image_url: "",
    description: "",
  });

  // Fulfillment Modal State
  const [fulfillmentModalOpen, setFulfillmentModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [fulfillmentForm, setFulfillmentForm] = useState({
    status: "shipped",
    carrier: "FedEx Express",
    tracking_number: "",
  });

  const { addToast } = useToast();

  const loadVendorData = async () => {
    setLoading(true);
    try {
      const prods = await apiFetchProducts({ vendorId: currentUser?.id });
      setProducts(prods);

      const ords = await apiFetchOrders({ userId: currentUser?.id, role: "vendor" });
      setOrders(ords);
    } catch (e) {
      console.error("Error loading vendor data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendorData();
  }, [currentUser]);

  // The picker fetches the same tree; the filter needs it too so selecting a
  // parent also matches products bound to its descendants (server parity).
  useEffect(() => {
    let cancelled = false;
    apiFetchCategoryTree()
      .then((result) => {
        if (cancelled) return;
        setCategoryTree(Array.isArray(result) ? result : result?.categories || []);
      })
      .catch(() => {
        if (!cancelled) setCategoryTree([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Calculate Metrics
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const totalStockUnits = products.reduce((sum, p) => sum + (p.stock || 0), 0);
  const lowStockCount = products.filter((p) => p.stock < 10).length;

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      title: "",
      price: "",
      original_price: "",
      category: "Electronics",
      category_id: null,
      stock: "15",
      image_url: "",
      description: "",
    });
    setProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod) => {
    setEditingProduct(prod);
    setProductForm({
      title: prod.title,
      price: prod.price.toString(),
      original_price: prod.original_price?.toString() || "",
      category: prod.category,
      category_id: prod.category_id ?? null,
      stock: prod.stock.toString(),
      image_url: prod.image_url || "",
      description: prod.description || "",
    });
    setProductModalOpen(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        const updated = await apiUpdateProduct(editingProduct.id, {
          title: productForm.title,
          price: parseFloat(productForm.price),
          original_price: productForm.original_price
            ? parseFloat(productForm.original_price)
            : undefined,
          category: productForm.category,
          category_id: productForm.category_id ?? null,
          stock: parseInt(productForm.stock, 10),
          image_url: productForm.image_url,
          description: productForm.description,
        });
        setProducts(products.map((p) => (p.id === editingProduct.id ? updated : p)));
        addToast({
          title: "Product Updated",
          message: `Updated '${productForm.title}'`,
          type: "success",
        });
      } else {
        const created = await apiCreateProduct({
          title: productForm.title,
          price: parseFloat(productForm.price),
          original_price: productForm.original_price
            ? parseFloat(productForm.original_price)
            : undefined,
          category: productForm.category,
          category_id: productForm.category_id ?? null,
          stock: parseInt(productForm.stock, 10),
          image_url: productForm.image_url,
          description: productForm.description,
          vendor_id: currentUser?.id || "usr-002",
          vendor_name: currentUser?.store_name || "TechGear Flagship Store",
        });
        setProducts([created, ...products]);
        addToast({
          title: "Product Listed",
          message: `Published '${productForm.title}'`,
          type: "success",
        });
      }
      setProductModalOpen(false);
    } catch (err) {
      addToast({ title: "Error", message: err.message, type: "error" });
    }
  };

  const handleDeleteProduct = async (id, title) => {
    if (!window.confirm(`Are you sure you want to remove '${title}' from your catalog?`)) return;
    try {
      await apiDeleteProduct(id);
      setProducts(products.filter((p) => p.id !== id));
      addToast({ title: "Product Deleted", message: `Removed '${title}'`, type: "info" });
    } catch (err) {
      addToast({ title: "Error", message: err.message, type: "error" });
    }
  };

  const handleOpenFulfillment = (order) => {
    setSelectedOrder(order);
    setFulfillmentForm({
      status: order.status === "processing" ? "shipped" : order.status,
      carrier: order.carrier || "FedEx Express",
      tracking_number:
        order.tracking_number || `TRK-${Math.floor(100000 + Math.random() * 900000)}`,
    });
    setFulfillmentModalOpen(true);
  };

  const handleUpdateFulfillment = async (e) => {
    e.preventDefault();
    try {
      const updated = await apiUpdateOrderStatus(selectedOrder.id, fulfillmentForm);
      setOrders(orders.map((o) => (o.id === selectedOrder.id ? updated : o)));
      setFulfillmentModalOpen(false);
      addToast({
        title: "Fulfillment Updated",
        message: `Order #${selectedOrder.id} marked as ${fulfillmentForm.status.toUpperCase()}`,
        type: "success",
      });
    } catch (err) {
      addToast({ title: "Error", message: err.message, type: "error" });
    }
  };

  const categoryFilterIds = categoryFilter.id
    ? collectCategoryIds(categoryTree, categoryFilter.id)
    : null;

  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      !categoryFilter.id ||
      (categoryFilterIds
        ? categoryFilterIds.has(p.category_id)
        : p.category_id === categoryFilter.id) ||
      (!p.category_id && p.category === categoryFilter.name);
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div style={{ background: "#f8fafc", minHeight: "calc(100vh - 120px)", padding: "30px 20px" }}>
      <div className="container" style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Vendor Header Banner */}
        <div
          style={{
            background: "linear-gradient(135deg, #3b0764 0%, #6b21a8 50%, #9333ea 100%)",
            color: "#ffffff",
            borderRadius: 16,
            padding: "24px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 24,
            boxShadow: "0 10px 25px -5px rgba(107, 33, 168, 0.25)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: "rgba(255, 255, 255, 0.2)",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Store size={28} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "#fff" }}>
                  {currentUser?.store_name || "TechGear Flagship Store"}
                </h2>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: "3px 10px",
                    borderRadius: 20,
                    background: "#dcfce7",
                    color: "#15803d",
                    textTransform: "uppercase",
                  }}
                >
                  Verified Merchant
                </span>
              </div>
              <p style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.8)", margin: "4px 0 0 0" }}>
                Seller Account: <strong>{currentUser?.full_name}</strong> ({currentUser?.email})
              </p>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={onNavigateHome}
            style={{
              background: "rgba(255,255,255,0.2)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
            }}
          >
            <ExternalLink size={14} style={{ marginRight: 6 }} /> Preview Public Storefront
          </Button>
        </div>

        {/* Store Key Metrics */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: 20,
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
              }}
            >
              Total Gross Revenue
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#16a34a", marginTop: 4 }}>
              {formatCurrency(totalRevenue)}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              Across {orders.length} store orders
            </div>
          </div>

          <div
            style={{
              background: "#fff",
              padding: 20,
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
              }}
            >
              Active Listed Items
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#7c3aed", marginTop: 4 }}>
              {products.length}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              {totalStockUnits} Total stock units
            </div>
          </div>

          <div
            style={{
              background: "#fff",
              padding: 20,
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
              }}
            >
              Pending Fulfillment
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#d97706", marginTop: 4 }}>
              {orders.filter((o) => o.status === "processing").length}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              Ready to package & ship
            </div>
          </div>

          <div
            style={{
              background: "#fff",
              padding: 20,
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
              }}
            >
              Seller Rating
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
              4.8 ★
            </div>
            <div style={{ fontSize: 12, color: "#16a34a", marginTop: 4 }}>
              Top 5% customer satisfaction
            </div>
          </div>
        </div>

        {/* Tab Controls */}
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
            onClick={() => setActiveTab("overview")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 18px",
              border: "none",
              background: "none",
              fontSize: 14,
              fontWeight: activeTab === "overview" ? 700 : 500,
              color: activeTab === "overview" ? "#7c3aed" : "#64748b",
              borderBottom:
                activeTab === "overview" ? "3px solid #7c3aed" : "3px solid transparent",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <TrendingUp size={18} /> Store Overview
          </button>

          <button
            onClick={() => setActiveTab("products")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 18px",
              border: "none",
              background: "none",
              fontSize: 14,
              fontWeight: activeTab === "products" ? 700 : 500,
              color: activeTab === "products" ? "#7c3aed" : "#64748b",
              borderBottom:
                activeTab === "products" ? "3px solid #7c3aed" : "3px solid transparent",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <ShoppingBag size={18} /> Product Catalog ({products.length})
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
              color: activeTab === "orders" ? "#7c3aed" : "#64748b",
              borderBottom: activeTab === "orders" ? "3px solid #7c3aed" : "3px solid transparent",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Truck size={18} /> Order Fulfillment ({orders.length})
          </button>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
              gap: 24,
            }}
          >
            {/* Recent Orders Overview */}
            <div
              style={{
                background: "#ffffff",
                padding: 24,
                borderRadius: 16,
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 18,
                }}
              >
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "#0f172a" }}>
                  Recent Incoming Orders
                </h3>
                <Button variant="secondary" size="sm" onClick={() => setActiveTab("orders")}>
                  View All Orders
                </Button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {orders.slice(0, 3).map((order) => (
                  <div
                    key={order.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: 14,
                      borderRadius: 10,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
                        Order #{order.id.toUpperCase()}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        Customer: {order.customer_name} • {order.items?.length || 1} item(s)
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800, color: "#16a34a", fontSize: 15 }}>
                        {formatCurrency(order.total_amount)}
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: order.status === "delivered" ? "#15803d" : "#b45309",
                        }}
                      >
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions & Stock Alerts */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  background: "#ffffff",
                  padding: 20,
                  borderRadius: 16,
                  border: "1px solid #e2e8f0",
                }}
              >
                <h4 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px 0" }}>
                  Quick Seller Actions
                </h4>
                <Button
                  variant="primary"
                  style={{ width: "100%", background: "#7c3aed", marginBottom: 10 }}
                  onClick={handleOpenAddProduct}
                >
                  <Plus size={16} style={{ marginRight: 6 }} /> Add New Product
                </Button>
                <Button
                  variant="secondary"
                  style={{ width: "100%" }}
                  onClick={() => setActiveTab("orders")}
                >
                  Process Shipments
                </Button>
              </div>

              {lowStockCount > 0 && (
                <div
                  style={{
                    background: "#fffbeb",
                    padding: 16,
                    borderRadius: 14,
                    border: "1px solid #fde68a",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color: "#b45309",
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    <AlertCircle size={16} /> Low Stock Alert ({lowStockCount})
                  </div>
                  <p style={{ fontSize: 12, color: "#92400e", margin: "6px 0 0 0" }}>
                    Some products have less than 10 units remaining. Restock to prevent lost sales.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PRODUCT CATALOG CRUD */}
        {activeTab === "products" && (
          <div
            style={{
              background: "#ffffff",
              padding: 24,
              borderRadius: 16,
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 14,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                  flex: 1,
                  minWidth: "min(100%, 260px)",
                }}
              >
                <Input
                  type="text"
                  placeholder="Search products by title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search size={16} />}
                />
                <CategoryPicker
                  value={categoryFilter.id}
                  label={categoryFilter.name}
                  onChange={(id, name) => setCategoryFilter({ id, name })}
                  emptyLabel="All Categories"
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    width: 220,
                  }}
                />
              </div>

              <Button
                variant="primary"
                style={{ background: "#7c3aed" }}
                onClick={handleOpenAddProduct}
              >
                <Plus size={16} style={{ marginRight: 6 }} /> Add Product
              </Button>
            </div>

            {/* Products Table */}
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: 14,
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#f8fafc",
                      color: "#475569",
                      borderBottom: "2px solid #e2e8f0",
                    }}
                  >
                    <th style={{ padding: "12px 16px" }}>Product Item</th>
                    <th style={{ padding: "12px 16px" }}>Category</th>
                    <th style={{ padding: "12px 16px" }}>Price</th>
                    <th style={{ padding: "12px 16px" }}>Stock</th>
                    <th style={{ padding: "12px 16px" }}>Status</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((prod) => (
                    <tr key={prod.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <img
                            src={
                              prod.image_url ||
                              "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100"
                            }
                            alt={prod.title}
                            style={{
                              width: 44,
                              height: 44,
                              objectFit: "cover",
                              borderRadius: 8,
                              border: "1px solid #e2e8f0",
                            }}
                          />
                          <div>
                            <div style={{ fontWeight: 700, color: "#0f172a" }}>{prod.title}</div>
                            <div style={{ fontSize: 12, color: "#64748b" }}>ID: {prod.id}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", color: "#64748b" }}>{prod.category}</td>
                      <td style={{ padding: "14px 16px", fontWeight: 700, color: "#0f172a" }}>
                        {formatCurrency(prod.price)}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            background: prod.stock > 10 ? "#dcfce7" : "#fef3c7",
                            color: prod.stock > 10 ? "#15803d" : "#b45309",
                          }}
                        >
                          {prod.stock} in stock
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            background: "#e0f2fe",
                            color: "#0369a1",
                          }}
                        >
                          {prod.moderation_status || "Active"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 8 }}>
                          <button
                            onClick={() => handleOpenEditProduct(prod)}
                            style={{
                              padding: 6,
                              borderRadius: 6,
                              border: "none",
                              background: "#f3e8ff",
                              color: "#7c3aed",
                              cursor: "pointer",
                            }}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(prod.id, prod.title)}
                            style={{
                              padding: 6,
                              borderRadius: 6,
                              border: "none",
                              background: "#fee2e2",
                              color: "#dc2626",
                              cursor: "pointer",
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: ORDER FULFILLMENT */}
        {activeTab === "orders" && (
          <div
            style={{
              background: "#ffffff",
              padding: 24,
              borderRadius: 16,
              border: "1px solid #e2e8f0",
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>
              Order Fulfillment & Shipments ({orders.length})
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {orders.map((ord) => (
                <div
                  key={ord.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 14,
                    padding: 18,
                    borderRadius: 12,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>
                        Order #{ord.id.toUpperCase()}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 6,
                          textTransform: "uppercase",
                          background:
                            ord.status === "delivered"
                              ? "#dcfce7"
                              : ord.status === "shipped"
                                ? "#e0f2fe"
                                : "#fef3c7",
                          color:
                            ord.status === "delivered"
                              ? "#15803d"
                              : ord.status === "shipped"
                                ? "#0369a1"
                                : "#b45309",
                        }}
                      >
                        {ord.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                      Customer: <strong>{ord.customer_name}</strong> ({ord.customer_email}) • Ship
                      to: {ord.shipping_address}
                    </div>
                    <div style={{ fontSize: 12, color: "#2563eb", marginTop: 4 }}>
                      Tracking: {ord.carrier || "Express"} —{" "}
                      <code>{ord.tracking_number || "Awaiting shipment"}</code>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}
                    >
                      {formatCurrency(ord.total_amount)}
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      style={{ background: "#7c3aed" }}
                      onClick={() => handleOpenFulfillment(ord)}
                    >
                      <Truck size={14} style={{ marginRight: 6 }} /> Update Shipment
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ADD / EDIT PRODUCT MODAL */}
      <VendorProductModal
        isOpen={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        editingProduct={editingProduct}
        productForm={productForm}
        setProductForm={setProductForm}
        onSubmit={handleSaveProduct}
      />

      {/* FULFILLMENT UPDATE MODAL */}
      <VendorFulfillmentModal
        isOpen={fulfillmentModalOpen}
        onClose={() => setFulfillmentModalOpen(false)}
        selectedOrder={selectedOrder}
        fulfillmentForm={fulfillmentForm}
        setFulfillmentForm={setFulfillmentForm}
        onSubmit={handleUpdateFulfillment}
      />
    </div>
  );
}
