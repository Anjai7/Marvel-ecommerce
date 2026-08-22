import { useState, useEffect } from "react";
import {
  ShieldCheck,
  Zap,
  Store,
  Layers,
  Edit2,
  Trash2,
  Users,
  ShoppingBag,
  CheckCircle2,
  Sparkles
} from "lucide-react";
import { Button, Input, useToast } from "../ui";
import {
  apiFetchMenuItems,
  apiSaveMenuItem,
  apiDeleteMenuItem,
  apiFetchAllUsers,
  apiUpdateUserRole
} from "../../api/backendApi";

export default function AdminDashboard({ currentUser, onNavigateHome }) {
  const userRole = currentUser?.role || "super_admin";
  const [activeTab, setActiveTab] = useState(
    userRole === "super_admin" ? "menu" : userRole === "vendor" ? "products" : "users"
  );

  // Dynamic Menu State
  const [menuItems, setMenuItems] = useState([]);
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  const [menuForm, setMenuForm] = useState({
    title: "",
    path: "/",
    icon: "Layers",
    badge: "",
    roles_allowed: ["user", "vendor", "admin", "super_admin"]
  });

  // User Management State
  const [usersList, setUsersList] = useState([]);

  // Products State
  const [productsList, setProductsList] = useState([
    { id: "p1", title: "Wireless Noise-Canceling Headphones Pro", price: 199.99, category: "Electronics", stock: 24, status: "active" },
    { id: "p2", title: "Smart OLED Watch Ultra", price: 349.50, category: "Wearables", stock: 12, status: "active" },
    { id: "p3", title: "Ergonomic Mechanical Keyboard RGB", price: 129.00, category: "Accessories", stock: 8, status: "active" }
  ]);
  const [newProduct, setNewProduct] = useState({ title: "", price: "", category: "Electronics", stock: "10" });

  const { addToast } = useToast();

  // Load Data
  const loadData = async () => {
    try {
      const menus = await apiFetchMenuItems("super_admin");
      setMenuItems(menus);

      const users = await apiFetchAllUsers();
      setUsersList(users);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Save Dynamic Menu Item
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

      // Broadcast update event so DynamicMenu updates everywhere immediately!
      window.dispatchEvent(new Event("marvel_menu_updated"));

      addToast({
        title: "Dynamic Menu Saved!",
        message: `Successfully ${editingMenuItem ? "updated" : "added"} menu item '${payload.title}'`,
        type: "success"
      });
    } catch (err) {
      addToast({ title: "Error", message: err.message, type: "error" });
    }
  };

  const handleDeleteMenu = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete menu item '${title}'?`)) return;
    try {
      const updated = await apiDeleteMenuItem(id);
      setMenuItems(updated);
      window.dispatchEvent(new Event("marvel_menu_updated"));
      addToast({ title: "Menu Deleted", message: `Removed '${title}'`, type: "info" });
    } catch (err) {
      addToast({ title: "Error", message: err.message, type: "error" });
    }
  };

  const handleRoleChange = async (userId, newRole, userName) => {
    try {
      const updated = await apiUpdateUserRole(userId, newRole);
      setUsersList(updated);
      addToast({
        title: "Role Updated",
        message: `Changed ${userName}'s role to '${newRole.toUpperCase()}'`,
        type: "success"
      });
    } catch (err) {
      addToast({ title: "Error", message: err.message, type: "error" });
    }
  };

  const handleAddProduct = (e) => {
    e.preventDefault();
    const p = {
      id: `p-${Date.now()}`,
      title: newProduct.title,
      price: parseFloat(newProduct.price) || 49.99,
      category: newProduct.category,
      stock: parseInt(newProduct.stock) || 10,
      status: "active"
    };
    setProductsList([p, ...productsList]);
    setNewProduct({ title: "", price: "", category: "Electronics", stock: "10" });
    addToast({ title: "Product Added", message: `Created '${p.title}'`, type: "success" });
  };

  return (
    <div style={{ background: "#f8fafc", minHeight: "calc(100vh - 120px)", padding: "30px 20px" }}>
      <div className="container" style={{ maxWidth: 1200, margin: "0 auto" }}>
        
        {/* Top Header Banner */}
        <div style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          color: "#ffffff",
          borderRadius: 16,
          padding: "24px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24,
          boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.2)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: userRole === "super_admin" ? "#d97706" : userRole === "vendor" ? "#7c3aed" : "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              {userRole === "super_admin" ? <Zap size={28} color="#fff" /> : userRole === "vendor" ? <Store size={28} color="#fff" /> : <ShieldCheck size={28} color="#fff" />}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "#fff" }}>
                  {userRole === "super_admin" ? "Super Admin Operations Portal" : userRole === "vendor" ? "Vendor Store Console" : "Admin Management Console"}
                </h2>
                <span style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: "3px 10px",
                  borderRadius: 20,
                  background: userRole === "super_admin" ? "#f59e0b" : "#3b82f6",
                  color: "#fff",
                  textTransform: "uppercase"
                }}>
                  {userRole.replace("_", " ")}
                </span>
              </div>
              <p style={{ fontSize: 13, color: "#94a3b8", margin: "4px 0 0 0" }}>
                Logged in as <strong>{currentUser?.full_name || "System Operator"}</strong> ({currentUser?.email})
              </p>
            </div>
          </div>

          <Button variant="secondary" size="sm" onClick={onNavigateHome} style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "none" }}>
            Return to Marketplace
          </Button>
        </div>

        {/* Analytics Summary Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 28 }}>
          <div style={{ background: "#fff", padding: 20, borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Registered Users</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>{usersList.length}</div>
            <div style={{ fontSize: 12, color: "#16a34a", marginTop: 4 }}>Active accounts across 4 roles</div>
          </div>

          <div style={{ background: "#fff", padding: 20, borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Dynamic Menu Items</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#2563eb", marginTop: 4 }}>{menuItems.length}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Live database configured routes</div>
          </div>

          <div style={{ background: "#fff", padding: 20, borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Active Catalog Products</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#7c3aed", marginTop: 4 }}>{productsList.length}</div>
            <div style={{ fontSize: 12, color: "#16a34a", marginTop: 4 }}>In stock & listed</div>
          </div>

          <div style={{ background: "#fff", padding: 20, borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>System Status</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#16a34a", marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={20} /> Operational
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Supabase RLS enabled</div>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div style={{ display: "flex", gap: 8, borderBottom: "2px solid #e2e8f0", marginBottom: 24, flexWrap: "wrap" }}>
          {(userRole === "super_admin" || userRole === "admin") && (
            <button
              onClick={() => setActiveTab("menu")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 20px",
                border: "none",
                background: "none",
                fontSize: 14,
                fontWeight: activeTab === "menu" ? 700 : 500,
                color: activeTab === "menu" ? "#2563eb" : "#64748b",
                borderBottom: activeTab === "menu" ? "3px solid #2563eb" : "3px solid transparent",
                cursor: "pointer"
              }}
            >
              <Layers size={18} /> Dynamic Menu Editor
            </button>
          )}

          {(userRole === "super_admin" || userRole === "admin") && (
            <button
              onClick={() => setActiveTab("users")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 20px",
                border: "none",
                background: "none",
                fontSize: 14,
                fontWeight: activeTab === "users" ? 700 : 500,
                color: activeTab === "users" ? "#2563eb" : "#64748b",
                borderBottom: activeTab === "users" ? "3px solid #2563eb" : "3px solid transparent",
                cursor: "pointer"
              }}
            >
              <Users size={18} /> Users & Roles Management
            </button>
          )}

          <button
            onClick={() => setActiveTab("products")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 20px",
              border: "none",
              background: "none",
              fontSize: 14,
              fontWeight: activeTab === "products" ? 700 : 500,
              color: activeTab === "products" ? "#2563eb" : "#64748b",
              borderBottom: activeTab === "products" ? "3px solid #2563eb" : "3px solid transparent",
              cursor: "pointer"
            }}
          >
            <ShoppingBag size={18} /> Products & Catalog
          </button>
        </div>

        {/* TAB 1: DYNAMIC MENU EDITOR */}
        {activeTab === "menu" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 24 }}>
            {/* Form */}
            <div style={{ background: "#fff", padding: 24, borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={18} color="#d97706" />
                {editingMenuItem ? "Edit Menu Item" : "Create New Dynamic Menu Item"}
              </h3>

              <form onSubmit={handleSaveMenu} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                    Menu Title
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. Clearance Sale"
                    value={menuForm.title}
                    onChange={(e) => setMenuForm({ ...menuForm, title: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                    Navigation Path (URL)
                  </label>
                  <Input
                    type="text"
                    placeholder="/deals/clearance"
                    value={menuForm.path}
                    onChange={(e) => setMenuForm({ ...menuForm, path: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                    Icon Name (Lucide)
                  </label>
                  <select
                    value={menuForm.icon}
                    onChange={(e) => setMenuForm({ ...menuForm, icon: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
                  >
                    {["Home", "ShoppingBag", "Grid", "Tag", "Store", "ShieldCheck", "Zap", "Cpu", "Shirt", "Layers", "Settings", "Package"].map((icon) => (
                      <option key={icon} value={icon}>{icon}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                    Badge Tag (Optional)
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. HOT, NEW, PROMO"
                    value={menuForm.badge || ""}
                    onChange={(e) => setMenuForm({ ...menuForm, badge: e.target.value })}
                  />
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <Button type="submit" variant="primary" style={{ flex: 1 }}>
                    {editingMenuItem ? "Update Menu Item" : "Add to Dynamic Menu"}
                  </Button>

                  {editingMenuItem && (
                    <Button type="button" variant="secondary" onClick={() => { setEditingMenuItem(null); setMenuForm({ title: "", path: "/", icon: "Layers", badge: "", roles_allowed: ["user", "vendor", "admin", "super_admin"] }); }}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </div>

            {/* List */}
            <div style={{ background: "#fff", padding: 24, borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#0f172a" }}>
                  Active Menu Config ({menuItems.length})
                </h3>
                <span style={{ fontSize: 12, color: "#64748b" }}>Supabase Live State</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {menuItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      borderRadius: 10,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0"
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                        {item.title}
                        {item.badge && (
                          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#2563eb", color: "#fff", fontWeight: 700 }}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                        Path: <code>{item.path}</code> | Icon: <code>{item.icon}</code>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => {
                          setEditingMenuItem(item);
                          setMenuForm({
                            title: item.title,
                            path: item.path,
                            icon: item.icon || "Layers",
                            badge: item.badge || "",
                            roles_allowed: item.roles_allowed || ["user", "vendor", "admin", "super_admin"]
                          });
                        }}
                        style={{ padding: 6, borderRadius: 6, border: "none", background: "#e0f2fe", color: "#0284c7", cursor: "pointer" }}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteMenu(item.id, item.title)}
                        style={{ padding: 6, borderRadius: 6, border: "none", background: "#fee2e2", color: "#dc2626", cursor: "pointer" }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: USERS & ROLES */}
        {activeTab === "users" && (
          <div style={{ background: "#fff", padding: 24, borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "#0f172a" }}>
              User Directory & Role Access Control
            </h3>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", color: "#475569" }}>
                    <th style={{ padding: "12px 16px", borderRadius: "8px 0 0 8px" }}>User Name</th>
                    <th style={{ padding: "12px 16px" }}>Email</th>
                    <th style={{ padding: "12px 16px" }}>Current Role</th>
                    <th style={{ padding: "12px 16px", borderRadius: "0 8px 8px 0" }}>Update Role</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((u) => (
                    <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "14px 16px", fontWeight: 600 }}>{u.full_name}</td>
                      <td style={{ padding: "14px 16px", color: "#64748b" }}>{u.email}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{
                          padding: "4px 10px",
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          background: u.role === "super_admin" ? "#fef3c7" : u.role === "admin" ? "#e0f2fe" : u.role === "vendor" ? "#f3e8ff" : "#f1f5f9",
                          color: u.role === "super_admin" ? "#92400e" : u.role === "admin" ? "#0369a1" : u.role === "vendor" ? "#6b21a8" : "#334155"
                        }}>
                          {u.role.replace("_", " ")}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value, u.full_name)}
                          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                        >
                          <option value="user">User (Customer)</option>
                          <option value="vendor">Vendor (Seller)</option>
                          <option value="admin">Admin (Manager)</option>
                          <option value="super_admin">Super Admin (Root)</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: PRODUCTS & CATALOG */}
        {activeTab === "products" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
            {/* Add Product Form */}
            <div style={{ background: "#fff", padding: 24, borderRadius: 16, border: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "#0f172a" }}>
                Add Product to Catalog
              </h3>
              <form onSubmit={handleAddProduct} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                    Product Title
                  </label>
                  <Input
                    type="text"
                    placeholder="Ultra Gaming Laptop 16"
                    value={newProduct.title}
                    onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
                    required
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                      Price ($)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="1299.99"
                      value={newProduct.price}
                      onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                      Stock Quantity
                    </label>
                    <Input
                      type="number"
                      placeholder="15"
                      value={newProduct.stock}
                      onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" variant="primary" style={{ marginTop: 8 }}>
                  Publish Product
                </Button>
              </form>
            </div>

            {/* Products List */}
            <div style={{ background: "#fff", padding: 24, borderRadius: 16, border: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "#0f172a" }}>
                Catalog Products ({productsList.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {productsList.map((p) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{p.title}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>Category: {p.category} | Stock: {p.stock} units</div>
                    </div>
                    <div style={{ fontWeight: 800, color: "#2563eb", fontSize: 15 }}>
                      ${p.price.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
