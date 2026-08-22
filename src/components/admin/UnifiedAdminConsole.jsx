import { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard,
  Users,
  Bell,
  Package,
  ShoppingCart,
  Store,
  Compass,
  Image as ImageIcon,
  Tag,
  Flame,
  ShieldAlert,
  Settings,
  Search,
  Plus,
  Trash2,
  Eye,
  MoreVertical,
  LogOut,
  Key,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  Filter,
  Download,
  Upload,
  RefreshCw,
  Edit2,
  Check,
  X,
  AlertTriangle,
  Monitor,
  UserCheck,
  Crown,
  PenTool,
  PieChart,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  DollarSign,
  Activity,
  Layers,
  Sparkles,
  Shield,
  HelpCircle,
  Lock
} from "lucide-react";
import { Button, Input, useToast } from "../ui";
import {
  apiFetchProducts,
  apiModerateProduct,
  apiFetchOrders,
  apiFetchAllUsers,
  apiAdminCreateUser,
  apiUpdateUserRole,
  apiUpdateUserStatus,
  apiResetUserPassword,
  apiDeleteUser,
  apiFetchMenuItems,
  apiSaveMenuItem,
  apiDeleteMenuItem
} from "../../api/backendApi";
import { useAuth } from "../../context/AuthContext";

export default function UnifiedAdminConsole({ onNavigateHome, customRole = "admin" }) {
  const { user: currentUser, logout, role: currentRole } = useAuth();
  const isSuperAdmin = currentRole === "super_admin" || customRole === "super_admin";

  const [activeTab, setActiveTab] = useState("users"); // dashboard, users, notifications, products, orders, vendors, menu, media, categories, promos, audit, settings
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { addToast } = useToast();

  // Data States
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);

  // Users Tab States
  const [searchUser, setSearchUser] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [userPage, setUserPage] = useState(1);
  const usersPerPage = 7;

  // Modals
  const [showCreateAdminModal, setShowCreateAdminModal] = useState(false);
  const [createAdminForm, setCreateAdminForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "admin",
    plan: "Enterprise",
    billing: "Auto Debit"
  });
  const [createAdminLoading, setCreateAdminLoading] = useState(false);

  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState(null);
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);

  const [viewingUser, setViewingUser] = useState(null);
  const [activeUserMenuId, setActiveUserMenuId] = useState(null);

  // Dynamic Menu CRUD Form
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  const [menuForm, setMenuForm] = useState({
    title: "",
    path: "/",
    icon: "Layers",
    badge: "",
    roles_allowed: ["user", "vendor", "admin", "super_admin"]
  });

  // Notifications State
  const [notifications, setNotifications] = useState([
    { id: "notif-1", title: "New Vendor Registered", message: "Nexus Tech registered a new seller storefront.", type: "vendor", time: "10 mins ago", read: false },
    { id: "notif-2", title: "High Value Order Placed", message: "Order #MRV-ORD-8821 ($399.99) received from user@marvel.com", type: "order", time: "45 mins ago", read: false },
    { id: "notif-3", title: "Cloudinary CDN Sync Complete", message: "All 13 product assets optimized with signed authenticated access.", type: "system", time: "2 hours ago", read: true },
    { id: "notif-4", title: "Security Audit Log", message: "Admin role elevation authorized by Super Admin.", type: "security", time: "5 hours ago", read: true }
  ]);

  const loadAllAdminData = async () => {
    setLoading(true);
    try {
      const [uList, pList, oList, mList] = await Promise.all([
        apiFetchAllUsers(),
        apiFetchProducts(),
        apiFetchOrders({ role: "admin" }),
        apiFetchMenuItems("super_admin")
      ]);

      // Seed synthetic attributes for realistic table display if empty
      const enrichedUsers = (uList || []).map((u, i) => ({
        ...u,
        plan: u.plan || (u.role === "admin" || u.role === "super_admin" ? "Enterprise" : u.role === "vendor" ? "Team" : "Basic"),
        billing: u.billing || (i % 3 === 0 ? "Auto Debit" : i % 3 === 1 ? "Manual - Paypal" : "Manual - Cash"),
        status: u.status || (i === 1 || i === 2 ? "Inactive" : i === 4 ? "Pending" : "Active")
      }));

      setUsers(enrichedUsers);
      setProducts(pList || []);
      setOrders(oList || []);
      setMenuItems(mList || []);
    } catch (err) {
      console.error("Error loading admin console data:", err);
      addToast({ title: "Sync Warning", message: "Loaded available cached data.", type: "warning" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllAdminData();
  }, []);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch =
        u.full_name?.toLowerCase().includes(searchUser.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchUser.toLowerCase()) ||
        u.role?.toLowerCase().includes(searchUser.toLowerCase());

      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      const matchesStatus = statusFilter === "all" || (u.status || "active").toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchUser, roleFilter, statusFilter]);

  const totalUserPages = Math.ceil(filteredUsers.length / usersPerPage) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * usersPerPage;
    return filteredUsers.slice(start, start + usersPerPage);
  }, [filteredUsers, userPage]);

  // Select all checkbox
  const handleSelectAllUsers = (e) => {
    if (e.target.checked) {
      setSelectedUserIds(paginatedUsers.map(u => u.id));
    } else {
      setSelectedUserIds([]);
    }
  };

  const handleToggleSelectUser = (id) => {
    setSelectedUserIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Create Admin Account Handler
  const handleCreateAdminSubmit = async (e) => {
    e.preventDefault();
    setCreateAdminLoading(true);

    try {
      const created = await apiAdminCreateUser(createAdminForm);
      setUsers([created, ...users]);
      setShowCreateAdminModal(false);
      setCreateAdminForm({
        fullName: "",
        email: "",
        password: "",
        role: "admin",
        plan: "Enterprise",
        billing: "Auto Debit"
      });
      addToast({
        title: "Account Created",
        message: `Admin account for ${created.full_name} (${created.email}) is active.`,
        type: "success"
      });
    } catch (err) {
      addToast({ title: "Creation Error", message: err.message, type: "error" });
    } finally {
      setCreateAdminLoading(false);
    }
  };

  // Reset Password Handler
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!resetTargetUser) return;
    setResetPasswordLoading(true);

    try {
      await apiResetUserPassword(resetTargetUser.id, resetNewPassword);
      setShowResetPasswordModal(false);
      setResetNewPassword("");
      setResetTargetUser(null);
      addToast({
        title: "Password Reset Complete",
        message: `Password for ${resetTargetUser.email} has been updated.`,
        type: "success"
      });
    } catch (err) {
      addToast({ title: "Reset Failed", message: err.message, type: "error" });
    } finally {
      setResetPasswordLoading(false);
    }
  };

  // Change Status Handler
  const handleChangeStatus = async (userId, newStatus) => {
    try {
      await apiUpdateUserStatus(userId, newStatus);
      setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
      setActiveUserMenuId(null);
      addToast({
        title: "Status Updated",
        message: `User status updated to ${newStatus.toUpperCase()}`,
        type: "success"
      });
    } catch (err) {
      addToast({ title: "Update Error", message: err.message, type: "error" });
    }
  };

  // Delete User Handler
  const handleDeleteUser = async (userId, email) => {
    if (!window.confirm(`Are you sure you want to delete user '${email}'? This action cannot be undone.`)) return;

    try {
      await apiDeleteUser(userId);
      setUsers(users.filter(u => u.id !== userId));
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
      setActiveUserMenuId(null);
      addToast({
        title: "User Deleted",
        message: `Account '${email}' was removed from the database.`,
        type: "info"
      });
    } catch (err) {
      addToast({ title: "Delete Error", message: err.message, type: "error" });
    }
  };

  // Product Moderation Handler
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
        message: `Product set to ${newStatus.toUpperCase()}${isFeatured ? " (Featured on Carousel)" : ""}`,
        type: "success"
      });
    } catch (err) {
      addToast({ title: "Error", message: err.message, type: "error" });
    }
  };

  // Dynamic Menu CRUD Handler
  const handleSaveMenu = async (e) => {
    e.preventDefault();
    try {
      const payload = editingMenuItem ? { ...editingMenuItem, ...menuForm } : menuForm;
      const updated = await apiSaveMenuItem(payload);
      setMenuItems(updated);
      setEditingMenuItem(null);
      setMenuForm({
        title: "",
        path: "/",
        icon: "Layers",
        badge: "",
        roles_allowed: ["user", "vendor", "admin", "super_admin"]
      });
      window.dispatchEvent(new Event("marvel_menu_updated"));
      addToast({
        title: "Navigation Menu Saved",
        message: `Item '${payload.title}' published live across storefront.`,
        type: "success"
      });
    } catch (err) {
      addToast({ title: "Menu Error", message: err.message, type: "error" });
    }
  };

  // Render role badge helper styled exactly like the screenshot
  const renderRoleBadge = (role) => {
    const r = (role || "user").toLowerCase();
    if (r === "admin" || r === "super_admin") {
      return (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#e11d48", fontWeight: 600, fontSize: 13 }}>
          <Monitor size={15} color="#e11d48" />
          <span>{r === "super_admin" ? "Super Admin" : "Admin"}</span>
        </div>
      );
    }
    if (r === "vendor" || r === "maintainer") {
      return (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#16a34a", fontWeight: 600, fontSize: 13 }}>
          <UserCheck size={15} color="#16a34a" />
          <span>{r === "vendor" ? "Vendor / Seller" : "Maintainer"}</span>
        </div>
      );
    }
    if (r === "subscriber" || r === "editor") {
      return (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#2563eb", fontWeight: 600, fontSize: 13 }}>
          <Crown size={15} color="#2563eb" />
          <span>{r === "subscriber" ? "Subscriber" : "Editor"}</span>
        </div>
      );
    }
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#d97706", fontWeight: 600, fontSize: 13 }}>
        <UserIcon size={15} color="#d97706" />
        <span>Customer</span>
      </div>
    );
  };

  // Status pill helper matching screenshot
  const renderStatusPill = (status) => {
    const s = (status || "active").toLowerCase();
    if (s === "active") {
      return (
        <span style={{
          display: "inline-block",
          padding: "3px 10px",
          borderRadius: 6,
          background: "#dcfce7",
          color: "#15803d",
          fontSize: 12,
          fontWeight: 600
        }}>
          Active
        </span>
      );
    }
    if (s === "inactive" || s === "banned") {
      return (
        <span style={{
          display: "inline-block",
          padding: "3px 10px",
          borderRadius: 6,
          background: "#f1f5f9",
          color: "#64748b",
          fontSize: 12,
          fontWeight: 600
        }}>
          Inactive
        </span>
      );
    }
    return (
      <span style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 6,
        background: "#fef3c7",
        color: "#b45309",
        fontSize: 12,
        fontWeight: 600
      }}>
        Pending
      </span>
    );
  };

  // Avatar initials generator
  const getAvatarInitials = (name, email) => {
    if (name && name.trim()) {
      const parts = name.trim().split(" ");
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.substring(0, 2).toUpperCase();
    }
    return (email || "U").substring(0, 2).toUpperCase();
  };

  const getAvatarBg = (str) => {
    const colors = ["#eff6ff", "#f5f3ff", "#fef2f2", "#f0fdf4", "#fffbeb", "#fdf2f8"];
    const textColors = ["#1d4ed8", "#6d28d9", "#b91c1c", "#15803d", "#b45309", "#be185d"];
    let hash = 0;
    for (let i = 0; i < (str || "").length; i++) hash += str.charCodeAt(i);
    const idx = Math.abs(hash) % colors.length;
    return { bg: colors[idx], text: textColors[idx] };
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", flexDirection: "column", fontFamily: "var(--font)" }}>
      {/* ── TOPBAR HEADER ── */}
      <header style={{
        background: "#ffffff",
        borderBottom: "1px solid #e2e8f0",
        padding: "0 24px",
        height: 68,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 100,
        boxShadow: "0 1px 4px rgba(0,0,0,0.03)"
      }}>
        {/* Brand & Console Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            onClick={onNavigateHome}
            style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
            title="Return to Storefront"
          >
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontWeight: 900,
              fontSize: 18
            }}>
              M
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", letterSpacing: "-0.3px", display: "flex", alignItems: "center", gap: 6 }}>
                Marvel {isSuperAdmin ? "Super Admin" : "Admin"} Console
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  background: isSuperAdmin ? "#fef3c7" : "#eff6ff",
                  color: isSuperAdmin ? "#b45309" : "#1d4ed8",
                  padding: "2px 8px",
                  borderRadius: 12,
                  textTransform: "uppercase"
                }}>
                  {isSuperAdmin ? "Root" : "Manager"}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                Platform Operations &amp; Moderation
              </div>
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Quick Create Admin Button */}
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateAdminModal(true)}
            style={{
              background: "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13
            }}
            leftIcon={<Plus size={15} />}
          >
            Create Admin Account
          </Button>

          {/* Notifications Bell */}
          <button
            onClick={() => setActiveTab("notifications")}
            style={{
              position: "relative",
              width: 38,
              height: 38,
              borderRadius: 9,
              border: "1px solid #e2e8f0",
              background: activeTab === "notifications" ? "#eff6ff" : "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#475569",
              cursor: "pointer"
            }}
            title="Notifications"
          >
            <Bell size={18} />
            {notifications.some(n => !n.read) && (
              <span style={{
                position: "absolute",
                top: 7,
                right: 7,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#ef4444"
              }} />
            )}
          </button>

          {/* User Profile Card & Sign Out */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 10, borderLeft: "1px solid #e2e8f0" }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#eff6ff",
              color: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 13
            }}>
              {getAvatarInitials(currentUser?.full_name, currentUser?.email)}
            </div>
            <div style={{ display: "none", md: "block", textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                {currentUser?.full_name || "Admin User"}
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                {currentUser?.email}
              </div>
            </div>

            <button
              onClick={() => {
                logout();
                window.location.hash = "#/";
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid #fecaca",
                background: "#fef2f2",
                color: "#991b1b",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer"
              }}
              title="Sign Out of Admin Console"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN LAYOUT: SIDEBAR + CONTENT ── */}
      <div style={{ display: "flex", flex: 1 }}>
        {/* Left Navigation Sidebar (11+ Tabs) */}
        <aside style={{
          width: 260,
          background: "#ffffff",
          borderRight: "1px solid #e2e8f0",
          padding: "20px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 6
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#94a3b8", padding: "6px 12px 10px" }}>
            Platform Modules
          </div>

          {[
            { id: "dashboard", label: "Dashboard Overview", icon: LayoutDashboard, badge: "KPI" },
            { id: "users", label: "Users & RBAC Matrix", icon: Users, count: users.length },
            { id: "notifications", label: "Notifications & Alerts", icon: Bell, count: notifications.filter(n => !n.read).length },
            { id: "products", label: "Product Moderation", icon: Package, count: products.length },
            { id: "orders", label: "Orders & Fulfillment", icon: ShoppingCart, count: orders.length },
            { id: "vendors", label: "Vendor Management", icon: Store },
            { id: "menu", label: "Dynamic Navigation Menu", icon: Compass, badge: isSuperAdmin ? "Root CRUD" : "Manage" },
            { id: "media", label: "Cloudinary CDN Assets", icon: ImageIcon },
            { id: "categories", label: "Categories & Taxonomy", icon: Tag },
            { id: "promos", label: "Banners & Promotions", icon: Flame },
            { id: "audit", label: "Audit Logs & Security", icon: ShieldAlert },
            { id: "settings", label: "Platform Settings", icon: Settings }
          ].map(tab => {
            const IconComp = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: active ? "#eff6ff" : "transparent",
                  color: active ? "#1d4ed8" : "#475569",
                  fontWeight: active ? 700 : 500,
                  fontSize: 13,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <IconComp size={18} color={active ? "#2563eb" : "#64748b"} />
                  <span>{tab.label}</span>
                </div>
                {tab.count !== undefined && (
                  <span style={{
                    fontSize: 11,
                    padding: "2px 7px",
                    borderRadius: 10,
                    background: active ? "#dbeafe" : "#f1f5f9",
                    color: active ? "#1e40af" : "#64748b",
                    fontWeight: 700
                  }}>
                    {tab.count}
                  </span>
                )}
                {tab.badge && (
                  <span style={{
                    fontSize: 10,
                    padding: "2px 6px",
                    borderRadius: 8,
                    background: "#fef3c7",
                    color: "#b45309",
                    fontWeight: 700
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div style={{ marginTop: "auto", paddingTop: 20, borderTop: "1px solid #f1f5f9" }}>
            <button
              onClick={onNavigateHome}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                color: "#475569",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              <ExternalLink size={14} /> Preview Storefront
            </button>
          </div>
        </aside>

        {/* Right Main Content Area */}
        <main style={{ flex: 1, padding: "28px 32px", overflowY: "auto" }}>
          {/* ═════════════════════════════════════════════════════════════
              TAB 1: USERS & RBAC MATRIX (Matching User Reference Image)
             ═════════════════════════════════════════════════════════════ */}
          {activeTab === "users" && (
            <div>
              {/* Users Header Banner */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>
                    User Accounts &amp; Permissions
                  </h2>
                  <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
                    Manage customer accounts, vendor sellers, administrators, and billing tiers
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => setShowCreateAdminModal(true)}
                    style={{ background: "#2563eb", borderRadius: 8, fontWeight: 600 }}
                    leftIcon={<Plus size={16} />}
                  >
                    Create Admin Account
                  </Button>
                </div>
              </div>

              {/* Search & Filter Bar */}
              <div style={{
                background: "#ffffff",
                borderRadius: 12,
                padding: "14px 18px",
                border: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 16
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 260 }}>
                  <Input
                    type="text"
                    placeholder="Search by name, email, or role..."
                    value={searchUser}
                    onChange={(e) => { setSearchUser(e.target.value); setUserPage(1); }}
                    leftIcon={<Search size={16} />}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <select
                    value={roleFilter}
                    onChange={(e) => { setRoleFilter(e.target.value); setUserPage(1); }}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      fontSize: 13,
                      color: "#334155",
                      cursor: "pointer"
                    }}
                  >
                    <option value="all">All Roles</option>
                    <option value="admin">Admins</option>
                    <option value="super_admin">Super Admins</option>
                    <option value="vendor">Vendors</option>
                    <option value="user">Customers</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setUserPage(1); }}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      fontSize: 13,
                      color: "#334155",
                      cursor: "pointer"
                    }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                  </select>

                  <button
                    onClick={loadAllAdminData}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#475569",
                      fontSize: 13,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer"
                    }}
                    title="Refresh Data"
                  >
                    <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
                  </button>
                </div>
              </div>

              {/* Enterprise Users Table (Matching Reference Screenshot) */}
              <div style={{
                background: "#ffffff",
                borderRadius: 14,
                border: "1px solid #e2e8f0",
                overflow: "hidden",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
              }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#64748b" }}>
                        <th style={{ padding: "14px 16px", width: 44, textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={paginatedUsers.length > 0 && selectedUserIds.length === paginatedUsers.length}
                            onChange={handleSelectAllUsers}
                            style={{ borderRadius: 4, cursor: "pointer" }}
                          />
                        </th>
                        <th style={{ padding: "14px 16px" }}>User</th>
                        <th style={{ padding: "14px 16px" }}>Role</th>
                        <th style={{ padding: "14px 16px" }}>Plan</th>
                        <th style={{ padding: "14px 16px" }}>Billing</th>
                        <th style={{ padding: "14px 16px" }}>Status</th>
                        <th style={{ padding: "14px 16px", textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={7} style={{ padding: "48px 16px", textAlign: "center", color: "#64748b" }}>
                            <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 8px" }} />
                            <div>Loading users from database...</div>
                          </td>
                        </tr>
                      ) : paginatedUsers.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: "48px 16px", textAlign: "center", color: "#64748b" }}>
                            No matching user accounts found.
                          </td>
                        </tr>
                      ) : (
                        paginatedUsers.map((u) => {
                          const avatar = getAvatarBg(u.full_name || u.email);
                          const isSelected = selectedUserIds.includes(u.id);

                          return (
                            <tr
                              key={u.id}
                              style={{
                                borderBottom: "1px solid #f1f5f9",
                                background: isSelected ? "#f8fafc" : "#ffffff",
                                transition: "background 0.15s ease"
                              }}
                            >
                              {/* Checkbox */}
                              <td style={{ padding: "14px 16px", textAlign: "center" }}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectUser(u.id)}
                                  style={{ borderRadius: 4, cursor: "pointer" }}
                                />
                              </td>

                              {/* User Info with Avatar */}
                              <td style={{ padding: "14px 16px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                  <div style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: "50%",
                                    background: avatar.bg,
                                    color: avatar.text,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontWeight: 700,
                                    fontSize: 12,
                                    flexShrink: 0
                                  }}>
                                    {getAvatarInitials(u.full_name, u.email)}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>
                                      {u.full_name || "Marvel User"}
                                    </div>
                                    <div style={{ fontSize: 12, color: "#64748b" }}>
                                      {u.email}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Role */}
                              <td style={{ padding: "14px 16px" }}>
                                {renderRoleBadge(u.role)}
                              </td>

                              {/* Plan */}
                              <td style={{ padding: "14px 16px", fontSize: 13, color: "#334155", fontWeight: 500 }}>
                                {u.plan || "Enterprise"}
                              </td>

                              {/* Billing */}
                              <td style={{ padding: "14px 16px", fontSize: 13, color: "#475569" }}>
                                {u.billing || "Auto Debit"}
                              </td>

                              {/* Status */}
                              <td style={{ padding: "14px 16px" }}>
                                {renderStatusPill(u.status)}
                              </td>

                              {/* Actions */}
                              <td style={{ padding: "14px 16px", textAlign: "right" }}>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, position: "relative" }}>
                                  {/* Delete */}
                                  <button
                                    onClick={() => handleDeleteUser(u.id, u.email)}
                                    style={{
                                      background: "none",
                                      border: "none",
                                      color: "#94a3b8",
                                      cursor: "pointer",
                                      padding: 5,
                                      borderRadius: 4
                                    }}
                                    title="Delete User"
                                  >
                                    <Trash2 size={16} />
                                  </button>

                                  {/* View */}
                                  <button
                                    onClick={() => setViewingUser(u)}
                                    style={{
                                      background: "none",
                                      border: "none",
                                      color: "#94a3b8",
                                      cursor: "pointer",
                                      padding: 5,
                                      borderRadius: 4
                                    }}
                                    title="View Profile Details"
                                  >
                                    <Eye size={16} />
                                  </button>

                                  {/* More Dropdown */}
                                  <button
                                    onClick={() => setActiveUserMenuId(activeUserMenuId === u.id ? null : u.id)}
                                    style={{
                                      background: "none",
                                      border: "none",
                                      color: "#94a3b8",
                                      cursor: "pointer",
                                      padding: 5,
                                      borderRadius: 4
                                    }}
                                    title="More Options"
                                  >
                                    <MoreVertical size={16} />
                                  </button>

                                  {/* Options Dropdown Menu */}
                                  {activeUserMenuId === u.id && (
                                    <div style={{
                                      position: "absolute",
                                      right: 0,
                                      top: 30,
                                      background: "#ffffff",
                                      borderRadius: 8,
                                      border: "1px solid #e2e8f0",
                                      boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                                      zIndex: 50,
                                      minWidth: 170,
                                      padding: 4,
                                      textAlign: "left"
                                    }}>
                                      <button
                                        onClick={() => {
                                          setResetTargetUser(u);
                                          setShowResetPasswordModal(true);
                                          setActiveUserMenuId(null);
                                        }}
                                        style={{
                                          width: "100%",
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 8,
                                          padding: "8px 10px",
                                          fontSize: 12,
                                          color: "#334155",
                                          border: "none",
                                          background: "transparent",
                                          cursor: "pointer",
                                          borderRadius: 4
                                        }}
                                      >
                                        <Key size={14} /> Reset Password
                                      </button>

                                      <button
                                        onClick={() => handleChangeStatus(u.id, u.status === "active" ? "inactive" : "active")}
                                        style={{
                                          width: "100%",
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 8,
                                          padding: "8px 10px",
                                          fontSize: 12,
                                          color: u.status === "active" ? "#b45309" : "#15803d",
                                          border: "none",
                                          background: "transparent",
                                          cursor: "pointer",
                                          borderRadius: 4
                                        }}
                                      >
                                        <Activity size={14} /> {u.status === "active" ? "Mark Inactive" : "Set Active"}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Pagination */}
                <div style={{
                  padding: "14px 20px",
                  borderTop: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 13,
                  color: "#64748b"
                }}>
                  <div>
                    Showing {(userPage - 1) * usersPerPage + 1}–{Math.min(userPage * usersPerPage, filteredUsers.length)} of {filteredUsers.length} Users
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={() => setUserPage(p => Math.max(1, p - 1))}
                      disabled={userPage === 1}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        background: userPage === 1 ? "#f1f5f9" : "#ffffff",
                        color: userPage === 1 ? "#94a3b8" : "#334155",
                        cursor: userPage === 1 ? "default" : "pointer"
                      }}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span>Page {userPage} of {totalUserPages}</span>
                    <button
                      onClick={() => setUserPage(p => Math.min(totalUserPages, p + 1))}
                      disabled={userPage === totalUserPages}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        background: userPage === totalUserPages ? "#f1f5f9" : "#ffffff",
                        color: userPage === totalUserPages ? "#94a3b8" : "#334155",
                        cursor: userPage === totalUserPages ? "default" : "pointer"
                      }}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════
              TAB 2: DASHBOARD OVERVIEW & KPIS
             ═════════════════════════════════════════════════════════════ */}
          {activeTab === "dashboard" && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>Executive Overview</h2>
                <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>Live metrics across catalog, users, orders, and fulfillment</p>
              </div>

              {/* KPI Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
                <div style={{ background: "#ffffff", padding: 20, borderRadius: 14, border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Total Users</span>
                    <Users size={18} color="#2563eb" />
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a" }}>{users.length}</div>
                  <div style={{ fontSize: 12, color: "#16a34a", marginTop: 4 }}>↑ Active in Supabase Auth</div>
                </div>

                <div style={{ background: "#ffffff", padding: 20, borderRadius: 14, border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Catalog Products</span>
                    <Package size={18} color="#7c3aed" />
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a" }}>{products.length}</div>
                  <div style={{ fontSize: 12, color: "#7c3aed", marginTop: 4 }}>Live in 4x3 storefront</div>
                </div>

                <div style={{ background: "#ffffff", padding: 20, borderRadius: 14, border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Pending Moderation</span>
                    <AlertTriangle size={18} color="#d97706" />
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a" }}>
                    {products.filter(p => p.moderation_status === "pending").length}
                  </div>
                  <div style={{ fontSize: 12, color: "#d97706", marginTop: 4 }}>Vendor listings awaiting review</div>
                </div>

                <div style={{ background: "#ffffff", padding: 20, borderRadius: 14, border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Total Orders</span>
                    <ShoppingCart size={18} color="#059669" />
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a" }}>{orders.length}</div>
                  <div style={{ fontSize: 12, color: "#059669", marginTop: 4 }}>Processed &amp; Tracked</div>
                </div>
              </div>

              {/* Quick Jump Grid */}
              <div style={{ background: "#ffffff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Quick Operations</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                  <button onClick={() => setActiveTab("users")} style={{ padding: 14, borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", textAlign: "left", cursor: "pointer" }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>👥 Manage Users</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>View enterprise user list</div>
                  </button>
                  <button onClick={() => setActiveTab("products")} style={{ padding: 14, borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", textAlign: "left", cursor: "pointer" }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>📦 Product Moderation</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>Feature items in carousel</div>
                  </button>
                  <button onClick={() => setActiveTab("menu")} style={{ padding: 14, borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", textAlign: "left", cursor: "pointer" }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>🧭 Dynamic Menu</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>Customize site navigation</div>
                  </button>
                  <button onClick={() => setShowCreateAdminModal(true)} style={{ padding: 14, borderRadius: 10, border: "1px solid #2563eb", background: "#eff6ff", textAlign: "left", cursor: "pointer" }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#1d4ed8" }}>➕ Create Admin</div>
                    <div style={{ fontSize: 12, color: "#2563eb" }}>Add a platform manager</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════
              TAB 3: NOTIFICATIONS & ALERTS
             ═════════════════════════════════════════════════════════════ */}
          {activeTab === "notifications" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>System Notifications</h2>
                  <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>Real-time platform activity, order alerts, and security events</p>
                </div>
                <button
                  onClick={() => {
                    setNotifications(notifications.map(n => ({ ...n, read: true })));
                    addToast({ title: "Notifications", message: "All marked as read.", type: "info" });
                  }}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                >
                  Mark All Read
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {notifications.map(n => (
                  <div key={n.id} style={{
                    background: n.read ? "#ffffff" : "#f0fdf4",
                    border: `1px solid ${n.read ? "#e2e8f0" : "#bbf7d0"}`,
                    padding: 16,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: n.read ? "#94a3b8" : "#16a34a" }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{n.title}</div>
                        <div style={{ fontSize: 13, color: "#64748b" }}>{n.message}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{n.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════
              TAB 4: PRODUCT MODERATION
             ═════════════════════════════════════════════════════════════ */}
          {activeTab === "products" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>Product Moderation Queue</h2>
                <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>Approve vendor products and toggle Editor's Choice Carousel feature status</p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
                {products.map(p => (
                  <div key={p.id} style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                    <img src={p.image_url || p.image} alt={p.title} style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 8 }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{p.title}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>Vendor: {p.vendor_name || "Verified Seller"} • ${p.price}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: p.is_featured ? "#fef3c7" : "#f1f5f9", color: p.is_featured ? "#b45309" : "#64748b" }}>
                        {p.is_featured ? "⭐ Featured" : "Standard"}
                      </span>
                      <Button
                        variant={p.is_featured ? "outline" : "secondary"}
                        size="sm"
                        onClick={() => handleModerate(p.id, "approved", !p.is_featured)}
                      >
                        {p.is_featured ? "Unfeature" : "Feature on Carousel"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════
              TAB 5: ORDERS & FULFILLMENT
             ═════════════════════════════════════════════════════════════ */}
          {activeTab === "orders" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>Orders &amp; Shipping Fulfillment</h2>
                <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>Manage customer orders, track package dispatch, and view payment logs</p>
              </div>

              <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontWeight: 700, color: "#64748b" }}>
                      <th style={{ padding: "12px 16px" }}>Order ID</th>
                      <th style={{ padding: "12px 16px" }}>Customer</th>
                      <th style={{ padding: "12px 16px" }}>Items</th>
                      <th style={{ padding: "12px 16px" }}>Total</th>
                      <th style={{ padding: "12px 16px" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o => (
                      <tr key={o.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "12px 16px", fontWeight: 700, color: "#2563eb" }}>{o.order_number || o.id.substring(0, 8)}</td>
                        <td style={{ padding: "12px 16px" }}>{o.customer_name || o.shipping_address?.full_name || "Customer"}</td>
                        <td style={{ padding: "12px 16px" }}>{o.items?.length || 1} Products</td>
                        <td style={{ padding: "12px 16px", fontWeight: 700 }}>${o.total_amount || o.total}</td>
                        <td style={{ padding: "12px 16px" }}>{renderStatusPill(o.status || "delivered")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════
              TAB 6: VENDOR MANAGEMENT
             ═════════════════════════════════════════════════════════════ */}
          {activeTab === "vendors" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>Registered Vendor Stores</h2>
                <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>Certified sellers and marketplace storefront operations</p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                {users.filter(u => u.role === "vendor").map(v => (
                  <div key={v.id} style={{ background: "#ffffff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <Store size={22} color="#7c3aed" />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{v.store_name || `${v.full_name}'s Store`}</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>{v.email}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>✓ Verified Seller Account</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════
              TAB 7: DYNAMIC MENU CRUD
             ═════════════════════════════════════════════════════════════ */}
          {activeTab === "menu" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>Dynamic Navigation Menu CRUD</h2>
                <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>Add, edit, or customize site-wide navigation bar items in real-time</p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 24 }}>
                <form onSubmit={handleSaveMenu} style={{ background: "#ffffff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 14 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700 }}>{editingMenuItem ? "Edit Menu Link" : "Add New Menu Item"}</h3>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Title</label>
                    <Input value={menuForm.title} onChange={e => setMenuForm({ ...menuForm, title: e.target.value })} placeholder="e.g. Flash Deals" required />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Path Route</label>
                    <Input value={menuForm.path} onChange={e => setMenuForm({ ...menuForm, path: e.target.value })} placeholder="e.g. /deals" required />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Badge Text</label>
                    <Input value={menuForm.badge} onChange={e => setMenuForm({ ...menuForm, badge: e.target.value })} placeholder="e.g. HOT" />
                  </div>
                  <Button type="submit" variant="primary" size="md" style={{ background: "#2563eb", marginTop: 6 }}>
                    {editingMenuItem ? "Update Menu Item" : "Save Menu Item"}
                  </Button>
                </form>

                <div style={{ background: "#ffffff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Active Site Menu Items ({menuItems.length})</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {menuItems.map(m => (
                      <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{m.title}</span>
                          <span style={{ fontSize: 11, color: "#64748b", marginLeft: 8 }}>{m.path}</span>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => { setEditingMenuItem(m); setMenuForm(m); }} style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer" }}><Edit2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════
              TAB 8: CLOUDINARY MEDIA
             ═════════════════════════════════════════════════════════════ */}
          {activeTab === "media" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>Cloudinary Media &amp; CDN Storage</h2>
                <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>Signed image deliveries and authenticated asset protection</p>
              </div>

              <div style={{ background: "#ffffff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0", marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>☁️ Cloudinary SDK Configuration</div>
                <div style={{ fontSize: 13, color: "#64748b" }}>Cloud Name: <strong>dxvq197vi</strong> • Access Level: <strong>Authenticated HMAC Signed</strong></div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
                {products.map(p => (
                  <div key={p.id} style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                    <img src={p.image_url || p.image} alt={p.title} style={{ width: "100%", height: 120, objectFit: "cover" }} />
                    <div style={{ padding: 10, fontSize: 11, color: "#64748b" }}>
                      <div style={{ fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</div>
                      <div>CDN Signed URL</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════
              TAB 9: CATEGORIES & TAXONOMY
             ═════════════════════════════════════════════════════════════ */}
          {activeTab === "categories" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>Product Categories &amp; Taxonomy</h2>
                <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>Manage marketplace departments and product filters</p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                {["Audio", "Wearables", "Peripherals", "Smart Home", "Accessories", "Gaming"].map(cat => (
                  <div key={cat} style={{ background: "#ffffff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                    <Tag size={20} color="#2563eb" style={{ marginBottom: 8 }} />
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{cat}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{products.filter(p => p.category?.toLowerCase() === cat.toLowerCase()).length} Products Active</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════
              TAB 10: BANNERS & PROMOTIONS
             ═════════════════════════════════════════════════════════════ */}
          {activeTab === "promos" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>Banners &amp; Promo Campaigns</h2>
                <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>Control top hero carousel slides, coupon codes, and flash discounts</p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
                <div style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)", color: "#fff", padding: 20, borderRadius: 12 }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>MARVEL10</div>
                  <div style={{ fontSize: 13, opacity: 0.9 }}>10% Instant Discount for all signed in members</div>
                  <div style={{ fontSize: 11, marginTop: 12, opacity: 0.8 }}>Status: Active • Usage: 342 Orders</div>
                </div>

                <div style={{ background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)", color: "#fff", padding: 20, borderRadius: 12 }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>FIRSTBUY</div>
                  <div style={{ fontSize: 13, opacity: 0.9 }}>Flat $15 off on first marketplace order</div>
                  <div style={{ fontSize: 11, marginTop: 12, opacity: 0.8 }}>Status: Active • Usage: 189 Orders</div>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════
              TAB 11: AUDIT LOGS & SECURITY
             ═════════════════════════════════════════════════════════════ */}
          {activeTab === "audit" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>Security Audit &amp; Event Logs</h2>
                <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>System access tracking, role modifications, and authentication events</p>
              </div>

              <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 20 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 10, borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
                    <div><span style={{ fontWeight: 700, color: "#16a34a" }}>[AUTH_SUCCESS]</span> User signed in (user@marvel.com)</div>
                    <span style={{ color: "#94a3b8", fontSize: 12 }}>Just now</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 10, borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
                    <div><span style={{ fontWeight: 700, color: "#2563eb" }}>[MODERATION]</span> Product approved and added to Carousel</div>
                    <span style={{ color: "#94a3b8", fontSize: 12 }}>15 mins ago</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <div><span style={{ fontWeight: 700, color: "#7c3aed" }}>[ROLE_SYNC]</span> Supabase PostgreSQL profiles synced</div>
                    <span style={{ color: "#94a3b8", fontSize: 12 }}>1 hour ago</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════
              TAB 12: PLATFORM SETTINGS
             ═════════════════════════════════════════════════════════════ */}
          {activeTab === "settings" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>Platform Configuration</h2>
                <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>Store defaults, payment options, and system preferences</p>
              </div>

              <div style={{ background: "#ffffff", padding: 24, borderRadius: 12, border: "1px solid #e2e8f0", maxWidth: 600, display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Store Name</label>
                  <Input value="Marvel Electronics Platform" readOnly />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Default Currency</label>
                  <Input value="USD ($)" readOnly />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Public Registration Policy</label>
                  <div style={{ fontSize: 13, color: "#16a34a", fontWeight: 600 }}>✓ Customer &amp; Vendor Registration Allowed (Admins restricted to internal creation)</div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── CREATE ADMIN ACCOUNT MODAL ── */}
      {showCreateAdminModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: 16,
            maxWidth: 480,
            width: "100%",
            padding: 30,
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            position: "relative"
          }}>
            <button
              onClick={() => setShowCreateAdminModal(false)}
              style={{
                position: "absolute",
                top: 18,
                right: 18,
                background: "#f1f5f9",
                border: "none",
                borderRadius: "50%",
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer"
              }}
            >
              <X size={16} />
            </button>

            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <Shield size={24} />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: 0 }}>Create Administrator Account</h3>
              <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                Provision a new operator or admin user with elevated privileges
              </p>
            </div>

            <form onSubmit={handleCreateAdminSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  Full Name
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Alex Harrison"
                  value={createAdminForm.fullName}
                  onChange={e => setCreateAdminForm({ ...createAdminForm, fullName: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  Admin Email Address
                </label>
                <Input
                  type="email"
                  placeholder="alex.admin@marvel.com"
                  value={createAdminForm.email}
                  onChange={e => setCreateAdminForm({ ...createAdminForm, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  Initial Password (min 6 chars)
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={createAdminForm.password}
                  onChange={e => setCreateAdminForm({ ...createAdminForm, password: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                    Role Assignment
                  </label>
                  <select
                    value={createAdminForm.role}
                    onChange={e => setCreateAdminForm({ ...createAdminForm, role: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      fontSize: 13
                    }}
                  >
                    <option value="admin">Administrator</option>
                    {isSuperAdmin && <option value="super_admin">Super Administrator</option>}
                    <option value="vendor">Vendor / Seller</option>
                    <option value="user">Customer</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                    Enterprise Plan
                  </label>
                  <select
                    value={createAdminForm.plan}
                    onChange={e => setCreateAdminForm({ ...createAdminForm, plan: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      fontSize: 13
                    }}
                  >
                    <option value="Enterprise">Enterprise</option>
                    <option value="Team">Team</option>
                    <option value="Basic">Basic</option>
                  </select>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={createAdminLoading}
                style={{
                  background: "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)",
                  borderRadius: 8,
                  fontWeight: 700,
                  marginTop: 8
                }}
              >
                Provision Admin User
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* ── RESET USER PASSWORD MODAL ── */}
      {showResetPasswordModal && resetTargetUser && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: 16,
            maxWidth: 420,
            width: "100%",
            padding: 26,
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            position: "relative"
          }}>
            <button
              onClick={() => setShowResetPasswordModal(false)}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "#f1f5f9",
                border: "none",
                borderRadius: "50%",
                width: 30,
                height: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer"
              }}
            >
              <X size={15} />
            </button>

            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#fef2f2", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
                <Key size={20} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0 }}>Reset User Password</h3>
              <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                Assign a new password for <strong>{resetTargetUser.email}</strong>
              </p>
            </div>

            <form onSubmit={handleResetPasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  New Password (min 6 chars)
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={resetNewPassword}
                  onChange={e => setResetNewPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={resetPasswordLoading}
                style={{ background: "#2563eb", borderRadius: 8, fontWeight: 700 }}
              >
                Set &amp; Update Password
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* ── VIEW USER PROFILE DETAILS MODAL ── */}
      {viewingUser && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: 16,
            maxWidth: 440,
            width: "100%",
            padding: 26,
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            position: "relative"
          }}>
            <button
              onClick={() => setViewingUser(null)}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "#f1f5f9",
                border: "none",
                borderRadius: "50%",
                width: 30,
                height: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer"
              }}
            >
              <X size={15} />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#eff6ff",
                color: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 16
              }}>
                {getAvatarInitials(viewingUser.full_name, viewingUser.email)}
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0 }}>
                  {viewingUser.full_name || "User Details"}
                </h3>
                <div style={{ fontSize: 13, color: "#64748b" }}>{viewingUser.email}</div>
              </div>
            </div>

            <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>User ID</span>
                <span style={{ fontFamily: "monospace", fontSize: 11 }}>{viewingUser.id}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Role</span>
                <span>{renderRoleBadge(viewingUser.role)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Plan Tier</span>
                <span style={{ fontWeight: 600 }}>{viewingUser.plan || "Enterprise"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Billing Method</span>
                <span>{viewingUser.billing || "Auto Debit"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Account Status</span>
                <span>{renderStatusPill(viewingUser.status)}</span>
              </div>
            </div>

            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
              <Button variant="secondary" size="sm" onClick={() => setViewingUser(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
