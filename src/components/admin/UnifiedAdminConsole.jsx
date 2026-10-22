import { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard,
  Users,
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
  IndianRupee,
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
  FileText,
  Settings as SettingsIcon,
} from "lucide-react";
import { Button, Input, useToast } from "../ui";
import CategoryPicker from "./CategoryPicker";
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
  apiUpdateOrderStatus,
  apiUploadImage,
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
  customerStats,
} from "./reportUtils";
import {
  EMPTY,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ROLE_LABELS,
  displayInitial,
  displayValue,
  formatAdminDate,
  isLowStock,
} from "./adminConstants";
import { buildAlerts } from "./adminAlerts";
import { AdminNotifications, AdminProfileMenu } from "./AdminTopBar";
import SettingsEditor from "./SettingsEditor";
import "./admin-reports.css";
import RevenueTrendChart from "./charts/RevenueTrendChart";
import OrderStatusChart from "./charts/OrderStatusChart";
import UserRolesChart from "./charts/UserRolesChart";
import BestSellersChart from "./charts/BestSellersChart";
import OrdersPlusRevenueChart from "./charts/OrdersPlusRevenueChart";
import InventoryChart from "./charts/InventoryChart";
import CustomerRepeatChart from "./charts/CustomerRepeatChart";
import MenuTreeEditor from "./MenuTreeEditor";
import HeroSlidesEditor from "./HeroSlidesEditor";
import CategoriesTreeEditor from "./CategoriesTreeEditor";
import BannersEditor from "./BannersEditor";
import FooterEditor from "./FooterEditor";
import PagesEditor from "./PagesEditor";
import {
  CreateUserModal,
  ViewUserModal,
  EditUserModal,
  ResetPasswordModal,
  DeleteUserModal,
} from "./modals";
import OperationsHub from "./OperationsHub";
import { formatAmount, formatCurrency } from "../../lib/currency";

/* Sidebar icon per order stage, keyed by the `order_status` enum value. */
const ORDER_STATUS_ICONS = {
  pending: Activity,
  processing: RefreshCw,
  shipped: ArrowUpRight,
  delivered: CheckCircle,
  cancelled: XCircle,
};

/** How many order rows the table renders before it stops. */
const ORDER_ROW_LIMIT = 20;

/**
 * A short reference for an order: the last eight characters of its id.
 *
 * The head of a uuid is not a useful reference — ids minted in a batch share a
 * prefix, so showing the head named every one of them identically. The tail
 * carries the part that actually differs.
 */
function orderRef(order) {
  const id = String(order?.id ?? "").trim();
  if (!id) return EMPTY;
  return `#${id.slice(-8)}`;
}

/** A stored amount as rupees, or the neutral dash when the API has no amount. */
function money(value) {
  if (value === null || value === undefined || value === "") return EMPTY;
  return formatCurrency(value);
}

/**
 * Which sidebar section owns each tab. Site Content owns its six sub-tabs
 * (menus, hero, categories, banners, footer, pages). Activating a tab opens
 * the section that owns it, so the open section and the active tab agree.
 */
const SECTION_BY_TAB = {
  dashboard: "dashboard",
  orders: "orders",
  products: "products",
  customers: "customers",
  users: "users",
  menus: "siteContent",
  hero: "siteContent",
  categories: "siteContent",
  banners: "siteContent",
  footer: "siteContent",
  pages: "siteContent",
  settings: "settings",
};

export default function UnifiedAdminConsole({ onNavigateHome, customRole = "admin" }) {
  const { user: currentUser, logout, role: currentRole } = useAuth();
  const isSuperAdmin = currentRole === "super_admin" || customRole === "super_admin";
  // Site Content (menus, hero, categories, banners, footer, pages) is
  // admin-gated.
  const canManageSiteContent = isSuperAdmin || currentRole === "admin" || customRole === "admin";

  // Active Tab State (Dashboard, Products, Orders, Customers, Users)
  const [activeTab, setActiveTabState] = useState("dashboard"); // "dashboard" | "products" | "orders" | "customers" | "users"

  // Global Loading and Sync States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Set when the API could not be reached. There is no cached copy of the
  // records, so the console shows an explicit error state instead of zeros.
  const [syncError, setSyncError] = useState(null);
  const { addToast } = useToast();

  // Live Database States
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);

  // Time Range for Dashboard Charts
  const [timeRange, setTimeRange] = useState("7d"); // "7d" | "30d"

  // Sidebar submenu expansion + per-tab sub-views. The sidebar is an accordion:
  // at most one section is open, and the open section follows the active tab.
  const [expandedMenus, setExpandedMenus] = useState({ dashboard: true });
  const [dashboardView, setDashboardView] = useState("overview"); // "overview" | "sales"
  const [productsView, setProductsView] = useState("list"); // "list" | "add"
  const [ordersView, setOrdersView] = useState("all"); // "all" | order status
  const [orderSearch, setOrderSearch] = useState("");
  const [customersView, setCustomersView] = useState("all"); // "all" | "repeat"
  const [customerSearch, setCustomerSearch] = useState("");

  // Products management states
  const [editingProduct, setEditingProduct] = useState(null);
  const [productSaving, setProductSaving] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productForm, setProductForm] = useState({
    title: "",
    price: "",
    original_price: "",
    category: "",
    category_id: null,
    stock: "",
    image_url: "",
    description: "",
  });

  // Users Tab Filter States
  const [searchUser, setSearchUser] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [userPage, setUserPage] = useState(1);
  const usersPerPage = 8;

  // Modals States
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  // Plan and billing are derived by the server from the role
  // (server/routes/users.js → formatUserProfile), so the form never invents one
  // and never sends an override.
  const [addUserForm, setAddUserForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "user",
    storeName: "",
    plan: "",
    billing: "",
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
    // Read-only mirrors of what the server returned — see handleOpenEditUser.
    plan: "",
    billing: "",
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
        apiFetchOrders({ role: isSuperAdmin ? "super_admin" : "admin" }),
      ]);

      setUsers(Array.isArray(usersData) ? usersData : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setSyncError(null);
    } catch (err) {
      console.error("Admin Console Sync Error:", err);
      setSyncError(err?.message || "The admin API did not respond.");
      addToast({
        title: "Sync Failed",
        message:
          "Could not load records from the API. Nothing is cached, so the figures are unavailable — not zero.",
        type: "error",
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
      type: "info",
    });
    if (onNavigateHome) {
      onNavigateHome();
    } else {
      window.location.hash = "#/login";
    }
  };

  // Sidebar submenu expand/collapse — one section at a time (accordion).
  // Opening a section closes every other one; clicking the open section closes
  // it, so the admin can collapse everything.
  const toggleMenu = (key) => {
    setExpandedMenus((prev) => (prev[key] ? {} : { [key]: true }));
  };

  /**
   * Activates a tab and opens the sidebar section that owns it. Sub-items
   * (Overview, Pending, Add User, Hero, …) and the alert banner go through the
   * same door, so a sub-view can never leave a different section expanded.
   */
  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    const section = SECTION_BY_TAB[tab];
    // Tabs outside the sidebar (Settings) leave nothing open, so the sidebar
    // never points at a section the admin is not looking at.
    setExpandedMenus(section ? { [section]: true } : {});
  };

  /**
   * A parent section button: opens its first tab and its submenu, or collapses
   * the section when it is already open.
   */
  const handleSectionClick = (key, tab, onOpen) => {
    if (expandedMenus[key]) {
      toggleMenu(key);
      return;
    }
    if (onOpen) onOpen();
    setActiveTab(tab);
  };

  // ----------------------------------------------------
  // PRODUCTS MANAGEMENT HANDLERS (Admin Catalog)
  // ----------------------------------------------------
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      title: "",
      price: "",
      original_price: "",
      category: "",
      category_id: null,
      stock: "",
      image_url: "",
      description: "",
    });
    setProductsView("add");
  };

  const handleProductImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await apiUploadImage(file, "marvel_products");
      setProductForm((prev) => ({ ...prev, image_url: data.url || "" }));
    } catch (err) {
      addToast({ title: "Image Upload Failed", message: err.message, type: "error" });
    }
  };

  const handleOpenEditProduct = (prod) => {
    setEditingProduct(prod);
    setProductForm({
      title: prod.title || "",
      price: prod.price !== undefined && prod.price !== null ? String(prod.price) : "",
      original_price:
        prod.original_price !== undefined && prod.original_price !== null
          ? String(prod.original_price)
          : "",
      category: prod.category || "",
      category_id: prod.category_id ?? null,
      stock: prod.stock !== undefined && prod.stock !== null ? String(prod.stock) : "",
      image_url: prod.image_url || prod.image || "",
      description: prod.description || "",
    });
    setProductsView("add");
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!productForm.title.trim() || !productForm.price) {
      addToast({
        title: "Missing Information",
        message: "Product title and price are required.",
        type: "error",
      });
      return;
    }
    setProductSaving(true);
    try {
      const payload = {
        title: productForm.title.trim(),
        price: parseFloat(productForm.price),
        original_price: productForm.original_price
          ? parseFloat(productForm.original_price)
          : undefined,
        category: productForm.category,
        category_id: productForm.category_id ?? null,
        // A blank stock field means "not stated" — leave the stored value to the
        // server instead of claiming the product is out of stock.
        stock:
          String(productForm.stock).trim() === ""
            ? undefined
            : parseInt(productForm.stock, 10) || 0,
        image_url: productForm.image_url.trim(),
        description: productForm.description.trim(),
      };
      if (editingProduct) {
        const updated = await apiUpdateProduct(editingProduct.id, payload);
        setProducts((prev) =>
          prev.map((p) => (p.id === editingProduct.id ? { ...p, ...updated } : p))
        );
        addToast({
          title: "Product Updated",
          message: `'${payload.title}' saved. Live on the storefront.`,
          type: "success",
        });
      } else {
        const created = await apiCreateProduct(payload);
        setProducts((prev) => [created, ...prev]);
        addToast({
          title: "Product Published",
          message: `'${payload.title}' is now live on the storefront.`,
          type: "success",
        });
      }
      setEditingProduct(null);
      setProductsView("list");
    } catch (err) {
      addToast({
        title: "Save Failed",
        message: err.message || "Failed to save product.",
        type: "error",
      });
    } finally {
      setProductSaving(false);
    }
  };

  const handleDeleteProduct = async (id, title) => {
    if (
      !window.confirm(`Remove '${title}' from the catalog? It will disappear from the storefront.`)
    )
      return;
    try {
      await apiDeleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      addToast({
        title: "Product Deleted",
        message: `Removed '${title}' from the catalog.`,
        type: "info",
      });
    } catch (err) {
      addToast({ title: "Delete Failed", message: err.message, type: "error" });
    }
  };

  const handleToggleFeatured = async (prod) => {
    try {
      const updated = await apiModerateProduct(prod.id, { is_featured: !prod.is_featured });
      setProducts((prev) => prev.map((p) => (p.id === prod.id ? { ...p, ...updated } : p)));
      addToast({
        title: updated.is_featured ? "Marked Featured" : "Unmarked Featured",
        message: `'${prod.title}' updated.`,
        type: "success",
      });
    } catch (err) {
      addToast({ title: "Update Failed", message: err.message, type: "error" });
    }
  };

  // ----------------------------------------------------
  // ORDERS FULFILLMENT (Admin)
  // ----------------------------------------------------
  const handleAdvanceOrder = async (order) => {
    const next =
      order.status === "processing" ? "shipped" : order.status === "shipped" ? "delivered" : null;
    if (!next) return;
    try {
      const updated = await apiUpdateOrderStatus(order.id, { status: next });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...updated } : o)));
      addToast({
        title: "Order Updated",
        message: `Order marked as ${next.toUpperCase()}.`,
        type: "success",
      });
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
      const amt =
        typeof order.total_amount === "number"
          ? order.total_amount
          : parseFloat(order.total_amount) || 0;
      return sum + amt;
    }, 0);

    // 2. Orders breakdown — the `order_status` enum has no "completed" value.
    const completedOrders = orders.filter((o) => o.status === "delivered").length;
    const processingOrders = orders.filter(
      (o) => o.status === "processing" || o.status === "shipped"
    ).length;
    const pendingOrders = orders.filter((o) => o.status === "pending").length;

    // 3. Users breakdown
    const superAdminsCount = users.filter((u) => u.role === "super_admin").length;
    const adminsCount = users.filter((u) => u.role === "admin").length;
    const vendorsCount = users.filter((u) => u.role === "vendor").length;
    const customersCount = users.filter((u) => u.role === "user" || !u.role).length;
    const activeUsersCount = users.filter(
      (u) => String(u.status || "").toLowerCase() === "active"
    ).length;

    // 4. Products breakdown
    const inStockProducts = products.filter((p) => (parseInt(p.stock, 10) || 0) > 0).length;
    const lowStockProducts = products.filter((p) => isLowStock(p.stock)).length;

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
      aov,
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
    return {
      windows,
      growth,
      statuses,
      repeat,
      sellers,
      inventory,
      deliveredRate: statuses.total > 0 ? (statuses.delivered / statuses.total) * 100 : null,
    };
  }, [orders, products]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        (p.title || "").toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  const filteredOrders = useMemo(() => {
    if (ordersView === "all") return orders;
    return orders.filter((o) => String(o.status || "").toLowerCase() === ordersView);
  }, [orders, ordersView]);

  // The search filters whichever stage the pills currently show. A pasted
  // reference ("#555555aa") is matched too, so the short form on screen finds
  // the order.
  const visibleOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase().replace(/^#/, "");
    if (!q) return filteredOrders;
    return filteredOrders.filter((order) => {
      const haystack = [
        order?.id,
        order?.customer_name,
        order?.customer_email,
        order?.status,
        ...(Array.isArray(order?.items) ? order.items.map((item) => item?.title) : []),
      ];
      return haystack.some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [filteredOrders, orderSearch]);

  const customerRows = useMemo(() => customerStats(users, orders), [users, orders]);

  // Registered customers carry a store name on the account (not on the order
  // rollup), so look it up by id instead of widening the report helper.
  const storeNameByUserId = useMemo(() => {
    const map = new Map();
    for (const u of users) {
      if (u?.id) map.set(String(u.id), u.store_name || "");
    }
    return map;
  }, [users]);

  // The search filters whichever dataset the pills currently show.
  const customerSegment = useMemo(
    () => (customersView === "repeat" ? customerRows.filter((c) => c.repeat) : customerRows),
    [customerRows, customersView]
  );

  const visibleCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customerSegment;
    return customerSegment.filter(
      (c) =>
        String(c.name || "")
          .toLowerCase()
          .includes(q) ||
        String(c.email || "")
          .toLowerCase()
          .includes(q) ||
        String(storeNameByUserId.get(String(c.id)) || "")
          .toLowerCase()
          .includes(q)
    );
  }, [customerSegment, customerSearch, storeNameByUserId]);

  // ----------------------------------------------------
  // USER MANAGEMENT HANDLERS
  // ----------------------------------------------------
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.full_name?.toLowerCase().includes(searchUser.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchUser.toLowerCase()) ||
        u.role?.toLowerCase().includes(searchUser.toLowerCase()) ||
        u.store_name?.toLowerCase().includes(searchUser.toLowerCase());

      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" || (u.status || "").toLowerCase() === statusFilter.toLowerCase();

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
      addToast({
        title: "Missing Information",
        message: "Full Name, Email, and Password are required.",
        type: "error",
      });
      return;
    }

    if (addUserForm.password.length < 6) {
      addToast({
        title: "Weak Password",
        message: "Password must be at least 6 characters long.",
        type: "warning",
      });
      return;
    }

    setAddUserLoading(true);
    try {
      // Plan and billing are derived from the role by the server, so an empty
      // value is left out of the payload rather than overriding that derivation.
      const { plan, billing, ...account } = addUserForm;
      const payload = { ...account };
      if (plan) payload.plan = plan;
      if (billing) payload.billing = billing;

      const created = await apiAdminCreateUser(payload);
      setUsers((prev) => [created, ...prev]);
      setShowAddUserModal(false);
      setAddUserForm({
        fullName: "",
        email: "",
        password: "",
        role: "user",
        storeName: "",
        plan: "",
        billing: "",
      });
      addToast({
        title: "User Created Successfully",
        message: `Account for ${displayValue(created.full_name)} (${created.role ? created.role.toUpperCase() : EMPTY}) is active.`,
        type: "success",
      });
    } catch (err) {
      addToast({
        title: "Creation Failed",
        message: err.message || "Failed to create user account.",
        type: "error",
      });
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
      status: user.status || "",
      store_name: user.store_name || "",
      // Exactly what the server returned — the form only displays these.
      plan: user.plan || "",
      billing: user.billing || "",
    });
  };

  // Submit Edit User Form
  const handleSaveEditUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    setEditUserLoading(true);
    try {
      // The server derives plan and billing from the role and ignores these on
      // update, so they are never sent.
      const { full_name, email, role, status, store_name } = editUserForm;
      const updatedUser = await apiUpdateUserDetails(editingUser.id, {
        full_name,
        email,
        role,
        status,
        store_name,
      });
      setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? { ...u, ...updatedUser } : u)));

      if (viewingUser && viewingUser.id === editingUser.id) {
        setViewingUser({ ...viewingUser, ...updatedUser });
      }

      setEditingUser(null);
      addToast({
        title: "User Updated",
        message: `Successfully saved changes for ${displayValue(updatedUser.full_name || updatedUser.email)}.`,
        type: "success",
      });
    } catch (err) {
      addToast({
        title: "Update Failed",
        message: err.message || "Failed to update user profile.",
        type: "error",
      });
    } finally {
      setEditUserLoading(false);
    }
  };

  // Handle Quick Role Promotion
  const handleQuickRoleChange = async (userId, newRole, userName) => {
    try {
      const updatedList = await apiUpdateUserRole(userId, newRole);
      setUsers(
        Array.isArray(updatedList)
          ? updatedList
          : (prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      if (viewingUser && viewingUser.id === userId) {
        setViewingUser((prev) => ({ ...prev, role: newRole }));
      }
      addToast({
        title: "Role Updated",
        message: `${userName}'s role elevated to ${newRole.toUpperCase()}.`,
        type: "success",
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
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: nextStatus } : u)));
      if (viewingUser && viewingUser.id === userId) {
        setViewingUser((prev) => ({ ...prev, status: nextStatus }));
      }
      addToast({
        title: "Status Changed",
        message: `${userName} is now ${nextStatus.toUpperCase()}.`,
        type: "info",
      });
    } catch (err) {
      addToast({ title: "Status Update Failed", message: err.message, type: "error" });
    }
  };

  // Handle Password Reset
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetTargetUser || !resetNewPassword || resetNewPassword.length < 6) {
      addToast({
        title: "Invalid Password",
        message: "Password must be at least 6 characters.",
        type: "error",
      });
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
        type: "success",
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
      setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id));
      if (viewingUser && viewingUser.id === deletingUser.id) {
        setViewingUser(null);
      }
      setDeletingUser(null);
      addToast({
        title: "User Deleted",
        message: `Removed ${deletingUser.full_name || deletingUser.email} from the database.`,
        type: "info",
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
    setAddUserForm((prev) => ({ ...prev, password: pass }));
    setShowPassword(true);
  };

  // Helper for Role Badges. An absent role renders the neutral dash, never a
  // role the API did not report.
  const renderRoleBadge = (role) => {
    switch (role) {
      case "super_admin":
        return (
          <span className="role-pill super-admin">
            <Crown size={12} className="role-icon" />
            {ROLE_LABELS.super_admin}
          </span>
        );
      case "admin":
        return (
          <span className="role-pill admin">
            <ShieldCheck size={12} className="role-icon" />
            {ROLE_LABELS.admin}
          </span>
        );
      case "vendor":
        return (
          <span className="role-pill vendor">
            <Store size={12} className="role-icon" />
            {ROLE_LABELS.vendor}
          </span>
        );
      case "user":
        return (
          <span className="role-pill user">
            <UserIcon size={12} className="role-icon" />
            {ROLE_LABELS.user}
          </span>
        );
      default:
        return (
          <span className="role-pill user">
            <UserIcon size={12} className="role-icon" />
            {displayValue(role)}
          </span>
        );
    }
  };

  // Helper for Status Badges. The label is the API's status, capitalised; an
  // absent status renders the neutral dash.
  const renderStatusBadge = (status) => {
    const s = String(status || "")
      .trim()
      .toLowerCase();
    if (!s) {
      return (
        <span className="status-pill unknown">
          <span className="status-dot"></span>
          {EMPTY}
        </span>
      );
    }
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
    users: "User Management Directory",
    menus: "Site Content — Menus",
    hero: "Site Content — Hero",
    categories: "Site Content — Categories",
    banners: "Site Content — Banners",
    footer: "Site Content — Footer",
    pages: "Site Content — Pages",
    settings: "Settings",
  };

  // Nothing loaded and no cached copy exists, so the console has no business
  // data to render: show the failure explicitly instead of an empty dashboard.
  const dataUnavailable =
    Boolean(syncError) && users.length === 0 && products.length === 0 && orders.length === 0;

  // The bell counts what needs attention, derived from the same live rows the
  // rest of the console reads — never a stored counter that could disagree.
  const alerts = useMemo(() => buildAlerts({ orders, products, users }), [orders, products, users]);

  /** An alert takes the admin to the tab that can act on it. */
  const handleOpenAlertTab = (tab) => {
    if (tab === "orders") setOrdersView("all");
    if (tab === "products") setProductsView("list");
    if (tab === "customers") setCustomersView("all");
    setActiveTab(tab);
  };

  /** The profile menu's Settings entry. */
  const handleOpenSettings = () => setActiveTab("settings");

  return (
    <div className="admin-app-layout">
      {/* ==================================================== */}
      {/* 1. LEFT SIDEBAR                                      */}
      {/* ==================================================== */}
      <aside className="admin-sidebar">
        {/* LOGO ON LEFT TOP */}
        <div className="sidebar-brand-header">
          <div className="brand-logo-wrapper">
            <div className="brand-logo-img-box">
              <img src="/logo.png" alt="Marvel" className="brand-logo-img" />
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

        {/* ALL TABS ON LEFT SIDE */}
        <nav className="sidebar-navigation">
          <div className="nav-section-label">DAILY OPERATIONS</div>

          {/* MENU 1: DASHBOARD (with submenu) */}
          <button
            id="admin-tab-dashboard"
            onClick={() =>
              handleSectionClick("dashboard", "dashboard", () => setDashboardView("overview"))
            }
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
                onClick={() => {
                  setActiveTab("dashboard");
                  setDashboardView("overview");
                }}
                className={`sidebar-submenu-btn ${activeTab === "dashboard" && dashboardView === "overview" ? "active" : ""}`}
              >
                <BarChart3 size={14} />
                <span>Overview</span>
              </button>
              <button
                id="admin-tab-dashboard-sales"
                onClick={() => {
                  setActiveTab("dashboard");
                  setDashboardView("sales");
                }}
                className={`sidebar-submenu-btn ${activeTab === "dashboard" && dashboardView === "sales" ? "active" : ""}`}
              >
                <Wallet size={14} />
                <span>Sales Report</span>
              </button>
            </div>
          )}

          {/* MENU 2: ORDERS (with submenu) */}
          <button
            id="admin-tab-orders"
            onClick={() => handleSectionClick("orders", "orders", () => setOrdersView("all"))}
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
                onClick={() => {
                  setActiveTab("orders");
                  setOrdersView("all");
                }}
                className={`sidebar-submenu-btn ${activeTab === "orders" && ordersView === "all" ? "active" : ""}`}
              >
                <ClipboardList size={14} />
                <span>All Orders</span>
                <span className="sidebar-submenu-count">{orders.length}</span>
              </button>
              {ORDER_STATUSES.map((status) => {
                const StatusIcon = ORDER_STATUS_ICONS[status];
                return (
                  <button
                    key={status}
                    id={`admin-tab-orders-${status}`}
                    onClick={() => {
                      setActiveTab("orders");
                      setOrdersView(status);
                    }}
                    className={`sidebar-submenu-btn ${activeTab === "orders" && ordersView === status ? "active" : ""}`}
                  >
                    <StatusIcon size={14} />
                    <span>{ORDER_STATUS_LABELS[status]}</span>
                    <span className="sidebar-submenu-count">{salesReport.statuses[status]}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* MENU 3: PRODUCTS (with submenu) */}
          <button
            id="admin-tab-products"
            onClick={() =>
              handleSectionClick("products", "products", () => setProductsView("list"))
            }
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
                onClick={() => {
                  setActiveTab("products");
                  setProductsView("list");
                }}
                className={`sidebar-submenu-btn ${activeTab === "products" && productsView === "list" ? "active" : ""}`}
              >
                <Package size={14} />
                <span>All Products</span>
                <span className="sidebar-submenu-count">{products.length}</span>
              </button>
              <button
                id="admin-tab-products-add"
                onClick={() => {
                  setActiveTab("products");
                  handleOpenAddProduct();
                }}
                className={`sidebar-submenu-btn ${activeTab === "products" && productsView === "add" ? "active" : ""}`}
              >
                <Plus size={14} />
                <span>Add Product</span>
              </button>
            </div>
          )}

          {/* MENU 4: CUSTOMERS (with submenu) */}
          <button
            id="admin-tab-customers"
            onClick={() =>
              handleSectionClick("customers", "customers", () => setCustomersView("all"))
            }
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
                onClick={() => {
                  setActiveTab("customers");
                  setCustomersView("all");
                }}
                className={`sidebar-submenu-btn ${activeTab === "customers" && customersView === "all" ? "active" : ""}`}
              >
                <Users size={14} />
                <span>All Customers</span>
              </button>
              <button
                id="admin-tab-customers-repeat"
                onClick={() => {
                  setActiveTab("customers");
                  setCustomersView("repeat");
                }}
                className={`sidebar-submenu-btn ${activeTab === "customers" && customersView === "repeat" ? "active" : ""}`}
              >
                <Repeat size={14} />
                <span>Repeat Buyers</span>
                <span className="sidebar-submenu-count">{salesReport.repeat.repeatCustomers}</span>
              </button>
            </div>
          )}

          {/* MENU 5: USERS (with submenu: View Users / Add User) */}
          <button
            id="admin-tab-users"
            onClick={() => handleSectionClick("users", "users", () => setShowAddUserModal(false))}
            className={`sidebar-tab-button ${activeTab === "users" ? "active" : ""}`}
            aria-expanded={!!expandedMenus.users}
          >
            <div className="tab-icon-box">
              <Users size={19} />
            </div>
            <div className="tab-text-box">
              <span className="tab-title">Users</span>
              <span className="tab-description">Accounts & Roles</span>
            </div>
            <span className="tab-badge-counter">{users.length}</span>
            <span className={`sidebar-parent-chevron ${expandedMenus.users ? "open" : ""}`}>
              <ChevronDown size={15} />
            </span>
            {activeTab === "users" && <div className="active-glow-indicator"></div>}
          </button>
          {expandedMenus.users && (
            <div className="sidebar-submenu">
              <button
                id="admin-tab-users-list"
                onClick={() => {
                  setActiveTab("users");
                  setShowAddUserModal(false);
                }}
                className={`sidebar-submenu-btn ${activeTab === "users" && !showAddUserModal ? "active" : ""}`}
              >
                <Eye size={14} />
                <span>View Users</span>
                <span className="sidebar-submenu-count">{users.length}</span>
              </button>
              <button
                id="admin-tab-users-add"
                onClick={() => {
                  setActiveTab("users");
                  setShowAddUserModal(true);
                }}
                className={`sidebar-submenu-btn ${activeTab === "users" && showAddUserModal ? "active" : ""}`}
              >
                <Plus size={14} />
                <span>Add User</span>
              </button>
            </div>
          )}

          {/* ===== ONLINE STORE (CMS) ===== */}
          {canManageSiteContent && <div className="nav-section-label">ONLINE STORE (CMS)</div>}
          {canManageSiteContent && (
            <button
              id="admin-tab-site-content"
              onClick={() => handleSectionClick("siteContent", "menus")}
              className={`sidebar-tab-button ${["menus", "hero", "categories", "banners", "footer", "pages"].includes(activeTab) ? "active" : ""}`}
              aria-expanded={!!expandedMenus.siteContent}
            >
              <div className="tab-icon-box">
                <Layers size={19} />
              </div>
              <div className="tab-text-box">
                <span className="tab-title">Site Content</span>
                <span className="tab-description">Menus & Banners</span>
              </div>
              <span className={`sidebar-parent-chevron ${expandedMenus.siteContent ? "open" : ""}`}>
                <ChevronDown size={15} />
              </span>
              {["menus", "hero", "categories", "banners", "footer", "pages"].includes(
                activeTab
              ) && <div className="active-glow-indicator"></div>}
            </button>
          )}
          {canManageSiteContent && expandedMenus.siteContent && (
            <div className="sidebar-submenu">
              <button
                id="admin-tab-site-content-menus"
                onClick={() => {
                  setActiveTab("menus");
                }}
                className={`sidebar-submenu-btn ${activeTab === "menus" ? "active" : ""}`}
              >
                <Layers size={14} />
                <span>Menus</span>
              </button>
              <button
                id="admin-tab-site-content-hero"
                onClick={() => {
                  setActiveTab("hero");
                }}
                className={`sidebar-submenu-btn ${activeTab === "hero" ? "active" : ""}`}
              >
                <Sparkles size={14} />
                <span>Hero</span>
              </button>
              <button
                id="admin-tab-site-content-categories"
                onClick={() => {
                  setActiveTab("categories");
                }}
                className={`sidebar-submenu-btn ${activeTab === "categories" ? "active" : ""}`}
              >
                <Star size={14} />
                <span>Categories &amp; Subcategories</span>
              </button>
              <button
                id="admin-tab-site-content-banners"
                onClick={() => {
                  setActiveTab("banners");
                }}
                className={`sidebar-submenu-btn ${activeTab === "banners" ? "active" : ""}`}
              >
                <Boxes size={14} />
                <span>Banners</span>
              </button>
              <button
                id="admin-tab-site-content-footer"
                onClick={() => {
                  setActiveTab("footer");
                }}
                className={`sidebar-submenu-btn ${activeTab === "footer" ? "active" : ""}`}
              >
                <ClipboardList size={14} />
                <span>Footer</span>
              </button>
              <button
                id="admin-tab-site-content-pages"
                onClick={() => {
                  setActiveTab("pages");
                }}
                className={`sidebar-submenu-btn ${activeTab === "pages" ? "active" : ""}`}
              >
                <FileText size={14} />
                <span>Pages</span>
              </button>
            </div>
          )}

          {/* ===== CONFIGURATION ===== */}
          <div className="nav-section-label">CONFIGURATION</div>
          <button
            id="admin-tab-settings"
            onClick={() => setActiveTab("settings")}
            className={`sidebar-tab-button ${activeTab === "settings" ? "active" : ""}`}
          >
            <div className="tab-icon-box">
              <SettingsIcon size={19} />
            </div>
            <div className="tab-text-box">
              <span className="tab-title">Settings</span>
              <span className="tab-description">Store &amp; Preferences</span>
            </div>
            {activeTab === "settings" && <div className="active-glow-indicator"></div>}
          </button>

          {/* LIVE STORE QUICK LINK */}
          <a
            href="#/"
            className="sidebar-live-store-link"
            title="Open customer-facing storefront in new or current tab"
          >
            <ExternalLink size={14} />
            <span>View Live Store</span>
          </a>
        </nav>
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
          </div>

          <div className="navbar-actions-block">
            <AdminNotifications alerts={alerts} onOpenTab={handleOpenAlertTab} />
            <AdminProfileMenu
              user={currentUser}
              role={currentRole}
              isSuperAdmin={isSuperAdmin}
              onOpenSettings={handleOpenSettings}
              onSignOut={handleSignOut}
            />
          </div>
        </header>

        {/* FAILURE STATE — the API returned nothing and no cached copy exists.
            The dashboard is suppressed instead of rendering plausible zeros. */}
        {syncError && (
          <div className="admin-sync-error" role="alert">
            <AlertTriangle size={22} className="admin-sync-error-icon" />
            <div className="admin-sync-error-body">
              <h2 className="admin-sync-error-title">
                {dataUnavailable ? "Live data unavailable" : "Last refresh failed"}
              </h2>
              <p className="admin-sync-error-message">
                {dataUnavailable
                  ? "No records could be loaded from the API. Nothing is cached, so no totals or tables are shown — the figures are unknown, not zero."
                  : "This view still shows the records from the last successful sync. Refresh to update it."}
              </p>
              <p className="admin-sync-error-detail">{syncError}</p>
            </div>
            <Button variant="outline" onClick={loadDashboardData} disabled={refreshing}>
              {refreshing ? "Retrying..." : "Retry"}
            </Button>
          </div>
        )}

        {/* ================================================== */}
        {/* TAB 1: DYNAMIC DASHBOARD (Charts & Live DB Data)   */}
        {/* ================================================== */}
        {!dataUnavailable && activeTab === "dashboard" && dashboardView === "overview" && (
          <div className="dashboard-tab-view animate-fade-in">
            <OperationsHub
              metrics={metrics}
              salesReport={salesReport}
              onNavigateTab={(tab, subView) => {
                setActiveTab(tab);
                if (tab === "orders" && subView) setOrdersView(subView);
                else if (tab === "products" && subView) setProductsView(subView);
                else if (tab === "customers" && subView) setCustomersView(subView);
              }}
              onOpenAddProduct={handleOpenAddProduct}
              userName={currentUser?.name || currentUser?.email?.split("@")[0] || "Admin"}
            />

            {/* KPI STATS CARDS GRID */}
            <div className="metrics-cards-grid">
              {/* Card 1: Total Revenue */}
              <div className="kpi-metric-card revenue-card">
                <div className="kpi-card-header">
                  <span className="kpi-label">TOTAL PLATFORM REVENUE</span>
                  <div className="kpi-icon-bubble emerald">
                    <IndianRupee size={20} />
                  </div>
                </div>
                <div className="kpi-value-row">
                  <span className="kpi-currency">₹</span>
                  <span className="kpi-number">{formatAmount(metrics.totalRevenue)}</span>
                </div>
                <div className="kpi-footer-row">
                  {salesReport.growth.percent === null ? (
                    <span className="kpi-subtext">First week of sales data</span>
                  ) : (
                    <span
                      className={`kpi-growth-badge ${salesReport.growth.percent >= 0 ? "positive" : "negative"}`}
                    >
                      <TrendingUp size={13} />
                      {salesReport.growth.percent >= 0 ? "+" : ""}
                      {salesReport.growth.percent.toFixed(1)}%
                    </span>
                  )}
                  <span className="kpi-subtext">Avg Order: {formatCurrency(metrics.aov)}</span>
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
                  <span className="kpi-status-tag completed">
                    {metrics.completedOrders} Delivered
                  </span>
                  <span className="kpi-status-tag processing">
                    {metrics.processingOrders} In Flight
                  </span>
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
              {/* CHART 1: REVENUE & SALES TRENDS (RECHART AREA CHART) */}
              <div className="dashboard-chart-card revenue-chart-span">
                <div className="chart-card-header">
                  <div>
                    <h3 className="chart-title">Revenue & Sales Trends</h3>
                    <p className="chart-subtitle">
                      Real-time dynamic aggregation from Supabase database
                    </p>
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
                <RevenueTrendChart data={chartData.points} />
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
                  <UserRolesChart
                    data={[
                      { name: "super_admin", value: metrics.superAdminsCount },
                      { name: "admin", value: metrics.adminsCount },
                      { name: "vendor", value: metrics.vendorsCount },
                      { name: "user", value: metrics.customersCount },
                    ]}
                  />
                  <OrderStatusChart data={salesReport.statuses} />
                  <BestSellersChart data={salesReport.sellers} />
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
                          <td className="font-mono text-primary font-bold">{orderRef(order)}</td>
                          <td>
                            <div className="customer-info-cell">
                              <span className="customer-name">
                                {displayValue(order.customer_name)}
                              </span>
                              <span className="customer-email">
                                {displayValue(order.customer_email)}
                              </span>
                            </div>
                          </td>
                          <td>
                            {Array.isArray(order.items) ? `${order.items.length} items` : EMPTY}
                          </td>
                          <td className="font-bold text-emerald">{money(order.total_amount)}</td>
                          <td>
                            <span
                              className={`status-pill ${String(order.status || "").toLowerCase()}`}
                            >
                              <span className="status-dot"></span>
                              {displayValue(order.status)}
                            </span>
                          </td>
                          <td className="text-muted text-sm">
                            {formatAdminDate(order.created_at)}
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
        {!dataUnavailable && activeTab === "dashboard" && dashboardView === "sales" && (
          <div className="dashboard-tab-view animate-fade-in">
            {/* Sales window KPI cards */}
            <div className="sales-mini-grid">
              <div className="sales-mini-card teal">
                <span className="sales-mini-label">Today Orders</span>
                <span className="sales-mini-value">
                  {formatCurrency(salesReport.windows.today.revenue)}
                </span>
                <span className="sales-mini-sub">
                  {salesReport.windows.today.orders} orders today
                </span>
              </div>
              <div className="sales-mini-card orange">
                <span className="sales-mini-label">Yesterday Orders</span>
                <span className="sales-mini-value">
                  {formatCurrency(salesReport.windows.yesterday.revenue)}
                </span>
                <span className="sales-mini-sub">
                  {salesReport.windows.yesterday.orders} orders yesterday
                </span>
              </div>
              <div className="sales-mini-card blue">
                <span className="sales-mini-label">This Month</span>
                <span className="sales-mini-value">
                  {formatCurrency(salesReport.windows.thisMonth.revenue)}
                </span>
                <span className="sales-mini-sub">
                  {salesReport.windows.thisMonth.orders} orders this month
                </span>
              </div>
              <div className="sales-mini-card green">
                <span className="sales-mini-label">Last Month</span>
                <span className="sales-mini-value">
                  {formatCurrency(salesReport.windows.lastMonth.revenue)}
                </span>
                <span className="sales-mini-sub">
                  {salesReport.windows.lastMonth.orders} orders last month
                </span>
              </div>
            </div>

            {/* Pipeline + best sellers */}
            <div className="reports-grid-2">
              <div className="report-card">
                <div className="chart-card-header">
                  <div>
                    <h3 className="chart-title">Orders & Revenue</h3>
                    <p className="chart-subtitle">Orders and revenue trends over time</p>
                  </div>
                  <ClipboardList size={18} className="text-muted" />
                </div>
                <OrdersPlusRevenueChart data={chartData.points} />
              </div>
              <div className="report-card">
                <div className="chart-card-header">
                  <div>
                    <h3 className="chart-title">Best Selling Products</h3>
                    <p className="chart-subtitle">Ranked by revenue from order line items</p>
                  </div>
                  <Star size={18} className="text-muted" />
                </div>
                <BestSellersChart data={salesReport.sellers} />
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
                  <strong style={{ color: "#0f172a" }}>
                    {salesReport.repeat.repeatRate.toFixed(1)}%
                  </strong>
                  {` of ${salesReport.repeat.totalCustomers} customers bought more than once`}
                </p>
                {salesReport.repeat.top.length === 0 ? (
                  <p className="report-empty">No repeat buyers yet.</p>
                ) : (
                  salesReport.repeat.top.map((buyer) => (
                    <div key={buyer.key} className="repeat-row">
                      <div className="repeat-avatar">{displayInitial(buyer.name)}</div>
                      <div className="repeat-info">
                        <div className="repeat-name">{displayValue(buyer.name)}</div>
                        <div className="repeat-meta">
                          {displayValue(buyer.email)} • {buyer.orders} orders
                        </div>
                      </div>
                      <span className="topseller-rev">{formatCurrency(buyer.spent)}</span>
                      <span className="repeat-badge">Repeat</span>
                    </div>
                  ))
                )}
              </div>
              <div className="report-card">
                <div className="chart-card-header">
                  <div>
                    <h3 className="chart-title">Repeat Customers</h3>
                    <p className="chart-subtitle">Shoppers who ordered more than once</p>
                  </div>
                  <Repeat size={18} className="text-muted" />
                </div>
                <CustomerRepeatChart data={salesReport.repeat} />
              </div>
              <div className="report-card">
                <div className="chart-card-header">
                  <div>
                    <h3 className="chart-title">Inventory Snapshot</h3>
                    <p className="chart-subtitle">Catalog value at current selling price</p>
                  </div>
                  <Boxes size={18} className="text-muted" />
                </div>
                <InventoryChart data={salesReport.inventory} />
                <div className="chart-card-footer-action">
                  <Button
                    variant="outline"
                    className="full-width-btn"
                    onClick={() => {
                      setActiveTab("products");
                      setProductsView("list");
                    }}
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
        {!dataUnavailable && activeTab === "users" && (
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
              </div>
            </div>

            {/* USERS DATA TABLE */}
            <div className="users-table-card">
              <div className="table-card-top-info">
                <span className="results-count">
                  Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong>{" "}
                  registered accounts in Supabase DB
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
                                {displayInitial(userItem.full_name || userItem.email)}
                              </div>
                              <div className="user-meta-column">
                                <span className="user-full-name">
                                  {displayValue(userItem.full_name)}
                                </span>
                                <span className="user-email-text">
                                  {displayValue(userItem.email)}
                                </span>
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
                                  {displayValue(userItem.store_name)}
                                </span>
                              ) : (
                                <span className="plan-name-tag">{displayValue(userItem.plan)}</span>
                              )}
                            </div>
                          </td>

                          {/* Joined Date */}
                          <td className="text-muted text-sm font-mono">
                            {formatAdminDate(userItem.created_at)}
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
                      onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      disabled={userPage === totalUserPages}
                      onClick={() => setUserPage((p) => Math.min(totalUserPages, p + 1))}
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
        {!dataUnavailable && activeTab === "products" && (
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
              {productsView === "add" && (
                <Button
                  id="admin-add-product-button"
                  onClick={handleOpenAddProduct}
                  className="add-user-primary-btn"
                >
                  <Plus size={16} />
                  <span>Add Product</span>
                </Button>
              )}
            </div>

            {productsView === "add" && (
              <div
                className="modal-backdrop-overlay"
                onClick={() => {
                  setEditingProduct(null);
                  setProductsView("list");
                }}
              >
                <div
                  className="modal-content-container animate-scale-up"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="modal-header">
                    <div className="modal-title-with-icon">
                      <div>
                        <h3 className="modal-title">
                          {editingProduct ? "Edit Product" : "Add Product"}
                        </h3>
                        <p className="modal-subtitle">
                          {editingProduct
                            ? "Updates go live on the storefront immediately."
                            : "New products publish straight to the storefront."}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEditingProduct(null);
                        setProductsView("list");
                      }}
                      className="modal-close-btn"
                      aria-label="Close product form"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <form onSubmit={handleSaveProduct} className="modal-form">
                    <div className="form-group-row">
                      <div className="form-group">
                        <label className="form-label">Product Title *</label>
                        <Input
                          required
                          type="text"
                          placeholder="e.g. Aurora Wireless Speaker"
                          value={productForm.title}
                          onChange={(e) =>
                            setProductForm((prev) => ({ ...prev, title: e.target.value }))
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Category</label>
                        <CategoryPicker
                          value={productForm.category_id}
                          label={productForm.category}
                          onChange={(id, name) =>
                            setProductForm((prev) => ({
                              ...prev,
                              category_id: id,
                              category: name ?? prev.category,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="form-group-row">
                      <div className="form-group">
                        <label className="form-label">Price (₹) *</label>
                        <Input
                          required
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="e.g. 4999"
                          value={productForm.price}
                          onChange={(e) =>
                            setProductForm((prev) => ({ ...prev, price: e.target.value }))
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Original Price (₹)</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Optional"
                          value={productForm.original_price}
                          onChange={(e) =>
                            setProductForm((prev) => ({
                              ...prev,
                              original_price: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Stock Units</label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="e.g. 25"
                          value={productForm.stock}
                          onChange={(e) =>
                            setProductForm((prev) => ({ ...prev, stock: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Product Image</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProductImageUpload}
                        className="form-select-field"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Description</label>
                      <Input
                        type="text"
                        placeholder="Short product description"
                        value={productForm.description}
                        onChange={(e) =>
                          setProductForm((prev) => ({ ...prev, description: e.target.value }))
                        }
                      />
                    </div>
                    <div className="modal-actions-footer">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingProduct(null);
                          setProductsView("list");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={productSaving} className="submit-primary-btn">
                        {productSaving ? (
                          <>
                            <RefreshCw size={15} className="spin-animation" /> Saving...
                          </>
                        ) : (
                          <>
                            <Check size={16} />{" "}
                            {editingProduct ? "Save Changes" : "Publish Product"}
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="users-table-card">
              <div className="table-card-top-info">
                <span className="results-count">
                  Showing <strong>{filteredProducts.length}</strong> of{" "}
                  <strong>{products.length}</strong> catalog items
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
                                {prod.image_url || prod.image ? (
                                  <img
                                    src={prod.image_url || prod.image}
                                    alt={prod.title}
                                    className="product-thumb"
                                  />
                                ) : null}
                                <div>
                                  <div className="product-title-text">
                                    {displayValue(prod.title)}
                                  </div>
                                  <div className="product-sku-text">{displayValue(prod.sku)}</div>
                                </div>
                              </div>
                            </td>
                            <td>{displayValue(prod.category)}</td>
                            <td className="font-bold">
                              {money(prod.price)}
                              {prod.original_price ? (
                                <span className="text-muted text-sm">
                                  {" "}
                                  <s>{money(prod.original_price)}</s>
                                </span>
                              ) : null}
                            </td>
                            <td>
                              {prod.stock === null ||
                              prod.stock === undefined ||
                              String(prod.stock).trim() === "" ? (
                                EMPTY
                              ) : (
                                <span
                                  className={`stock-pill ${stockCount <= 0 ? "out" : isLowStock(stockCount) ? "low" : "ok"}`}
                                >
                                  {stockCount} in stock
                                </span>
                              )}
                            </td>
                            <td>
                              <button
                                className="feature-star-btn"
                                onClick={() => handleToggleFeatured(prod)}
                                title={
                                  prod.is_featured ? "Remove featured flag" : "Mark as featured"
                                }
                                aria-label={
                                  prod.is_featured
                                    ? `Unmark ${prod.title} as featured`
                                    : `Mark ${prod.title} as featured`
                                }
                                aria-pressed={!!prod.is_featured}
                              >
                                <Star
                                  size={17}
                                  color={prod.is_featured ? "#f59e0b" : "#cbd5e1"}
                                  fill={prod.is_featured ? "#f59e0b" : "none"}
                                />
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
        {!dataUnavailable && activeTab === "orders" && (
          <div className="dashboard-tab-view animate-fade-in">
            <div className="report-pills-row">
              {[
                ["all", "All Orders", orders.length],
                ...ORDER_STATUSES.map((status) => [
                  status,
                  ORDER_STATUS_LABELS[status],
                  salesReport.statuses[status],
                ]),
              ].map(([value, label, count]) => (
                <button
                  key={value}
                  onClick={() => setOrdersView(value)}
                  className={`chart-pill-btn ${ordersView === value ? "active" : ""}`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>
            <div className="users-control-toolbar">
              <div className="search-input-wrapper">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search orders by reference, customer, or item..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="users-search-field"
                />
                {orderSearch && (
                  <button
                    onClick={() => setOrderSearch("")}
                    className="clear-search-btn"
                    aria-label="Clear order search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="users-table-card">
              <div className="table-card-top-info">
                <span className="results-count">
                  Showing <strong>{visibleOrders.length}</strong> of{" "}
                  <strong>{filteredOrders.length}</strong> order records
                  {visibleOrders.length > ORDER_ROW_LIMIT
                    ? ` (first ${ORDER_ROW_LIMIT} shown — narrow the search or the stage)`
                    : ""}
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
                    {visibleOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="empty-table-cell">
                          <ClipboardList size={28} className="empty-icon" />
                          <p>
                            {orderSearch.trim()
                              ? "No orders match your search."
                              : "No orders in this stage yet."}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      visibleOrders.slice(0, ORDER_ROW_LIMIT).map((order, idx) => (
                        <tr key={order.id || idx}>
                          <td className="font-mono text-primary font-bold">{orderRef(order)}</td>
                          <td>
                            <div className="customer-info-cell">
                              <span className="customer-name">
                                {displayValue(order.customer_name)}
                              </span>
                              <span className="customer-email">
                                {displayValue(order.customer_email)}
                              </span>
                            </div>
                          </td>
                          <td>
                            {Array.isArray(order.items) ? `${order.items.length} items` : EMPTY}
                          </td>
                          <td className="font-bold text-emerald">{money(order.total_amount)}</td>
                          <td>
                            <span
                              className={`status-pill ${String(order.status || "").toLowerCase()}`}
                            >
                              <span className="status-dot"></span>
                              {displayValue(order.status)}
                            </span>
                          </td>
                          <td className="text-muted text-sm">
                            {formatAdminDate(order.created_at)}
                          </td>
                          <td className="text-right">
                            {order.status === "processing" || order.status === "shipped" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAdvanceOrder(order)}
                              >
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
        {!dataUnavailable && activeTab === "customers" && (
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
            <div className="users-control-toolbar">
              <div className="search-input-wrapper">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search customers by name, email, or store..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="users-search-field"
                />
                {customerSearch && (
                  <button
                    onClick={() => setCustomerSearch("")}
                    className="clear-search-btn"
                    aria-label="Clear customer search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="users-table-card">
              <div className="table-card-top-info">
                <span className="results-count">
                  Showing <strong>{visibleCustomers.length}</strong> of{" "}
                  <strong>{customerSegment.length}</strong> customers
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
                          <p>
                            {customerSearch.trim()
                              ? "No customers match your search."
                              : "No customers in this segment yet."}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      visibleCustomers.slice(0, 20).map((cust) => (
                        <tr key={cust.id || cust.email}>
                          <td>
                            <div className="user-profile-cell">
                              <div className="user-table-avatar user">
                                {displayInitial(cust.name)}
                              </div>
                              <div className="user-meta-column">
                                <span className="user-full-name">{displayValue(cust.name)}</span>
                                <span className="user-email-text">{displayValue(cust.email)}</span>
                              </div>
                            </div>
                          </td>
                          <td className="font-bold">{cust.orders}</td>
                          <td className="font-bold text-emerald">{formatCurrency(cust.spent)}</td>
                          <td className="text-muted text-sm">
                            {formatAdminDate(cust.lastOrderAt)}
                          </td>
                          <td>
                            {cust.repeat ? (
                              <span className="repeat-badge">Repeat Buyer</span>
                            ) : (
                              renderStatusBadge(cust.status)
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
        {/* TAB 6: SITE CONTENT > MENUS */}
        {/* ================================================== */}
        {activeTab === "menus" && canManageSiteContent && (
          <MenuTreeEditor role={isSuperAdmin ? "super_admin" : currentRole || "admin"} />
        )}

        {/* TAB 7: SITE CONTENT > HERO (Task 5) */}
        {activeTab === "hero" && canManageSiteContent && <HeroSlidesEditor />}

        {/* TAB 8: SITE CONTENT > CATEGORIES (Task 5) */}
        {activeTab === "categories" && canManageSiteContent && <CategoriesTreeEditor />}

        {/* TAB 9: SITE CONTENT > BANNERS (Task 16) */}
        {activeTab === "banners" && canManageSiteContent && <BannersEditor />}

        {/* TAB 10: SITE CONTENT > FOOTER (Task 16) */}
        {activeTab === "footer" && canManageSiteContent && <FooterEditor />}

        {/* TAB 11: SITE CONTENT > PAGES — the CMS page builder */}
        {activeTab === "pages" && canManageSiteContent && <PagesEditor />}

        {/* TAB 12: SETTINGS — the store's own configuration */}
        {activeTab === "settings" && <SettingsEditor />}
      </main>

      {/* ==================================================== */}
      {/* 3. MODALS & POPUPS                                   */}
      {/* ==================================================== */}

      <CreateUserModal
        isOpen={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        form={addUserForm}
        setForm={setAddUserForm}
        onSubmit={handleCreateUser}
        loading={addUserLoading}
        isSuperAdmin={isSuperAdmin}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        onGeneratePassword={generateRandomPassword}
      />

      <ViewUserModal
        user={viewingUser}
        onClose={() => setViewingUser(null)}
        renderRoleBadge={renderRoleBadge}
        renderStatusBadge={renderStatusBadge}
        onEdit={(target) => {
          setViewingUser(null);
          handleOpenEditUser(target);
        }}
        onResetPassword={(target) => {
          setViewingUser(null);
          setResetTargetUser(target);
        }}
        onToggleStatus={(id, status, name) => handleToggleStatus(id, status, name)}
        onCopyId={(id) => {
          navigator.clipboard.writeText(id);
          addToast({
            title: "Copied",
            message: "User ID copied to clipboard.",
            type: "info",
          });
        }}
      />

      <EditUserModal
        user={editingUser}
        onClose={() => setEditingUser(null)}
        form={editUserForm}
        setForm={setEditUserForm}
        onSubmit={handleSaveEditUser}
        loading={editUserLoading}
        isSuperAdmin={isSuperAdmin}
      />

      <ResetPasswordModal
        user={resetTargetUser}
        onClose={() => setResetTargetUser(null)}
        newPassword={resetNewPassword}
        setNewPassword={setResetNewPassword}
        onSubmit={handleResetPassword}
        loading={resetPasswordLoading}
      />

      <DeleteUserModal
        user={deletingUser}
        onClose={() => setDeletingUser(null)}
        onConfirm={handleDeleteUser}
        loading={deleteLoading}
      />
    </div>
  );
}
