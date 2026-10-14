import { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard,
  Users,
  LogOut,
  Plus,
  Eye,
  Edit2,
  Trash2,
  Key,
  Search,
  Filter,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Package,
  ShieldCheck,
  Crown,
  Store,
  UserCheck,
  User as UserIcon,
  ChevronRight,
  Sparkles,
  Check,
  X,
  ExternalLink,
  Copy,
  Lock,
  ArrowUpRight,
  Activity,
  Calendar,
  Layers,
  BarChart3,
  ClipboardList,
  Repeat,
  ChevronDown,
  Star,
  Wallet,
  Boxes,
  Shield
} from "lucide-react";
import { Button, Input, useToast } from "../ui";
import {
  apiFetchProducts,
  apiFetchOrders,
  apiFetchAllUsers,
  apiAdminCreateUser,
  apiUpdateUserDetails,
  apiUpdateUserRole,
  apiUpdateUserStatus,
  apiResetUserPassword,
  apiDeleteUser,
  apiCreateProduct,
  apiUpdateProduct,
  apiDeleteProduct,
  apiModerateProduct,
  apiUpdateOrderStatus
} from "../../api/backendApi";
import { useAuth } from "../../context/AuthContext";
import {
  lastNDayBuckets,
  salesWindows,
  revenueGrowth,
  summarizeStatuses,
  computeRepeatCustomers,
  aggregateBestSellers,
  summarizeInventory,
  customerStats
} from "./reportUtils";
import "./admin-reports.css";

export default function UnifiedAdminConsole({ onNavigateHome, customRole = "admin" }) {
  const { user: currentUser, logout, role: currentRole } = useAuth();
  const isSuperAdmin = currentRole === "super_admin" || customRole === "super_admin";

  // Active Tab State (Dashboard, Products, Orders, Customers, Users)
  const [activeTab, setActiveTab] = useState("dashboard"); // "dashboard" | "products" | "orders" | "customers" | "users"

  // Global Loading and Sync States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { addToast } = useToast();

  // Live Database States
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);

  // Time Range for Dashboard Charts
  const [timeRange, setTimeRange] = useState("7d"); // "7d" | "30d"

  // Sidebar submenu expansion + per-tab sub-views
  const [expandedMenus, setExpandedMenus] = useState({ dashboard: true });
  const [dashboardView, setDashboardView] = useState("overview"); // "overview" | "sales"
  const [productsView, setProductsView] = useState("list"); // "list" | "add"
  const [ordersView, setOrdersView] = useState("all"); // "all" | order status
  const [customersView, setCustomersView] = useState("all"); // "all" | "repeat"

  // Products management states
  const [editingProduct, setEditingProduct] = useState(null);
  const [productSaving, setProductSaving] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productForm, setProductForm] = useState({
    title: "",
    price: "",
    original_price: "",
    category: "Electronics",
    stock: "15",
    image_url: "",
    description: ""
  });

  // Users Tab Filter States
  const [searchUser, setSearchUser] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [userPage, setUserPage] = useState(1);
  const usersPerPage = 8;

  // Modals States
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [addUserForm, setAddUserForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "user",
    storeName: "",
    plan: "Basic",
    billing: "Auto Debit"
  });
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // View User Modal
  const [viewingUser, setViewingUser] = useState(null);

  // Edit User Modal
  const [editingUser, setEditingUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState({
    full_name: "",
    email: "",
    role: "user",
    status: "active",
    store_name: "",
    plan: "Basic",
    billing: "Auto Debit"
  });
  const [editUserLoading, setEditUserLoading] = useState(false);

  // Reset Password Modal
  const [resetTargetUser, setResetTargetUser] = useState(null);
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);

  // Delete User Confirmation Modal
  const [deletingUser, setDeletingUser] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Load All Live Data directly from Backend & DB
  const loadDashboardData = async () => {
    setRefreshing(true);
    try {
      const [usersData, productsData, ordersData] = await Promise.all([
        apiFetchAllUsers(),
        apiFetchProducts(),
        apiFetchOrders({ role: isSuperAdmin ? "super_admin" : "admin" })
      ]);

      setUsers(Array.isArray(usersData) ? usersData : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
    } catch (err) {
      console.error("Admin Console Sync Error:", err);
      addToast({
        title: "Sync Warning",
        message: "Failed to connect to database. Showing cached records.",
        type: "warning"
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [isSuperAdmin]);

  // Handle Sign Out
  const handleSignOut = () => {
    logout();
    addToast({
      title: "Signed Out",
      message: "You have been successfully signed out from the console.",
      type: "info"
    });
    if (onNavigateHome) {
      onNavigateHome();
    } else {
      window.location.hash = "#/login";
    }
  };

  // Sidebar submenu expand/collapse
  const toggleMenu = (key) => {
    setExpandedMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ----------------------------------------------------
  // PRODUCTS MANAGEMENT HANDLERS (Admin Catalog)
  // ----------------------------------------------------
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductForm({ title: "", price: "", original_price: "", category: "Electronics", stock: "15", image_url: "", description: "" });
    setProductsView("add");
  };

  const handleOpenEditProduct = (prod) => {
    setEditingProduct(prod);
    setProductForm({
      title: prod.title || "",
      price: prod.price !== undefined && prod.price !== null ? String(prod.price) : "",
      original_price: prod.original_price !== undefined && prod.original_price !== null ? String(prod.original_price) : "",
      category: prod.category || "Electronics",
      stock: prod.stock !== undefined && prod.stock !== null ? String(prod.stock) : "15",
      image_url: prod.image_url || prod.image || "",
      description: prod.description || ""
    });
    setProductsView("add");
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!productForm.title.trim() || !productForm.price) {
      addToast({ title: "Missing Information", message: "Product title and price are required.", type: "error" });
      return;
    }
    setProductSaving(true);
    try {
      const payload = {
        title: productForm.title.trim(),
        price: parseFloat(productForm.price),
        original_price: productForm.original_price ? parseFloat(productForm.original_price) : undefined,
        category: productForm.category,
        stock: parseInt(productForm.stock, 10) || 0,
        image_url: productForm.image_url.trim(),
        description: productForm.description.trim()
      };
      if (editingProduct) {
        const updated = await apiUpdateProduct(editingProduct.id, payload);
        setProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? { ...p, ...updated } : p)));
        addToast({ title: "Product Updated", message: `'${payload.title}' saved. Live on the storefront.`, type: "success" });
      } else {
        const created = await apiCreateProduct(payload);
        setProducts((prev) => [created, ...prev]);
        addToast({ title: "Product Published", message: `'${payload.title}' is now live on the storefront.`, type: "success" });
      }
      setEditingProduct(null);
      setProductsView("list");
    } catch (err) {
      addToast({ title: "Save Failed", message: err.message || "Failed to save product.", type: "error" });
    } finally {
      setProductSaving(false);
    }
  };

  const handleDeleteProduct = async (id, title) => {
    if (!window.confirm(`Remove '${title}' from the catalog? It will disappear from the storefront.`)) return;
    try {
      await apiDeleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      addToast({ title: "Product Deleted", message: `Removed '${title}' from the catalog.`, type: "info" });
    } catch (err) {
      addToast({ title: "Delete Failed", message: err.message, type: "error" });
    }
  };

  const handleToggleFeatured = async (prod) => {
    try {
      const updated = await apiModerateProduct(prod.id, { is_featured: !prod.is_featured });
      setProducts((prev) => prev.map((p) => (p.id === prod.id ? { ...p, ...updated } : p)));
      addToast({ title: updated.is_featured ? "Marked Featured" : "Unmarked Featured", message: `'${prod.title}' updated.`, type: "success" });
    } catch (err) {
      addToast({ title: "Update Failed", message: err.message, type: "error" });
    }
  };

  // ----------------------------------------------------
  // ORDERS FULFILLMENT (Admin)
  // ----------------------------------------------------
  const handleAdvanceOrder = async (order) => {
    const next = order.status === "processing" ? "shipped" : order.status === "shipped" ? "delivered" : null;
    if (!next) return;
    try {
      const updated = await apiUpdateOrderStatus(order.id, { status: next });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...updated } : o)));
      addToast({ title: "Order Updated", message: `Order marked as ${next.toUpperCase()}.`, type: "success" });
    } catch (err) {
      addToast({ title: "Update Failed", message: err.message, type: "error" });
    }
  };

  // ----------------------------------------------------
  // DYNAMIC METRICS & CALCULATIONS (Live from DB)
  // ----------------------------------------------------
  const metrics = useMemo(() => {
    // 1. Total Revenue from Real Orders
    const totalRevenue = orders.reduce((sum, order) => {
      const amt = typeof order.total_amount === "number" ? order.total_amount : parseFloat(order.total_amount) || 0;
      return sum + amt;
    }, 0);

    // 2. Orders breakdown
    const completedOrders = orders.filter(o => o.status === "delivered" || o.status === "completed").length;
    const processingOrders = orders.filter(o => o.status === "processing" || o.status === "shipped").length;
    const pendingOrders = orders.filter(o => o.status === "pending" || !o.status).length;

    // 3. Users breakdown
    const superAdminsCount = users.filter(u => u.role === "super_admin").length;
    const adminsCount = users.filter(u => u.role === "admin").length;
    const vendorsCount = users.filter(u => u.role === "vendor").length;
    const customersCount = users.filter(u => u.role === "user" || !u.role).length;
    const activeUsersCount = users.filter(u => (u.status || "active").toLowerCase() === "active").length;

    // 4. Products breakdown
    const inStockProducts = products.filter(p => (parseInt(p.stock, 10) || 0) > 0).length;
    const lowStockProducts = products.filter(p => {
      const stock = parseInt(p.stock, 10) || 0;
      return stock > 0 && stock <= 5;
    }).length;

    // 5. Average Order Value (AOV)
    const aov = orders.length > 0 ? (totalRevenue / orders.length).toFixed(2) : "0.00";

    return {
      totalRevenue: totalRevenue.toFixed(2),
      totalOrders: orders.length,
      completedOrders,
      processingOrders,
      pendingOrders,
      totalUsers: users.length,
      superAdminsCount,
      adminsCount,
      vendorsCount,
      customersCount,
      activeUsersCount,
      totalProducts: products.length,
      inStockProducts,
      lowStockProducts,
      aov
    };
  }, [orders, users, products]);

  // Dynamic Chart Data points generated from DB orders timestamps & counts
  const chartData = useMemo(() => {
    const points = lastNDayBuckets(orders, timeRange === "30d" ? 30 : 7);


    const maxRev = Math.max(...points.map((r) => r.revenue), 100);
    return { points, maxRevenue: maxRev };
  }, [orders, timeRange]);

  // ----------------------------------------------------
  // SALES / CUSTOMER / INVENTORY REPORTS (real DB data)
  // ----------------------------------------------------
  const salesReport = useMemo(() => {
    const windows = salesWindows(orders);
    const growth = revenueGrowth(orders);
    const statuses = summarizeStatuses(orders);
    const repeat = computeRepeatCustomers(orders);
    const sellers = aggregateBestSellers(orders, 5);
    const inventory = summarizeInventory(products);
    const delivered = statuses.delivered + statuses.completed;
    return {
      windows,
      growth,
      statuses,
      repeat,
      sellers,
      inventory,
      deliveredRate: statuses.total > 0 ? (delivered / statuses.total) * 100 : null
    };
  }, [orders, products]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => (p.title || "").toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q));
  }, [products, productSearch]);

  const filteredOrders = useMemo(() => {
    if (ordersView === "all") return orders;
    return orders.filter((o) => String(o.status || "pending").toLowerCase() === ordersView);
  }, [orders, ordersView]);

  const customerRows = useMemo(() => customerStats(users, orders), [users, orders]);
  const visibleCustomers = useMemo(
    () => (customersView === "repeat" ? customerRows.filter((c) => c.repeat) : customerRows),
    [customerRows, customersView]
  );

  // ----------------------------------------------------
  // USER MANAGEMENT HANDLERS
  // ----------------------------------------------------
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch =
        u.full_name?.toLowerCase().includes(searchUser.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchUser.toLowerCase()) ||
        u.role?.toLowerCase().includes(searchUser.toLowerCase()) ||
        u.store_name?.toLowerCase().includes(searchUser.toLowerCase());

      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (u.status || "active").toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchUser, roleFilter, statusFilter]);

  const totalUserPages = Math.ceil(filteredUsers.length / usersPerPage) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * usersPerPage;
    return filteredUsers.slice(start, start + usersPerPage);
  }, [filteredUsers, userPage]);

  // Create User Account Handler
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!addUserForm.fullName.trim() || !addUserForm.email.trim() || !addUserForm.password.trim()) {
      addToast({ title: "Missing Information", message: "Full Name, Email, and Password are required.", type: "error" });
      return;
    }

    if (addUserForm.password.length < 6) {
      addToast({ title: "Weak Password", message: "Password must be at least 6 characters long.", type: "warning" });
      return;
    }

    setAddUserLoading(true);
    try {
      const created = await apiAdminCreateUser(addUserForm);
      setUsers(prev => [created, ...prev]);
      setShowAddUserModal(false);
      setAddUserForm({
        fullName: "",
        email: "",
        password: "",
        role: "user",
        storeName: "",
        plan: "Basic",
        billing: "Auto Debit"
      });
      addToast({
        title: "User Created Successfully",
        message: `Account for ${created.full_name} (${created.role.toUpperCase()}) is active.`,
        type: "success"
      });
    } catch (err) {
      addToast({ title: "Creation Failed", message: err.message || "Failed to create user account.", type: "error" });
    } finally {
      setAddUserLoading(false);
    }
  };

  // Open Edit User Modal
  const handleOpenEditUser = (user) => {
    setEditingUser(user);
    setEditUserForm({
      full_name: user.full_name || "",
      email: user.email || "",
      role: user.role || "user",
      status: user.status || "active",
      store_name: user.store_name || "",
      plan: user.plan || "Basic",
      billing: user.billing || "Auto Debit"
    });
  };

  // Submit Edit User Form
  const handleSaveEditUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    setEditUserLoading(true);
    try {
      const updatedUser = await apiUpdateUserDetails(editingUser.id, editUserForm);
      setUsers(prev => prev.map(u => (u.id === editingUser.id ? { ...u, ...updatedUser } : u)));
      
      if (viewingUser && viewingUser.id === editingUser.id) {
        setViewingUser({ ...viewingUser, ...updatedUser });
      }

      setEditingUser(null);
      addToast({
        title: "User Updated",
        message: `Successfully saved changes for ${updatedUser.full_name || updatedUser.email}.`,
        type: "success"
      });
    } catch (err) {
      addToast({ title: "Update Failed", message: err.message || "Failed to update user profile.", type: "error" });
    } finally {
      setEditUserLoading(false);
    }
  };

  // Handle Quick Role Promotion
  const handleQuickRoleChange = async (userId, newRole, userName) => {
    try {
      const updatedList = await apiUpdateUserRole(userId, newRole);
      setUsers(Array.isArray(updatedList) ? updatedList : prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      if (viewingUser && viewingUser.id === userId) {
        setViewingUser(prev => ({ ...prev, role: newRole }));
      }
      addToast({
        title: "Role Updated",
        message: `${userName}'s role elevated to ${newRole.toUpperCase()}.`,
        type: "success"
      });
    } catch (err) {
      addToast({ title: "Role Update Failed", message: err.message, type: "error" });
    }
  };

  // Handle Quick Status Toggle
  const handleToggleStatus = async (userId, currentStatus, userName) => {
    const nextStatus = currentStatus === "active" ? "inactive" : "active";
    try {
      await apiUpdateUserStatus(userId, nextStatus);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: nextStatus } : u));
      if (viewingUser && viewingUser.id === userId) {
        setViewingUser(prev => ({ ...prev, status: nextStatus }));
      }
      addToast({
        title: "Status Changed",
        message: `${userName} is now ${nextStatus.toUpperCase()}.`,
        type: "info"
      });
    } catch (err) {
      addToast({ title: "Status Update Failed", message: err.message, type: "error" });
    }
  };

  // Handle Password Reset
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetTargetUser || !resetNewPassword || resetNewPassword.length < 6) {
      addToast({ title: "Invalid Password", message: "Password must be at least 6 characters.", type: "error" });
      return;
    }

    setResetPasswordLoading(true);
    try {
      await apiResetUserPassword(resetTargetUser.id, resetNewPassword);
      setShowPassword(false);
      setResetTargetUser(null);
      setResetNewPassword("");
      addToast({
        title: "Password Reset Successful",
        message: `New credentials set for ${resetTargetUser.email}.`,
        type: "success"
      });
    } catch (err) {
      addToast({ title: "Password Reset Failed", message: err.message, type: "error" });
    } finally {
      setResetPasswordLoading(false);
    }
  };

  // Handle Delete User
  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setDeleteLoading(true);
    try {
      await apiDeleteUser(deletingUser.id);
      setUsers(prev => prev.filter(u => u.id !== deletingUser.id));
      if (viewingUser && viewingUser.id === deletingUser.id) {
        setViewingUser(null);
      }
      setDeletingUser(null);
      addToast({
        title: "User Deleted",
        message: `Removed ${deletingUser.full_name || deletingUser.email} from the database.`,
        type: "info"
      });
    } catch (err) {
      addToast({ title: "Delete Failed", message: err.message, type: "error" });
    } finally {
      setDeleteLoading(false);
    }
  };

  // Generate random strong password helper
  const generateRandomPassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let pass = "";
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setAddUserForm(prev => ({ ...prev, password: pass }));
    setShowPassword(true);
  };

  // Helper for Role Badges
  const renderRoleBadge = (role) => {
    switch (role) {
      case "super_admin":
        return (
          <span className="role-pill super-admin">
            <Crown size={12} className="role-icon" />
            Super Admin
          </span>
        );
      case "admin":
        return (
          <span className="role-pill admin">
            <ShieldCheck size={12} className="role-icon" />
            Admin
          </span>
        );
      case "vendor":
        return (
          <span className="role-pill vendor">
            <Store size={12} className="role-icon" />
            Vendor
          </span>
        );
      default:
        return (
          <span className="role-pill user">
            <UserIcon size={12} className="role-icon" />
            Customer
          </span>
        );
    }
  };

  // Helper for Status Badges
  const renderStatusBadge = (status) => {
    const s = (status || "active").toLowerCase();
    return (
      <span className={`status-pill ${s}`}>
        <span className="status-dot"></span>
        {s.charAt(0).toUpperCase() + s.slice(1)}
      </span>
    );
  };

  const TAB_LABELS = {
    dashboard: dashboardView === "sales" ? "Sales Report" : "Platform Dashboard",
    products: "Product Catalog",
    orders: "Orders Pipeline",
    customers: "Customer Insights",
    users: "User Management Directory"
  };

  const TAB_HEADINGS = {
    dashboard: dashboardView === "sales" ? (<>Sales <span className="gradient-text">Report</span></>) : (<>Dynamic Platform <span className="gradient-text">Overview</span></>),
    products: (<>Product <span className="gradient-text">Catalog</span></>),
    orders: (<>Orders <span className="gradient-text">Pipeline</span></>),
    customers: (<>Customer <span className="gradient-text">Insights</span></>),
    users: (<>User Accounts & <span className="gradient-text">Access Control</span></>)
  };

  return (
    <div className="admin-app-layout">
      {/* ==================================================== */}
      {/* 1. LEFT SIDEBAR                                      */}
      {/* ==================================================== */}
      <aside className="admin-sidebar">
        {/* LOGO ON LEFT TOP */}
        <div className="sidebar-brand-header">
          <div className="brand-logo-wrapper">
            <div className="brand-icon-shield">
              <Shield className="brand-shield-svg" size={24} />
              <div className="brand-sparkle-dot"></div>
            </div>
            <div className="brand-text-container">
              <div className="brand-title-row">
                <span className="brand-name">MARVEL</span>
                <span className={`brand-role-tag ${isSuperAdmin ? "super" : "admin"}`}>
                  {isSuperAdmin ? "ROOT" : "ADMIN"}
                </span>
              </div>
              <span className="brand-subtitle">
                {isSuperAdmin ? "Super Admin Platform" : "Management Console"}
              </span>
            </div>
          </div>
        </div>

        {/* ALL TABS ON LEFT SIDE (2 FOR NOW) */}
        <nav className="sidebar-navigation">
          <div className="nav-section-label">PLATFORM CONTROLS</div>

          {/* MENU 1: DASHBOARD (with submenu) */}
          <button
            id="admin-tab-dashboard"
            onClick={() => { setActiveTab("dashboard"); setDashboardView("overview"); toggleMenu("dashboard"); }}
            className={`sidebar-tab-button ${activeTab === "dashboard" ? "active" : ""}`}
            aria-expanded={!!expandedMenus.dashboard}
          >
            <div className="tab-icon-box">
              <LayoutDashboard size={19} />
            </div>
            <div className="tab-text-box">
              <span className="tab-title">Dashboard</span>
              <span className="tab-description">Live Metrics & Charts</span>
            </div>
            <span className={`sidebar-parent-chevron ${expandedMenus.dashboard ? "open" : ""}`}>
              <ChevronDown size={15} />
            </span>
            {activeTab === "dashboard" && <div className="active-glow-indicator"></div>}
          </button>
          {expandedMenus.dashboard && (
            <div className="sidebar-submenu">
              <button
                id="admin-tab-dashboard-overview"
                onClick={() => { setActiveTab("dashboard"); setDashboardView("overview"); }}
                className={`sidebar-submenu-btn ${activeTab === "dashboard" && dashboardView === "overview" ? "active" : ""}`}
              >
                <BarChart3 size={14} />
                <span>Overview</span>
              </button>
              <button
                id="admin-tab-dashboard-sales"
                onClick={() => { setActiveTab("dashboard"); setDashboardView("sales"); }}
                className={`sidebar-submenu-btn ${activeTab === "dashboard" && dashboardView === "sales" ? "active" : ""}`}
              >
                <Wallet size={14} />
                <span>Sales Report</span>
              </button>
            </div>
          )}

          {/* TAB 2: USERS */}
          <button
            id="admin-tab-users"
            onClick={() => setActiveTab("users")}
            className={`sidebar-tab-button ${activeTab === "users" ? "active" : ""}`}
          >
            <div className="tab-icon-box">
              <Users size={19} />
            </div>
            <div className="tab-text-box">
              <span className="tab-title">Users</span>
              <span className="tab-description">Accounts & Roles</span>
            </div>
            <span className="tab-badge-counter">{users.length}</span>
            {activeTab === "users" && <div className="active-glow-indicator"></div>}
          </button>

          <div className="nav-section-label">CATALOG & SALES</div>

          {/* MENU 3: PRODUCTS (with submenu) */}
          <button
            id="admin-tab-products"
            onClick={() => { setActiveTab("products"); setProductsView("list"); toggleMenu("products"); }}
            className={`sidebar-tab-button ${activeTab === "products" ? "active" : ""}`}
            aria-expanded={!!expandedMenus.products}
          >
            <div className="tab-icon-box">
              <Package size={19} />
            </div>
            <div className="tab-text-box">
              <span className="tab-title">Products</span>
              <span className="tab-description">Catalog & Inventory</span>
            </div>
            <span className="tab-badge-counter">{products.length}</span>
            <span className={`sidebar-parent-chevron ${expandedMenus.products ? "open" : ""}`}>
              <ChevronDown size={15} />
            </span>
            {activeTab === "products" && <div className="active-glow-indicator"></div>}
          </button>
          {expandedMenus.products && (
            <div className="sidebar-submenu">
              <button
                id="admin-tab-products-list"
                onClick={() => { setActiveTab("products"); setProductsView("list"); }}
                className={`sidebar-submenu-btn ${activeTab === "products" && productsView === "list" ? "active" : ""}`}
              >
                <Package size={14} />
                <span>All Products</span>
                <span className="sidebar-submenu-count">{products.length}</span>
              </button>
              <button
                id="admin-tab-products-add"
                onClick={() => { setActiveTab("products"); handleOpenAddProduct(); }}
                className={`sidebar-submenu-btn ${activeTab === "products" && productsView === "add" ? "active" : ""}`}
              >
                <Plus size={14} />
                <span>Add Product</span>
              </button>
            </div>
          )}

          {/* MENU 4: ORDERS (with submenu) */}
          <button
            id="admin-tab-orders"
            onClick={() => { setActiveTab("orders"); setOrdersView("all"); toggleMenu("orders"); }}
            className={`sidebar-tab-button ${activeTab === "orders" ? "active" : ""}`}
            aria-expanded={!!expandedMenus.orders}
          >
            <div className="tab-icon-box">
              <ClipboardList size={19} />
            </div>
            <div className="tab-text-box">
              <span className="tab-title">Orders</span>
              <span className="tab-description">Pipeline & Fulfillment</span>
            </div>
            <span className="tab-badge-counter">{orders.length}</span>
            <span className={`sidebar-parent-chevron ${expandedMenus.orders ? "open" : ""}`}>
              <ChevronDown size={15} />
            </span>
            {activeTab === "orders" && <div className="active-glow-indicator"></div>}
          </button>
          {expandedMenus.orders && (
            <div className="sidebar-submenu">
              <button
                id="admin-tab-orders-all"
                onClick={() => { setActiveTab("orders"); setOrdersView("all"); }}
                className={`sidebar-submenu-btn ${activeTab === "orders" && ordersView === "all" ? "active" : ""}`}
              >
                <ClipboardList size={14} />
                <span>All Orders</span>
                <span className="sidebar-submenu-count">{orders.length}</span>
              </button>
              <button
                id="admin-tab-orders-pending"
                onClick={() => { setActiveTab("orders"); setOrdersView("pending"); }}
                className={`sidebar-submenu-btn ${activeTab === "orders" && ordersView === "pending" ? "active" : ""}`}
              >
                <Activity size={14} />
                <span>Pending</span>
              </button>
              <button
                id="admin-tab-orders-delivered"
                onClick={() => { setActiveTab("orders"); setOrdersView("delivered"); }}
                className={`sidebar-submenu-btn ${activeTab === "orders" && ordersView === "delivered" ? "active" : ""}`}
              >
                <CheckCircle size={14} />
                <span>Delivered</span>
              </button>
            </div>
          )}

          {/* MENU 5: CUSTOMERS (with submenu) */}
          <button
            id="admin-tab-customers"
            onClick={() => { setActiveTab("customers"); setCustomersView("all"); toggleMenu("customers"); }}
            className={`sidebar-tab-button ${activeTab === "customers" ? "active" : ""}`}
            aria-expanded={!!expandedMenus.customers}
          >
            <div className="tab-icon-box">
              <Users size={19} />
            </div>
            <div className="tab-text-box">
              <span className="tab-title">Customers</span>
              <span className="tab-description">Insights & Repeat</span>
            </div>
            <span className="tab-badge-counter">{salesReport.repeat.totalCustomers}</span>
            <span className={`sidebar-parent-chevron ${expandedMenus.customers ? "open" : ""}`}>
              <ChevronDown size={15} />
            </span>
            {activeTab === "customers" && <div className="active-glow-indicator"></div>}
          </button>
          {expandedMenus.customers && (
            <div className="sidebar-submenu">
              <button
                id="admin-tab-customers-all"
                onClick={() => { setActiveTab("customers"); setCustomersView("all"); }}
                className={`sidebar-submenu-btn ${activeTab === "customers" && customersView === "all" ? "active" : ""}`}
              >
                <Users size={14} />
                <span>All Customers</span>
              </button>
              <button
                id="admin-tab-customers-repeat"
                onClick={() => { setActiveTab("customers"); setCustomersView("repeat"); }}
                className={`sidebar-submenu-btn ${activeTab === "customers" && customersView === "repeat" ? "active" : ""}`}
              >
                <Repeat size={14} />
                <span>Repeat Buyers</span>
                <span className="sidebar-submenu-count">{salesReport.repeat.repeatCustomers}</span>
              </button>
            </div>
          )}
        </nav>

        {/* SIDEBAR FOOTER: USER PROFILE & SIGNOUT BUTTON */}
        <div className="sidebar-footer">
          {/* Authenticated User Profile Snippet */}
          <div className="sidebar-user-card">
            <div className="user-avatar-circle">
              {currentUser?.full_name ? currentUser.full_name.charAt(0).toUpperCase() : currentUser?.email ? currentUser.email.charAt(0).toUpperCase() : "A"}
              <div className="online-indicator"></div>
            </div>
            <div className="user-details-mini">
              <span className="user-display-name">
                {currentUser?.full_name || (currentUser?.email ? currentUser.email.split("@")[0] : "Administrator")}
              </span>
              <span className="user-display-email">
                {currentUser?.email || "admin@marvel.com"}
              </span>
              <div className="user-role-badge-row">
                {renderRoleBadge(isSuperAdmin ? "super_admin" : currentRole || "admin")}
              </div>
            </div>
          </div>

          {/* Action Links: Storefront Shortcut + Signout Button */}
          <div className="sidebar-actions-group">
            <button
              onClick={() => onNavigateHome ? onNavigateHome() : (window.location.hash = "#/")}
              className="storefront-link-btn"
              title="Return to Customer Storefront"
            >
              <Store size={16} />
              <span>View Storefront</span>
              <ArrowUpRight size={14} className="link-arrow" />
            </button>

            {/* HIGH-VISIBILITY SIGNOUT BUTTON */}
            <button
              id="admin-signout-button"
              onClick={handleSignOut}
              className="signout-action-button"
            >
              <LogOut size={17} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ==================================================== */}
      {/* 2. MAIN CONTENT AREA                                 */}
      {/* ==================================================== */}
      <main className="admin-main-viewport">
        {/* TOP STATUS & ACTION BAR */}
        <header className="main-top-navbar">
          <div className="navbar-title-block">
            <div className="navbar-breadcrumb">
              <span>Marvel</span>
              <ChevronRight size={14} />
              <span>{isSuperAdmin ? "Super Admin" : "Admin"}</span>
              <ChevronRight size={14} />
              <span className="current-page-label">
                {TAB_LABELS[activeTab] || TAB_LABELS.dashboard}
              </span>
            </div>
            <h1 className="navbar-page-heading">
              {TAB_HEADINGS[activeTab] || TAB_HEADINGS.dashboard}
            </h1>
          </div>

          <div className="navbar-actions-block">
            {/* Live Database Sync Indicator */}
            <div className="db-status-pill">
              <span className="pulse-green-dot"></span>
              <span className="db-status-text">Supabase DB Live</span>
            </div>

            {/* Refresh Data Button */}
            <Button
              variant="outline"
              onClick={loadDashboardData}
              disabled={refreshing}
              className="refresh-db-btn"
            >
              <RefreshCw size={15} className={refreshing ? "spin-animation" : ""} />
              <span>{refreshing ? "Syncing..." : "Refresh DB"}</span>
            </Button>

            {/* Quick Add User Shortcut */}
            <Button
              onClick={() => {
                setActiveTab("users");
                setShowAddUserModal(true);
              }}
              className="quick-add-user-btn"
            >
              <Plus size={16} />
              <span>Add User</span>
            </Button>
          </div>
        </header>

        {/* ================================================== */}
        {/* TAB 1: DYNAMIC DASHBOARD (Charts & Live DB Data)   */}
        {/* ================================================== */}
{activeTab === "dashboard" && dashboardView === "overview" && (
          <div className="dashboard-tab-view animate-fade-in">
            {/* KPI STATS CARDS GRID */}
            <div className="metrics-cards-grid">
              {/* Card 1: Total Revenue */}
              <div className="kpi-metric-card revenue-card">
                <div className="kpi-card-header">
                  <span className="kpi-label">TOTAL PLATFORM REVENUE</span>
                  <div className="kpi-icon-bubble emerald">
                    <DollarSign size={20} />
                  </div>
                </div>
                <div className="kpi-value-row">
                  <span className="kpi-currency">$</span>
                  <span className="kpi-number">{metrics.totalRevenue}</span>
                </div>
                <div className="kpi-footer-row">
                  {salesReport.growth.percent === null ? (
                    <span className="kpi-subtext">First week of sales data</span>
                  ) : (
                    <span className={`kpi-growth-badge ${salesReport.growth.percent >= 0 ? "positive" : "negative"}`}>
                      <TrendingUp size={13} />
                      {salesReport.growth.percent >= 0 ? "+" : ""}{salesReport.growth.percent.toFixed(1)}%
                    </span>
                  )}
                  <span className="kpi-subtext">Avg Order: ${metrics.aov}</span>
                </div>
              </div>

              {/* Card 2: Total Orders */}
              <div className="kpi-metric-card orders-card">
                <div className="kpi-card-header">
                  <span className="kpi-label">TOTAL ORDERS PLACED</span>
                  <div className="kpi-icon-bubble blue">
                    <ShoppingBag size={20} />
                  </div>
                </div>
                <div className="kpi-value-row">
                  <span className="kpi-number">{metrics.totalOrders}</span>
                </div>
                <div className="kpi-footer-row">
                  <span className="kpi-status-tag completed">{metrics.completedOrders} Delivered</span>
                  <span className="kpi-status-tag processing">{metrics.processingOrders} In Flight</span>
                </div>
              </div>

              {/* Card 3: Registered Users */}
              <div className="kpi-metric-card users-card">
                <div className="kpi-card-header">
                  <span className="kpi-label">REGISTERED USERS (DB)</span>
                  <div className="kpi-icon-bubble purple">
                    <Users size={20} />
                  </div>
                </div>
                <div className="kpi-value-row">
                  <span className="kpi-number">{metrics.totalUsers}</span>
                </div>
                <div className="kpi-footer-row">
                  <span className="kpi-subtext">
                    {metrics.vendorsCount} Vendors • {metrics.customersCount} Customers
                  </span>
                </div>
              </div>

              {/* Card 4: Catalog Products */}
              <div className="kpi-metric-card products-card">
                <div className="kpi-card-header">
                  <span className="kpi-label">ACTIVE CATALOG ITEMS</span>
                  <div className="kpi-icon-bubble amber">
                    <Package size={20} />
                  </div>
                </div>
                <div className="kpi-value-row">
                  <span className="kpi-number">{metrics.totalProducts}</span>
                </div>
                <div className="kpi-footer-row">
                  <span className="kpi-subtext">
                    {metrics.inStockProducts} In Stock • {metrics.lowStockProducts} Low Stock
                  </span>
                </div>
              </div>
            </div>

            {/* DYNAMIC CHARTS & ANALYTICS SECTION */}
            <div className="dashboard-charts-grid">
              {/* CHART 1: REVENUE & SALES TIMELINE (INTERACTIVE SVG CHART) */}
              <div className="dashboard-chart-card revenue-chart-span">
                <div className="chart-card-header">
                  <div>
                    <h3 className="chart-title">Revenue & Sales Trends</h3>
                    <p className="chart-subtitle">Real-time dynamic aggregation from Supabase database</p>
                  </div>
                  <div className="chart-controls-group">
                    <button
                      onClick={() => setTimeRange("7d")}
                      className={`chart-pill-btn ${timeRange === "7d" ? "active" : ""}`}
                    >
                      Last 7 Days
                    </button>
                    <button
                      onClick={() => setTimeRange("30d")}
                      className={`chart-pill-btn ${timeRange === "30d" ? "active" : ""}`}
                    >
                      30 Days
                    </button>
                  </div>
                </div>

                {/* SVG & HTML Interactive Dynamic Bar & Wave Chart */}
                <div className="interactive-chart-container">
                  <div className="chart-bars-wrapper">
                    {chartData.points.map((point, idx) => {
                      const heightPercent = Math.max(15, Math.round((point.revenue / chartData.maxRevenue) * 100));
                      return (
                        <div key={idx} className="chart-bar-column group">
                          {/* Tooltip on Hover */}
                          <div className="chart-bar-tooltip">
                            <span className="tooltip-date">{point.label}</span>
                            <span className="tooltip-revenue">${point.revenue.toFixed(2)}</span>
                            <span className="tooltip-orders">{point.ordersCount} Orders</span>
                          </div>

                          {/* Bar Graphic */}
                          <div className="bar-track">
                            <div
                              className="bar-fill-gradient"
                              style={{ height: `${heightPercent}%` }}
                            >
                              <div className="bar-glow-cap"></div>
                            </div>
                          </div>

                          {/* Day Label */}
                          <span className="bar-day-label">{point.day}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Chart Summary Badges */}
                <div className="chart-bottom-metrics">
                  <div className="bottom-metric-item">
                    <span className="dot emerald"></span>
                    <span className="label">Peak Day Revenue:</span>
                    <span className="val">${chartData.maxRevenue.toFixed(2)}</span>
                  </div>
                  <div className="bottom-metric-item">
                    <span className="dot blue"></span>
                    <span className="label">Orders Pipeline:</span>
                    <span className="val">{metrics.totalOrders} Active</span>
                  </div>
                  <div className="bottom-metric-item">
                    <span className="dot purple"></span>
                    <span className="label">Delivered Rate:</span>
                    <span className="val">{salesReport.deliveredRate === null ? "No orders yet" : `${salesReport.deliveredRate.toFixed(1)}%`}</span>
                  </div>
                </div>
              </div>

              {/* CHART 2: USER ROLE & DEMOGRAPHICS DISTRIBUTION */}
              <div className="dashboard-chart-card user-demographics-card">
                <div className="chart-card-header">
                  <div>
                    <h3 className="chart-title">User Distribution</h3>
                    <p className="chart-subtitle">Breakdown by assigned account roles</p>
                  </div>
                  <Users size={18} className="text-muted" />
                </div>

                <div className="role-distribution-layout">
                  {/* Radial / Donut representation */}
                  <div className="donut-chart-container">
                    <svg viewBox="0 0 100 100" className="donut-svg">
                      <circle cx="50" cy="50" r="38" className="donut-ring-base" />
                      {/* Super Admin Segment */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        className="donut-segment super-admin"
                        strokeDasharray={`${Math.max(5, (metrics.superAdminsCount / Math.max(1, metrics.totalUsers)) * 238)} 238`}
                        strokeDashoffset="0"
                      />
                      {/* Admin Segment */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        className="donut-segment admin"
                        strokeDasharray={`${Math.max(8, (metrics.adminsCount / Math.max(1, metrics.totalUsers)) * 238)} 238`}
                        strokeDashoffset={`-${(metrics.superAdminsCount / Math.max(1, metrics.totalUsers)) * 238}`}
                      />
                      {/* Vendor Segment */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        className="donut-segment vendor"
                        strokeDasharray={`${Math.max(15, (metrics.vendorsCount / Math.max(1, metrics.totalUsers)) * 238)} 238`}
                        strokeDashoffset={`-${((metrics.superAdminsCount + metrics.adminsCount) / Math.max(1, metrics.totalUsers)) * 238}`}
                      />
                    </svg>
                    <div className="donut-center-text">
                      <span className="donut-total">{metrics.totalUsers}</span>
                      <span className="donut-label">Users</span>
                    </div>
                  </div>

                  {/* Legend List */}
                  <div className="role-legend-list">
                    <div className="legend-row">
                      <div className="legend-color-dot purple"></div>
                      <span className="legend-name">Super Admins</span>
                      <span className="legend-count">{metrics.superAdminsCount}</span>
                    </div>
                    <div className="legend-row">
                      <div className="legend-color-dot blue"></div>
                      <span className="legend-name">Platform Admins</span>
                      <span className="legend-count">{metrics.adminsCount}</span>
                    </div>
                    <div className="legend-row">
                      <div className="legend-color-dot emerald"></div>
                      <span className="legend-name">Store Vendors</span>
                      <span className="legend-count">{metrics.vendorsCount}</span>
                    </div>
                    <div className="legend-row">
                      <div className="legend-color-dot slate"></div>
                      <span className="legend-name">Customers</span>
                      <span className="legend-count">{metrics.customersCount}</span>
                    </div>
                  </div>
                </div>

                <div className="chart-card-footer-action">
                  <Button
                    variant="outline"
                    className="full-width-btn"
                    onClick={() => setActiveTab("users")}
                  >
                    Manage User Accounts Directory <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            </div>

            {/* RECENT LIVE ORDERS FEED (DYNAMIC FROM DB) */}
            <div className="recent-orders-card">
              <div className="chart-card-header">
                <div>
                  <h3 className="chart-title">Recent Platform Transactions</h3>
                  <p className="chart-subtitle">Latest order records fetched live from database</p>
                </div>
                <span className="orders-counter-badge">{orders.length} Records</span>
              </div>

              <div className="table-responsive-wrapper">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>ORDER ID</th>
                      <th>CUSTOMER</th>
                      <th>ITEMS</th>
                      <th>TOTAL AMOUNT</th>
                      <th>STATUS</th>
                      <th>DATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="empty-table-cell">
                          <ShoppingBag size={28} className="empty-icon" />
                          <p>No orders recorded in database yet.</p>
                        </td>
                      </tr>
                    ) : (
                      orders.slice(0, 5).map((order, idx) => (
                        <tr key={order.id || idx}>
                          <td className="font-mono text-primary font-bold">
                            #{String(order.id).substring(0, 8)}
                          </td>
                          <td>
                            <div className="customer-info-cell">
                              <span className="customer-name">{order.customer_name || "Marvel Shopper"}</span>
                              <span className="customer-email">{order.customer_email || "user@marvel.com"}</span>
                            </div>
                          </td>
                          <td>{Array.isArray(order.items) ? order.items.length : 1} items</td>
                          <td className="font-bold text-emerald">
                            ${typeof order.total_amount === "number" ? order.total_amount.toFixed(2) : parseFloat(order.total_amount || 0).toFixed(2)}
                          </td>
                          <td>
                            <span className={`status-pill ${order.status || "processing"}`}>
                              <span className="status-dot"></span>
                              {order.status || "Processing"}
                            </span>
                          </td>
                          <td className="text-muted text-sm">
                            {order.created_at ? new Date(order.created_at).toLocaleDateString() : "Today"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
{activeTab === "dashboard" && dashboardView === "sales" && (
            <div className="dashboard-tab-view animate-fade-in">
              {/* Sales window KPI cards */}
              <div className="sales-mini-grid">
                <div className="sales-mini-card teal">
                  <span className="sales-mini-label">Today Orders</span>
                  <span className="sales-mini-value">${salesReport.windows.today.revenue.toFixed(2)}</span>
                  <span className="sales-mini-sub">{salesReport.windows.today.orders} orders today</span>
                </div>
                <div className="sales-mini-card orange">
                  <span className="sales-mini-label">Yesterday Orders</span>
                  <span className="sales-mini-value">${salesReport.windows.yesterday.revenue.toFixed(2)}</span>
                  <span className="sales-mini-sub">{salesReport.windows.yesterday.orders} orders yesterday</span>
                </div>
                <div className="sales-mini-card blue">
                  <span className="sales-mini-label">This Month</span>
                  <span className="sales-mini-value">${salesReport.windows.thisMonth.revenue.toFixed(2)}</span>
                  <span className="sales-mini-sub">{salesReport.windows.thisMonth.orders} orders this month</span>
                </div>
                <div className="sales-mini-card green">
                  <span className="sales-mini-label">Last Month</span>
                  <span className="sales-mini-value">${salesReport.windows.lastMonth.revenue.toFixed(2)}</span>
                  <span className="sales-mini-sub">{salesReport.windows.lastMonth.orders} orders last month</span>
                </div>
              </div>

              {/* Pipeline + best sellers */}
              <div className="reports-grid-2">
                <div className="report-card">
                  <div className="chart-card-header">
                    <div>
                      <h3 className="chart-title">Orders Pipeline</h3>
                      <p className="chart-subtitle">Live fulfillment stages from the database</p>
                    </div>
                    <ClipboardList size={18} className="text-muted" />
                  </div>
                  {[["Pending", salesReport.statuses.pending, "slate"], ["Processing", salesReport.statuses.processing, "amber"], ["Shipped", salesReport.statuses.shipped, ""], ["Delivered", salesReport.statuses.delivered, "emerald"], ["Cancelled", salesReport.statuses.cancelled, "rose"]].map(([label, count, tone]) => (
                    <div key={label} className="pipeline-row">
                      <span className="pipeline-label">{label}</span>
                      <div className="pipeline-bar-track">
                        <div
                          className={`pipeline-bar-fill ${tone}`}
                          style={{ width: `${salesReport.statuses.total > 0 ? Math.round((count / salesReport.statuses.total) * 100) : 0}%` }}
                        />
                      </div>
                      <span className="pipeline-count">{count}</span>
                    </div>
                  ))}
                </div>
                <div className="report-card">
                  <div className="chart-card-header">
                    <div>
                      <h3 className="chart-title">Best Selling Products</h3>
                      <p className="chart-subtitle">Ranked by revenue from order line items</p>
                    </div>
                    <Star size={18} className="text-muted" />
                  </div>
                  {salesReport.sellers.length === 0 ? (
                    <p className="report-empty">No product sales recorded yet.</p>
                  ) : (
                    salesReport.sellers.map((item, i) => (
                      <div key={item.title} className="topseller-row">
                        <span className="topseller-rank">{i + 1}</span>
                        {item.image ? <img src={item.image} alt={item.title} className="topseller-img" /> : null}
                        <div className="topseller-info">
                          <div className="topseller-name">{item.title}</div>
                          <div className="topseller-meta">{item.qty} sold</div>
                        </div>
                        <span className="topseller-rev">${item.revenue.toFixed(2)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Repeat buyers + inventory */}
              <div className="reports-grid-2">
                <div className="report-card">
                  <div className="chart-card-header">
                    <div>
                      <h3 className="chart-title">Repeat Customers</h3>
                      <p className="chart-subtitle">Shoppers who ordered more than once</p>
                    </div>
                    <Repeat size={18} className="text-muted" />
                  </div>
                  <p style={{ fontSize: 13, color: "#475569", margin: "0 0 8px 0" }}>
                    <strong style={{ color: "#0f172a" }}>{salesReport.repeat.repeatRate.toFixed(1)}%</strong>
                    {` of ${salesReport.repeat.totalCustomers} customers bought more than once`}
                  </p>
                  {salesReport.repeat.top.length === 0 ? (
                    <p className="report-empty">No repeat buyers yet.</p>
                  ) : (
                    salesReport.repeat.top.map((buyer) => (
                      <div key={buyer.key} className="repeat-row">
                        <div className="repeat-avatar">{(buyer.name || "M").charAt(0).toUpperCase()}</div>
                        <div className="repeat-info">
                          <div className="repeat-name">{buyer.name}</div>
                          <div className="repeat-meta">{buyer.email || "no email"} • {buyer.orders} orders</div>
                        </div>
                        <span className="topseller-rev">${buyer.spent.toFixed(2)}</span>
                        <span className="repeat-badge">Repeat</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="report-card">
                  <div className="chart-card-header">
                    <div>
                      <h3 className="chart-title">Inventory Snapshot</h3>
                      <p className="chart-subtitle">Catalog value at current selling price</p>
                    </div>
                    <Boxes size={18} className="text-muted" />
                  </div>
                  <p style={{ fontSize: 13, color: "#475569", margin: "0 0 8px 0" }}>
                    Catalog value: 
                    <strong style={{ color: "#0f172a" }}>${salesReport.inventory.value.toFixed(2)}</strong>
                  </p>
                  {[
                    ["In Stock", salesReport.inventory.inStock, "ok"],
                    ["Low Stock (5 or fewer)", salesReport.inventory.lowStock, "low"],
                    ["Out of Stock", salesReport.inventory.outOfStock, "out"]
                  ].map(([label, count, tone]) => (
                    <div key={label} className="pipeline-row">
                      <span className="pipeline-label">{label}</span>
                      <div className="pipeline-bar-track">
                        <div
                          className={`pipeline-bar-fill ${tone === "ok" ? "emerald" : tone === "low" ? "amber" : "rose"}`}
                          style={{ width: `${salesReport.inventory.total > 0 ? Math.round((count / salesReport.inventory.total) * 100) : 0}%` }}
                        />
                      </div>
                      <span className="pipeline-count">{count}</span>
                    </div>
                  ))}
                  <div className="chart-card-footer-action">
                    <Button
                      variant="outline"
                      className="full-width-btn"
                      onClick={() => { setActiveTab("products"); setProductsView("list"); }}
                    >
                      Manage Product Catalog <ChevronRight size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
        )}

        {/* ================================================== */}
        {/* TAB 2: USERS MANAGEMENT (Add, View, Edit, Roles)   */}
        {/* ================================================== */}
        {activeTab === "users" && (
          <div className="users-tab-view animate-fade-in">
            {/* SEARCH & FILTERS CONTROL BAR */}
            <div className="users-control-toolbar">
              <div className="search-input-wrapper">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search by name, email, role, or store..."
                  value={searchUser}
                  onChange={(e) => {
                    setSearchUser(e.target.value);
                    setUserPage(1);
                  }}
                  className="users-search-field"
                />
                {searchUser && (
                  <button onClick={() => setSearchUser("")} className="clear-search-btn">
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="toolbar-filters-group">
                {/* Role Filter */}
                <div className="filter-select-wrapper">
                  <Filter size={14} className="filter-icon" />
                  <select
                    value={roleFilter}
                    onChange={(e) => {
                      setRoleFilter(e.target.value);
                      setUserPage(1);
                    }}
                    className="filter-dropdown"
                  >
                    <option value="all">All Roles</option>
                    <option value="super_admin">Super Admin</option>
                    <option value="admin">Platform Admin</option>
                    <option value="vendor">Vendor / Seller</option>
                    <option value="user">Customer</option>
                  </select>
                </div>

                {/* Status Filter */}
                <div className="filter-select-wrapper">
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setUserPage(1);
                    }}
                    className="filter-dropdown"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>

                {/* PRIMARY ADD USER BUTTON */}
                <Button
                  id="admin-add-user-button"
                  onClick={() => setShowAddUserModal(true)}
                  className="add-user-primary-btn"
                >
                  <Plus size={16} />
                  <span>Add User</span>
                </Button>
              </div>
            </div>

            {/* USERS DATA TABLE */}
            <div className="users-table-card">
              <div className="table-card-top-info">
                <span className="results-count">
                  Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> registered accounts in Supabase DB
                </span>
                <div className="table-actions-right">
                  <button
                    onClick={loadDashboardData}
                    className="refresh-icon-btn"
                    title="Refresh user list from database"
                  >
                    <RefreshCw size={14} className={refreshing ? "spin-animation" : ""} />
                  </button>
                </div>
              </div>

              <div className="table-responsive-wrapper">
                <table className="admin-data-table users-table">
                  <thead>
                    <tr>
                      <th>USER</th>
                      <th>ROLE</th>
                      <th>STATUS</th>
                      <th>STORE / PLAN</th>
                      <th>JOINED</th>
                      <th className="text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="empty-table-cell">
                          <Users size={32} className="empty-icon" />
                          <p>No user accounts found matching your filters.</p>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setSearchUser("");
                              setRoleFilter("all");
                              setStatusFilter("all");
                            }}
                            className="mt-2"
                          >
                            Reset Filters
                          </Button>
                        </td>
                      </tr>
                    ) : (
                      paginatedUsers.map((userItem) => (
                        <tr key={userItem.id} className="user-table-row">
                          {/* User Avatar + Name + Email */}
                          <td>
                            <div className="user-profile-cell">
                              <div className={`user-table-avatar ${userItem.role}`}>
                                {userItem.full_name
                                  ? userItem.full_name.charAt(0).toUpperCase()
                                  : userItem.email
                                  ? userItem.email.charAt(0).toUpperCase()
                                  : "U"}
                              </div>
                              <div className="user-meta-column">
                                <span className="user-full-name">{userItem.full_name || "Unnamed User"}</span>
                                <span className="user-email-text">{userItem.email}</span>
                              </div>
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td>{renderRoleBadge(userItem.role)}</td>

                          {/* Status Badge */}
                          <td>{renderStatusBadge(userItem.status)}</td>

                          {/* Store / Plan Info */}
                          <td>
                            <div className="store-plan-info">
                              {userItem.role === "vendor" ? (
                                <span className="store-name-tag">
                                  <Store size={12} />
                                  {userItem.store_name || "Seller Store"}
                                </span>
                              ) : (
                                <span className="plan-name-tag">
                                  {userItem.plan || (userItem.role === "super_admin" || userItem.role === "admin" ? "Enterprise" : "Basic")}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Joined Date */}
                          <td className="text-muted text-sm font-mono">
                            {userItem.created_at
                              ? new Date(userItem.created_at).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric"
                                })
                              : "Active"}
                          </td>

                          {/* ACTION BUTTONS (VIEW, EDIT, ROLE, PASSWORD, DELETE) */}
                          <td className="text-right">
                            <div className="user-actions-row">
                              {/* 1. VIEW USER BUTTON */}
                              <button
                                onClick={() => setViewingUser(userItem)}
                                className="action-btn view-btn"
                                title="View User Details"
                              >
                                <Eye size={15} />
                              </button>

                              {/* 2. EDIT USER BUTTON */}
                              <button
                                onClick={() => handleOpenEditUser(userItem)}
                                className="action-btn edit-btn"
                                title="Edit User Details"
                              >
                                <Edit2 size={15} />
                              </button>

                              {/* 3. RESET PASSWORD BUTTON */}
                              <button
                                onClick={() => {
                                  setResetTargetUser(userItem);
                                  setResetNewPassword("");
                                }}
                                className="action-btn key-btn"
                                title="Reset User Password"
                              >
                                <Key size={15} />
                              </button>

                              {/* 4. DELETE USER BUTTON */}
                              <button
                                onClick={() => setDeletingUser(userItem)}
                                className="action-btn delete-btn"
                                title="Delete User Account"
                                disabled={userItem.id === currentUser?.id}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* TABLE PAGINATION */}
              {totalUserPages > 1 && (
                <div className="table-pagination-footer">
                  <span className="pagination-info">
                    Page {userPage} of {totalUserPages}
                  </span>
                  <div className="pagination-buttons">
                    <Button
                      variant="outline"
                      disabled={userPage === 1}
                      onClick={() => setUserPage(p => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      disabled={userPage === totalUserPages}
                      onClick={() => setUserPage(p => Math.min(totalUserPages, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* TAB 3: PRODUCT CATALOG (list, add, edit, feature)  */}
        {/* ================================================== */}
        {activeTab === "products" && (
          <div className="dashboard-tab-view animate-fade-in">
            <div className="products-toolbar">
              <div className="search-input-wrapper">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search catalog by title or category..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="users-search-field"
                />
              </div>
              <Button
                id="admin-add-product-button"
                onClick={handleOpenAddProduct}
                className="add-user-primary-btn"
              >
                <Plus size={16} />
                <span>Add Product</span>
              </Button>
            </div>

            {productsView === "add" && (
              <div className="product-form-card">
                <div className="chart-card-header">
                  <div>
                    <h3 className="chart-title">{editingProduct ? "Edit Product" : "Add Product"}</h3>
                    <p className="chart-subtitle">{editingProduct ? "Updates go live on the storefront immediately." : "New products publish straight to the storefront."}</p>
                  </div>
                </div>
                <form onSubmit={handleSaveProduct} className="modal-form">
                  <div className="form-group-row">
                    <div className="form-group">
                      <label className="form-label">Product Title *</label>
                      <Input required type="text" placeholder="e.g. Aurora Wireless Speaker" value={productForm.title} onChange={(e) => setProductForm((prev) => ({ ...prev, title: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Category</label>
                      <select value={productForm.category} onChange={(e) => setProductForm((prev) => ({ ...prev, category: e.target.value }))} className="form-select-field">
                        {["Electronics", "Fashion", "Home", "Beauty", "Wearables", "Sports", "Grocery", "Toys"].map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-group-row">
                    <div className="form-group">
                      <label className="form-label">Price (Rs) *</label>
                      <Input required type="number" min="0" step="0.01" placeholder="e.g. 4999" value={productForm.price} onChange={(e) => setProductForm((prev) => ({ ...prev, price: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Original Price (Rs)</label>
                      <Input type="number" min="0" step="0.01" placeholder="Optional" value={productForm.original_price} onChange={(e) => setProductForm((prev) => ({ ...prev, original_price: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Stock Units</label>
                      <Input type="number" min="0" step="1" placeholder="15" value={productForm.stock} onChange={(e) => setProductForm((prev) => ({ ...prev, stock: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Image URL</label>
                    <Input type="text" placeholder="https://..." value={productForm.image_url} onChange={(e) => setProductForm((prev) => ({ ...prev, image_url: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <Input type="text" placeholder="Short product description" value={productForm.description} onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))} />
                  </div>
                  <div className="modal-actions-footer">
                    <Button type="button" variant="outline" onClick={() => { setEditingProduct(null); setProductsView("list"); }}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={productSaving} className="submit-primary-btn">
                      {productSaving ? (
                        <><RefreshCw size={15} className="spin-animation" /> Saving...</>
                      ) : (
                        <><Check size={16} /> {editingProduct ? "Save Changes" : "Publish Product"}</>
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            <div className="users-table-card">
              <div className="table-card-top-info">
                <span className="results-count">
                  Showing <strong>{filteredProducts.length}</strong> of <strong>{products.length}</strong> catalog items
                </span>
              </div>
              <div className="table-responsive-wrapper">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>PRODUCT</th>
                      <th>CATEGORY</th>
                      <th>PRICE</th>
                      <th>STOCK</th>
                      <th>FEATURED</th>
                      <th className="text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="empty-table-cell">
                          <Package size={28} className="empty-icon" />
                          <p>No products found. Add your first product to the catalog.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((prod) => {
                        const stockCount = parseInt(prod.stock, 10) || 0;
                        return (
                        <tr key={prod.id}>
                          <td>
                            <div className="product-cell">
                              {(prod.image_url || prod.image) ? <img src={prod.image_url || prod.image} alt={prod.title} className="product-thumb" /> : null}
                              <div>
                                <div className="product-title-text">{prod.title}</div>
                                <div className="product-sku-text">{prod.sku || String(prod.id).substring(0, 8)}</div>
                              </div>
                            </div>
                          </td>
                          <td>{prod.category}</td>
                          <td className="font-bold">
                            ${parseFloat(prod.price || 0).toFixed(2)}
                            {prod.original_price ? <span className="text-muted text-sm"> <s>${parseFloat(prod.original_price).toFixed(2)}</s></span> : null}
                          </td>
                          <td>
                            <span className={`stock-pill ${stockCount <= 0 ? "out" : stockCount <= 5 ? "low" : "ok"}`}>
                              {stockCount} in stock
                            </span>
                          </td>
                          <td>
                            <button
                              className="feature-star-btn"
                              onClick={() => handleToggleFeatured(prod)}
                              title={prod.is_featured ? "Remove featured flag" : "Mark as featured"}
                              aria-label={prod.is_featured ? `Unmark ${prod.title} as featured` : `Mark ${prod.title} as featured`}
                              aria-pressed={!!prod.is_featured}
                            >
                              <Star size={17} color={prod.is_featured ? "#f59e0b" : "#cbd5e1"} fill={prod.is_featured ? "#f59e0b" : "none"} />
                            </button>
                          </td>
                          <td className="text-right">
                            <div className="user-actions-row">
                              <button
                                onClick={() => handleOpenEditProduct(prod)}
                                className="action-btn edit-btn"
                                title="Edit product"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(prod.id, prod.title)}
                                className="action-btn delete-btn"
                                title="Delete product"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* TAB 4: ORDERS PIPELINE (filter + fulfillment)      */}
        {/* ================================================== */}
        {activeTab === "orders" && (
          <div className="dashboard-tab-view animate-fade-in">
            <div className="report-pills-row">
              {[["all", "All Orders", orders.length], ["pending", "Pending", salesReport.statuses.pending], ["processing", "Processing", salesReport.statuses.processing], ["shipped", "Shipped", salesReport.statuses.shipped], ["delivered", "Delivered", salesReport.statuses.delivered]].map(([value, label, count]) => (
                <button
                  key={value}
                  onClick={() => setOrdersView(value)}
                  className={`chart-pill-btn ${ordersView === value ? "active" : ""}`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>
            <div className="users-table-card">
              <div className="table-card-top-info">
                <span className="results-count">
                  Showing <strong>{filteredOrders.length}</strong> of <strong>{orders.length}</strong> order records
                </span>
              </div>
              <div className="table-responsive-wrapper">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>ORDER ID</th>
                      <th>CUSTOMER</th>
                      <th>ITEMS</th>
                      <th>TOTAL AMOUNT</th>
                      <th>STATUS</th>
                      <th>DATE</th>
                      <th className="text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="empty-table-cell">
                          <ClipboardList size={28} className="empty-icon" />
                          <p>No orders in this stage yet.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.slice(0, 20).map((order, idx) => (
                        <tr key={order.id || idx}>
                          <td className="font-mono text-primary font-bold">#{String(order.id).substring(0, 8)}</td>
                          <td>
                            <div className="customer-info-cell">
                              <span className="customer-name">{order.customer_name || "Marvel Shopper"}</span>
                              <span className="customer-email">{order.customer_email || "user@marvel.com"}</span>
                            </div>
                          </td>
                          <td>{Array.isArray(order.items) ? order.items.length : 1} items</td>
                          <td className="font-bold text-emerald">${typeof order.total_amount === "number" ? order.total_amount.toFixed(2) : parseFloat(order.total_amount || 0).toFixed(2)}</td>
                          <td>
                            <span className={`status-pill ${order.status || "processing"}`}>
                              <span className="status-dot"></span>
                              {order.status || "Processing"}
                            </span>
                          </td>
                          <td className="text-muted text-sm">
                            {order.created_at ? new Date(order.created_at).toLocaleDateString() : "Today"}
                          </td>
                          <td className="text-right">
                            {order.status === "processing" || order.status === "shipped" ? (
                              <Button variant="outline" size="sm" onClick={() => handleAdvanceOrder(order)}>
                                Mark {order.status === "processing" ? "Shipped" : "Delivered"}
                              </Button>
                            ) : (
                              <span className="text-muted text-sm">No action</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* TAB 5: CUSTOMER INSIGHTS (all + repeat buyers)     */}
        {/* ================================================== */}
        {activeTab === "customers" && (
          <div className="dashboard-tab-view animate-fade-in">
            <div className="report-pills-row">
              <button
                onClick={() => setCustomersView("all")}
                className={`chart-pill-btn ${customersView === "all" ? "active" : ""}`}
              >
                All Customers ({customerRows.length})
              </button>
              <button
                onClick={() => setCustomersView("repeat")}
                className={`chart-pill-btn ${customersView === "repeat" ? "active" : ""}`}
              >
                Repeat Buyers ({salesReport.repeat.repeatCustomers})
              </button>
            </div>
            <div className="users-table-card">
              <div className="table-card-top-info">
                <span className="results-count">
                  Showing <strong>{visibleCustomers.length}</strong> customers
                </span>
              </div>
              <div className="table-responsive-wrapper">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>CUSTOMER</th>
                      <th>ORDERS</th>
                      <th>TOTAL SPENT</th>
                      <th>LAST ORDER</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="empty-table-cell">
                          <Users size={28} className="empty-icon" />
                          <p>No customers in this segment yet.</p>
                        </td>
                      </tr>
                    ) : (
                      visibleCustomers.slice(0, 20).map((cust) => (
                        <tr key={cust.id || cust.email}>
                          <td>
                            <div className="user-profile-cell">
                              <div className="user-table-avatar user">{(cust.name || "M").charAt(0).toUpperCase()}</div>
                              <div className="user-meta-column">
                                <span className="user-full-name">{cust.name}</span>
                                <span className="user-email-text">{cust.email || "no email on file"}</span>
                              </div>
                            </div>
                          </td>
                          <td className="font-bold">{cust.orders}</td>
                          <td className="font-bold text-emerald">${cust.spent.toFixed(2)}</td>
                          <td className="text-muted text-sm">
                            {cust.lastOrderAt ? new Date(cust.lastOrderAt).toLocaleDateString() : "Never"}
                          </td>
                          <td>{cust.repeat ? <span className="repeat-badge">Repeat Buyer</span> : renderStatusBadge(cust.status)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ==================================================== */}
      {/* 3. MODALS & POPUPS                                   */}
      {/* ==================================================== */}

      {/* ---------------------------------------------------- */}
      {/* MODAL 1: ADD NEW USER                                */}
      {/* ---------------------------------------------------- */}
      {showAddUserModal && (
        <div className="modal-backdrop-overlay">
          <div className="modal-content-container animate-scale-up">
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <div className="modal-icon-bubble purple">
                  <Plus size={20} />
                </div>
                <div>
                  <h3 className="modal-title">Create User Account</h3>
                  <p className="modal-subtitle">Add a new authenticated user profile to Supabase database</p>
                </div>
              </div>
              <button onClick={() => setShowAddUserModal(false)} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="modal-form">
              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <Input
                    required
                    type="text"
                    placeholder="e.g. Alex Morgan"
                    value={addUserForm.fullName}
                    onChange={(e) => setAddUserForm(prev => ({ ...prev, fullName: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <Input
                    required
                    type="email"
                    placeholder="alex@marvel.com"
                    value={addUserForm.email}
                    onChange={(e) => setAddUserForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <div className="label-with-action">
                  <label className="form-label">Temporary Password *</label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="generate-pass-btn"
                  >
                    <Sparkles size={12} /> Auto-Generate
                  </button>
                </div>
                <div className="password-input-wrapper">
                  <Input
                    required
                    type={showPassword ? "text" : "password"}
                    placeholder="Minimum 6 characters"
                    value={addUserForm.password}
                    onChange={(e) => setAddUserForm(prev => ({ ...prev, password: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="toggle-password-btn"
                  >
                    {showPassword ? <X size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group-row">
                {/* Role Selector */}
                <div className="form-group">
                  <label className="form-label">Account Role *</label>
                  <select
                    value={addUserForm.role}
                    onChange={(e) => setAddUserForm(prev => ({ ...prev, role: e.target.value }))}
                    className="form-select-field"
                  >
                    <option value="user">Customer (Standard Shopper)</option>
                    <option value="vendor">Vendor / Seller</option>
                    <option value="admin">Platform Admin</option>
                    {isSuperAdmin && (
                      <option value="super_admin">Super Admin (Root)</option>
                    )}
                  </select>
                </div>


              </div>

              {/* Vendor Store Name if role is vendor */}
              {addUserForm.role === "vendor" && (
                <div className="form-group animate-fade-in">
                  <label className="form-label">Store / Business Name *</label>
                  <Input
                    type="text"
                    placeholder="e.g. Apex Electronics"
                    value={addUserForm.storeName}
                    onChange={(e) => setAddUserForm(prev => ({ ...prev, storeName: e.target.value }))}
                  />
                </div>
              )}

              <div className="modal-actions-footer">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddUserModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addUserLoading}
                  className="submit-primary-btn"
                >
                  {addUserLoading ? (
                    <>
                      <RefreshCw size={15} className="spin-animation" /> Creating...
                    </>
                  ) : (
                    <>
                      <Check size={16} /> Create User Account
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 2: VIEW USER DETAILS                           */}
      {/* ---------------------------------------------------- */}
      {viewingUser && (
        <div className="modal-backdrop-overlay">
          <div className="modal-content-container animate-scale-up">
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <div className="modal-icon-bubble blue">
                  <Eye size={20} />
                </div>
                <div>
                  <h3 className="modal-title">User Account Overview</h3>
                  <p className="modal-subtitle">Direct profile details from Supabase database</p>
                </div>
              </div>
              <button onClick={() => setViewingUser(null)} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>

            <div className="view-user-body">
              {/* Profile Card Header */}
              <div className="view-profile-hero">
                <div className={`view-hero-avatar ${viewingUser.role}`}>
                  {viewingUser.full_name
                    ? viewingUser.full_name.charAt(0).toUpperCase()
                    : viewingUser.email
                    ? viewingUser.email.charAt(0).toUpperCase()
                    : "U"}
                </div>
                <div className="view-hero-info">
                  <h4 className="hero-full-name">{viewingUser.full_name || "Unnamed User"}</h4>
                  <p className="hero-email">{viewingUser.email}</p>
                  <div className="hero-badges-row">
                    {renderRoleBadge(viewingUser.role)}
                    {renderStatusBadge(viewingUser.status)}
                  </div>
                </div>
              </div>

              {/* User Metadata Grid */}
              <div className="view-metadata-grid">
                <div className="meta-info-item">
                  <span className="meta-label">USER ID</span>
                  <div className="copyable-id">
                    <span className="meta-value font-mono">{viewingUser.id}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(viewingUser.id);
                        addToast({ title: "Copied", message: "User ID copied to clipboard.", type: "info" });
                      }}
                      className="copy-id-btn"
                      title="Copy ID"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </div>

                <div className="meta-info-item">
                  <span className="meta-label">REGISTERED DATE</span>
                  <span className="meta-value">
                    {viewingUser.created_at ? new Date(viewingUser.created_at).toLocaleString() : "Live Profile"}
                  </span>
                </div>

                <div className="meta-info-item">
                  <span className="meta-label">SUBSCRIPTION PLAN</span>
                  <span className="meta-value">{viewingUser.plan || "Enterprise"}</span>
                </div>

                <div className="meta-info-item">
                  <span className="meta-label">BILLING METHOD</span>
                  <span className="meta-value">{viewingUser.billing || "Auto Debit"}</span>
                </div>

                {viewingUser.role === "vendor" && (
                  <div className="meta-info-item full-width">
                    <span className="meta-label">VENDOR STORE NAME</span>
                    <span className="meta-value font-bold text-emerald">
                      {viewingUser.store_name || "Seller Storefront"}
                    </span>
                  </div>
                )}
              </div>

              {/* Quick Actions in View Modal */}
              <div className="view-quick-actions">
                <Button
                  variant="outline"
                  onClick={() => {
                    const target = viewingUser;
                    setViewingUser(null);
                    handleOpenEditUser(target);
                  }}
                  className="quick-action-btn"
                >
                  <Edit2 size={15} /> Edit Profile
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    const target = viewingUser;
                    setViewingUser(null);
                    setResetTargetUser(target);
                  }}
                  className="quick-action-btn"
                >
                  <Key size={15} /> Reset Password
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleToggleStatus(viewingUser.id, viewingUser.status, viewingUser.full_name || viewingUser.email)}
                  className="quick-action-btn"
                >
                  {viewingUser.status === "active" ? "Deactivate User" : "Activate User"}
                </Button>
              </div>
            </div>

            <div className="modal-actions-footer">
              <Button onClick={() => setViewingUser(null)} className="full-width-btn">
                Close Window
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 3: EDIT USER DETAILS                           */}
      {/* ---------------------------------------------------- */}
      {editingUser && (
        <div className="modal-backdrop-overlay">
          <div className="modal-content-container animate-scale-up">
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <div className="modal-icon-bubble emerald">
                  <Edit2 size={20} />
                </div>
                <div>
                  <h3 className="modal-title">Edit User Profile</h3>
                  <p className="modal-subtitle">Update user details in Supabase profiles database</p>
                </div>
              </div>
              <button onClick={() => setEditingUser(null)} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="modal-form">
              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <Input
                    type="text"
                    required
                    value={editUserForm.full_name}
                    onChange={(e) => setEditUserForm(prev => ({ ...prev, full_name: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <Input
                    type="email"
                    required
                    value={editUserForm.email}
                    onChange={(e) => setEditUserForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group-row">
                {/* Role Selector */}
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    value={editUserForm.role}
                    onChange={(e) => setEditUserForm(prev => ({ ...prev, role: e.target.value }))}
                    className="form-select-field"
                  >
                    <option value="user">Customer (User)</option>
                    <option value="vendor">Vendor</option>
                    <option value="admin">Platform Admin</option>
                    {isSuperAdmin && (
                      <option value="super_admin">Super Admin</option>
                    )}
                  </select>
                </div>

                {/* Status Selector */}
                <div className="form-group">
                  <label className="form-label">Account Status</label>
                  <select
                    value={editUserForm.status}
                    onChange={(e) => setEditUserForm(prev => ({ ...prev, status: e.target.value }))}
                    className="form-select-field"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                    <option value="banned">Banned</option>
                  </select>
                </div>
              </div>

              {/* Vendor Store Name */}
              {editUserForm.role === "vendor" && (
                <div className="form-group animate-fade-in">
                  <label className="form-label">Vendor Store Name</label>
                  <Input
                    type="text"
                    value={editUserForm.store_name}
                    onChange={(e) => setEditUserForm(prev => ({ ...prev, store_name: e.target.value }))}
                  />
                </div>
              )}

              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label">Plan Tier</label>
                  <select
                    value={editUserForm.plan}
                    onChange={(e) => setEditUserForm(prev => ({ ...prev, plan: e.target.value }))}
                    className="form-select-field"
                  >
                    <option value="Basic">Basic</option>
                    <option value="Team">Team</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Billing Method</label>
                  <select
                    value={editUserForm.billing}
                    onChange={(e) => setEditUserForm(prev => ({ ...prev, billing: e.target.value }))}
                    className="form-select-field"
                  >
                    <option value="Auto Debit">Auto Debit</option>
                    <option value="Manual - Paypal">Manual - Paypal</option>
                    <option value="Manual - Cash">Manual - Cash</option>
                  </select>
                </div>
              </div>

              <div className="modal-actions-footer">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={editUserLoading}
                  className="submit-primary-btn emerald"
                >
                  {editUserLoading ? (
                    <>
                      <RefreshCw size={15} className="spin-animation" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check size={16} /> Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 4: RESET PASSWORD                              */}
      {/* ---------------------------------------------------- */}
      {resetTargetUser && (
        <div className="modal-backdrop-overlay">
          <div className="modal-content-container animate-scale-up">
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <div className="modal-icon-bubble amber">
                  <Key size={20} />
                </div>
                <div>
                  <h3 className="modal-title">Reset User Password</h3>
                  <p className="modal-subtitle">Set a new secure password for {resetTargetUser.email}</p>
                </div>
              </div>
              <button onClick={() => setResetTargetUser(null)} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="modal-form">
              <div className="form-group">
                <label className="form-label">New Password *</label>
                <Input
                  type="password"
                  required
                  placeholder="Enter at least 6 characters"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                />
              </div>

              <div className="modal-actions-footer">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setResetTargetUser(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={resetPasswordLoading}
                  className="submit-primary-btn amber"
                >
                  {resetPasswordLoading ? "Resetting..." : "Confirm Password Reset"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 5: DELETE USER CONFIRMATION                    */}
      {/* ---------------------------------------------------- */}
      {deletingUser && (
        <div className="modal-backdrop-overlay">
          <div className="modal-content-container animate-scale-up">
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <div className="modal-icon-bubble red">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="modal-title">Delete User Account</h3>
                  <p className="modal-subtitle">This action is irreversible and deletes DB records</p>
                </div>
              </div>
              <button onClick={() => setDeletingUser(null)} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>

            <div className="delete-modal-body">
              <p>
                Are you sure you want to permanently delete the account for{" "}
                <strong>{deletingUser.full_name || deletingUser.email}</strong>?
              </p>
              <div className="delete-warning-box">
                <AlertTriangle size={16} />
                <span>The user will immediately lose access to Marvel platform services.</span>
              </div>
            </div>

            <div className="modal-actions-footer">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeletingUser(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteUser}
                disabled={deleteLoading}
                className="submit-primary-btn red"
              >
                {deleteLoading ? "Deleting..." : "Permanently Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
