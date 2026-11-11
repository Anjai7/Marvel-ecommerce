import { useState, useEffect } from "react";
import {
  Store,
  Plus,
  Edit2,
  Trash2,
  TrendingUp,
  Truck,
  AlertCircle,
  ExternalLink,
  ShoppingBag,
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
import SearchInput from "../ui/SearchInput";
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
import "./vendor-dashboard.css";

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

/** The tone of an order status: delivered, shipped or still being processed. */
function statusTone(status) {
  if (status === "delivered") return "delivered";
  if (status === "shipped") return "shipped";
  return "processing";
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
    <div className="vendor-dashboard">
      <div className="container vendor-dashboard__inner">
        {/* Vendor Header Banner */}
        <div className="vendor-banner">
          <div className="vendor-banner__identity">
            <div className="vendor-banner__logo">
              <Store size={28} color="#ffffff" />
            </div>
            <div>
              <div className="vendor-banner__title-row">
                <h2 className="vendor-banner__title">
                  {currentUser?.store_name || "TechGear Flagship Store"}
                </h2>
                <span className="vendor-banner__verified">Verified Merchant</span>
              </div>
              <p className="vendor-banner__meta">
                Seller Account: <strong>{currentUser?.full_name}</strong> ({currentUser?.email})
              </p>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={onNavigateHome}
            className="vendor-banner__preview"
          >
            <ExternalLink size={14} className="vendor-button__icon" /> Preview Public Storefront
          </Button>
        </div>

        {/* Store Key Metrics */}
        <div className="vendor-metrics">
          <div className="vendor-metric">
            <div className="vendor-metric__label">Total Gross Revenue</div>
            <div className="vendor-metric__value vendor-metric__value--revenue">
              {formatCurrency(totalRevenue)}
            </div>
            <div className="vendor-metric__hint">Across {orders.length} store orders</div>
          </div>

          <div className="vendor-metric">
            <div className="vendor-metric__label">Active Listed Items</div>
            <div className="vendor-metric__value vendor-metric__value--items">
              {products.length}
            </div>
            <div className="vendor-metric__hint">{totalStockUnits} Total stock units</div>
          </div>

          <div className="vendor-metric">
            <div className="vendor-metric__label">Pending Fulfillment</div>
            <div className="vendor-metric__value vendor-metric__value--pending">
              {orders.filter((o) => o.status === "processing").length}
            </div>
            <div className="vendor-metric__hint">Ready to package &amp; ship</div>
          </div>

          <div className="vendor-metric">
            <div className="vendor-metric__label">Seller Rating</div>
            <div className="vendor-metric__value vendor-metric__value--rating">4.8 ★</div>
            <div className="vendor-metric__hint vendor-metric__hint--positive">
              Top 5% customer satisfaction
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="vendor-tabs">
          <button
            onClick={() => setActiveTab("overview")}
            className={`vendor-tab${activeTab === "overview" ? " vendor-tab--active" : ""}`}
          >
            <TrendingUp size={18} /> Store Overview
          </button>

          <button
            onClick={() => setActiveTab("products")}
            className={`vendor-tab${activeTab === "products" ? " vendor-tab--active" : ""}`}
          >
            <ShoppingBag size={18} /> Product Catalog ({products.length})
          </button>

          <button
            onClick={() => setActiveTab("orders")}
            className={`vendor-tab${activeTab === "orders" ? " vendor-tab--active" : ""}`}
          >
            <Truck size={18} /> Order Fulfillment ({orders.length})
          </button>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="vendor-overview">
            {/* Recent Orders Overview */}
            <div className="vendor-panel">
              <div className="vendor-panel__header">
                <h3 className="vendor-panel__title">Recent Incoming Orders</h3>
                <Button variant="secondary" size="sm" onClick={() => setActiveTab("orders")}>
                  View All Orders
                </Button>
              </div>

              <div className="vendor-order-list">
                {orders.slice(0, 3).map((order) => (
                  <div key={order.id} className="vendor-order-card">
                    <div>
                      <div className="vendor-order-card__title">
                        Order #{order.id.toUpperCase()}
                      </div>
                      <div className="vendor-order-card__meta">
                        Customer: {order.customer_name} • {order.items?.length || 1} item(s)
                      </div>
                    </div>
                    <div className="vendor-order-card__aside">
                      <div className="vendor-order-card__total">
                        {formatCurrency(order.total_amount)}
                      </div>
                      <span
                        className={`vendor-status vendor-status--${
                          order.status === "delivered" ? "delivered" : "pending"
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions & Stock Alerts */}
            <div className="vendor-side-column">
              <div className="vendor-panel vendor-panel--tight">
                <h4 className="vendor-panel__subtitle">Quick Seller Actions</h4>
                <Button
                  variant="primary"
                  className="vendor-button--accent vendor-button--block vendor-quick-action"
                  onClick={handleOpenAddProduct}
                >
                  <Plus size={16} className="vendor-button__icon" /> Add New Product
                </Button>
                <Button
                  variant="secondary"
                  className="vendor-button--block"
                  onClick={() => setActiveTab("orders")}
                >
                  Process Shipments
                </Button>
              </div>

              {lowStockCount > 0 && (
                <div className="vendor-alert">
                  <div className="vendor-alert__title">
                    <AlertCircle size={16} /> Low Stock Alert ({lowStockCount})
                  </div>
                  <p className="vendor-alert__text">
                    Some products have less than 10 units remaining. Restock to prevent lost sales.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PRODUCT CATALOG CRUD */}
        {activeTab === "products" && (
          <div className="vendor-catalog">
            <div className="vendor-catalog__toolbar">
              <div className="vendor-catalog__filters">
                <SearchInput
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                  placeholder="Search products by title..."
                  ariaLabel="Search vendor products"
                  clearLabel="Clear product search"
                />
                <CategoryPicker
                  value={categoryFilter.id}
                  label={categoryFilter.name}
                  onChange={(id, name) => setCategoryFilter({ id, name })}
                  emptyLabel="All Categories"
                  className="vendor-category-filter"
                />
              </div>

              <Button
                variant="primary"
                className="vendor-button--accent"
                onClick={handleOpenAddProduct}
              >
                <Plus size={16} className="vendor-button__icon" /> Add Product
              </Button>
            </div>

            {/* Products Table */}
            <div className="table-responsive-wrapper">
              <Table className="ui-table--cards">
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Product Item</TableHead>
                    <TableHead scope="col">Category</TableHead>
                    <TableHead scope="col">Price</TableHead>
                    <TableHead scope="col">Stock</TableHead>
                    <TableHead scope="col">Status</TableHead>
                    <TableHead scope="col" className="text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((prod) => (
                    <TableRow key={prod.id}>
                      <TableCell>
                        <div className="vendor-product">
                          <img
                            className="vendor-product-thumb"
                            src={
                              prod.image_url ||
                              "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100"
                            }
                            alt={prod.title}
                          />
                          <div>
                            <div className="vendor-product-title">{prod.title}</div>
                            <div className="vendor-product-id">ID: {prod.id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell data-label="Category" className="vendor-cell-muted">
                        {prod.category}
                      </TableCell>
                      <TableCell data-label="Price" className="vendor-cell-strong">
                        {formatCurrency(prod.price)}
                      </TableCell>
                      <TableCell data-label="Stock">
                        <span
                          className={`vendor-stock-badge vendor-stock-badge--${
                            prod.stock > 10 ? "ok" : "low"
                          }`}
                        >
                          {prod.stock} in stock
                        </span>
                      </TableCell>
                      <TableCell data-label="Status">
                        <span className="vendor-moderation-badge">
                          {prod.moderation_status || "Active"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="vendor-actions">
                          <button
                            onClick={() => handleOpenEditProduct(prod)}
                            className="vendor-action-button vendor-action-button--edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(prod.id, prod.title)}
                            className="vendor-action-button vendor-action-button--delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* TAB 3: ORDER FULFILLMENT */}
        {activeTab === "orders" && (
          <div className="vendor-fulfillment">
            <h3 className="vendor-fulfillment__title">
              Order Fulfillment &amp; Shipments ({orders.length})
            </h3>

            <div className="vendor-shipment-list">
              {orders.map((ord) => (
                <div key={ord.id} className="vendor-shipment">
                  <div>
                    <div className="vendor-shipment__heading">
                      <span className="vendor-shipment__title">Order #{ord.id.toUpperCase()}</span>
                      <span
                        className={`vendor-status-chip vendor-status-chip--${statusTone(ord.status)}`}
                      >
                        {ord.status}
                      </span>
                    </div>
                    <div className="vendor-shipment__meta">
                      Customer: <strong>{ord.customer_name}</strong> ({ord.customer_email}) • Ship
                      to: {ord.shipping_address}
                    </div>
                    <div className="vendor-shipment__tracking">
                      Tracking: {ord.carrier || "Express"} —{" "}
                      <code>{ord.tracking_number || "Awaiting shipment"}</code>
                    </div>
                  </div>

                  <div className="vendor-shipment__aside">
                    <div className="vendor-shipment__total">{formatCurrency(ord.total_amount)}</div>
                    <Button
                      variant="primary"
                      size="sm"
                      className="vendor-button--accent"
                      onClick={() => handleOpenFulfillment(ord)}
                    >
                      <Truck size={14} className="vendor-button__icon" /> Update Shipment
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
