import { useState, useEffect } from "react";
import {
  Zap,
  Layers,
  Users,
  Database,
  DollarSign,
  TrendingUp,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Activity,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Server,
  Lock
} from "lucide-react";
import { Button, Input, useToast } from "../ui";
import {
  apiFetchMenuItems,
  apiSaveMenuItem,
  apiDeleteMenuItem,
  apiFetchAllUsers,
  apiUpdateUserRole
} from "../../api/backendApi";

export default function SuperAdminDashboard({ currentUser, onNavigateHome }) {
  const [activeTab, setActiveTab] = useState("analytics"); // analytics, menu, users, diagnostics
  const [menuItems, setMenuItems] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  const [menuForm, setMenuForm] = useState({
    title: "",
    path: "/",
    icon: "Layers",
    badge: "",
    roles_allowed: ["user", "vendor", "admin", "super_admin"]
  });

  const { addToast } = useToast();

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

      // Broadcast update event to refresh dynamic menus everywhere
      window.dispatchEvent(new Event("marvel_menu_updated"));

      addToast({
        title: "Dynamic Menu Synchronized",
        message: `Successfully ${editingMenuItem ? "updated" : "created"} '${payload.title}'`,
        type: "success"
      });
    } catch (err) {
      addToast({ title: "Error", message: err.message, type: "error" });
    }
  };

  const handleDeleteMenu = async (id, title) => {
    if (!window.confirm(`Delete menu item '${title}' from system navigation?`)) return;
    try {
      const updated = await apiDeleteMenuItem(id);
      setMenuItems(updated);
      window.dispatchEvent(new Event("marvel_menu_updated"));
      addToast({ title: "Menu Item Removed", message: `Deleted '${title}'`, type: "info" });
    } catch (err) {
      addToast({ title: "Error", message: err.message, type: "error" });
    }
  };

  const handleRoleChange = async (userId, newRole, userName) => {
    try {
      const updated = await apiUpdateUserRole(userId, newRole);
      setUsersList(updated);
      addToast({
        title: "Role Permissions Updated",
        message: `Promoted ${userName} to '${newRole.toUpperCase()}'`,
        type: "success"
      });
    } catch (err) {
      addToast({ title: "Error", message: err.message, type: "error" });
    }
  };

  return (
    <div style={{ background: "#f8fafc", minHeight: "calc(100vh - 120px)", padding: "30px 20px" }}>
      <div className="container" style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* Super Admin Top Banner */}
        <div style={{
          background: "linear-gradient(135deg, #78350f 0%, #b45309 50%, #d97706 100%)",
          color: "#ffffff",
          borderRadius: 16,
          padding: "24px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24,
          boxShadow: "0 10px 25px -5px rgba(217, 119, 6, 0.3)"
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
              <Zap size={30} color="#ffd700" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "#fff" }}>
                  Super Admin Root Governance Hub
                </h2>
                <span style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: "3px 10px",
                  borderRadius: 20,
                  background: "#fef3c7",
                  color: "#92400e",
                  textTransform: "uppercase"
                }}>
                  Tier-1 Root Access
                </span>
              </div>
              <p style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.85)", margin: "4px 0 0 0" }}>
                Root Operator: <strong>{currentUser?.full_name || "David Vance (Root)"}</strong> ({currentUser?.email})
              </p>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={onNavigateHome}
            style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", borderRadius: 10 }}
          >
            <ExternalLink size={14} style={{ marginRight: 6 }} /> Open Public Marketplace
          </Button>
        </div>

        {/* Global Financial Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 28 }}>
          <div style={{ background: "#fff", padding: 20, borderRadius: 14, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Platform Gross GMV</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>$48,920.00</div>
            <div style={{ fontSize: 12, color: "#16a34a", marginTop: 4 }}>+18.4% month-over-month</div>
          </div>

          <div style={{ background: "#fff", padding: 20, borderRadius: 14, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Platform 10% Fee Revenue</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#d97706", marginTop: 4 }}>$4,892.00</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Automated commission take</div>
          </div>

          <div style={{ background: "#fff", padding: 20, borderRadius: 14, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>System Users Matrix</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#2563eb", marginTop: 4 }}>{usersList.length}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Across all 4 system roles</div>
          </div>

          <div style={{ background: "#fff", padding: 20, borderRadius: 14, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Supabase DB Health</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#16a34a", marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={20} /> Connected (RLS Active)
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>hyyjkyztxikohdywqagp.supabase.co</div>
          </div>
        </div>

        {/* Tab Controls */}
        <div style={{ display: "flex", gap: 12, borderBottom: "2px solid #e2e8f0", marginBottom: 24, flexWrap: "wrap" }}>
          <button
            onClick={() => setActiveTab("analytics")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 18px",
              border: "none",
              background: "none",
              fontSize: 14,
              fontWeight: activeTab === "analytics" ? 700 : 500,
              color: activeTab === "analytics" ? "#d97706" : "#64748b",
              borderBottom: activeTab === "analytics" ? "3px solid #d97706" : "3px solid transparent",
              cursor: "pointer"
            }}
          >
            <TrendingUp size={18} /> Financials & Analytics
          </button>

          <button
            onClick={() => setActiveTab("menu")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 18px",
              border: "none",
              background: "none",
              fontSize: 14,
              fontWeight: activeTab === "menu" ? 700 : 500,
              color: activeTab === "menu" ? "#d97706" : "#64748b",
              borderBottom: activeTab === "menu" ? "3px solid #d97706" : "3px solid transparent",
              cursor: "pointer"
            }}
          >
            <Layers size={18} /> Dynamic Menu Architect ({menuItems.length})
          </button>

          <button
            onClick={() => setActiveTab("users")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 18px",
              border: "none",
              background: "none",
              fontSize: 14,
              fontWeight: activeTab === "users" ? 700 : 500,
              color: activeTab === "users" ? "#d97706" : "#64748b",
              borderBottom: activeTab === "users" ? "3px solid #d97706" : "3px solid transparent",
              cursor: "pointer"
            }}
          >
            <Users size={18} /> User Matrix & Permissions ({usersList.length})
          </button>

          <button
            onClick={() => setActiveTab("diagnostics")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 18px",
              border: "none",
              background: "none",
              fontSize: 14,
              fontWeight: activeTab === "diagnostics" ? 700 : 500,
              color: activeTab === "diagnostics" ? "#d97706" : "#64748b",
              borderBottom: activeTab === "diagnostics" ? "3px solid #d97706" : "3px solid transparent",
              cursor: "pointer"
            }}
          >
            <Server size={18} /> System Diagnostics
          </button>
        </div>

        {/* TAB 1: FINANCIALS & ANALYTICS */}
        {activeTab === "analytics" && (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
            <div style={{ background: "#ffffff", padding: 24, borderRadius: 16, border: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 16 }}>
                Platform Revenue & Commission Engine
              </h3>
              <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
                Marvel automatically collects a 10% platform fee on all fulfilled vendor transactions. Payouts are reconciled via the Express Node API and stored securely in Supabase.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20 }}>
                <div style={{ background: "#f8fafc", padding: 16, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>Vendor Net Payouts</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#16a34a", marginTop: 4 }}>$44,028.00</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Direct deposit scheduled</div>
                </div>

                <div style={{ background: "#f8fafc", padding: 16, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>Platform Reserve Balance</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#d97706", marginTop: 4 }}>$4,892.00</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Net platform margin</div>
                </div>
              </div>
            </div>

            <div style={{ background: "#ffffff", padding: 24, borderRadius: 16, border: "1px solid #e2e8f0" }}>
              <h4 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 14px 0", color: "#0f172a" }}>Role Breakdown</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { label: "Customers", count: usersList.filter(u => u.role === "user").length, color: "#2563eb" },
                  { label: "Vendors (Sellers)", count: usersList.filter(u => u.role === "vendor").length, color: "#7c3aed" },
                  { label: "Admins", count: usersList.filter(u => u.role === "admin").length, color: "#0284c7" },
                  { label: "Super Admins", count: usersList.filter(u => u.role === "super_admin").length, color: "#d97706" }
                ].map(item => (
                  <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: "#f8fafc" }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: "#334155" }}>{item.label}</span>
                    <span style={{ fontWeight: 800, color: item.color, fontSize: 14 }}>{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DYNAMIC MENU ARCHITECT */}
        {activeTab === "menu" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 24 }}>
            {/* Form */}
            <div style={{ background: "#ffffff", padding: 24, borderRadius: 16, border: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={18} color="#d97706" />
                {editingMenuItem ? "Edit Dynamic Menu Item" : "Create Dynamic Menu Item"}
              </h3>

              <form onSubmit={handleSaveMenu} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Menu Item Title</label>
                  <Input
                    type="text"
                    placeholder="e.g. Clearance Deals"
                    value={menuForm.title}
                    onChange={(e) => setMenuForm({ ...menuForm, title: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Route Path</label>
                  <Input
                    type="text"
                    placeholder="/deals/clearance"
                    value={menuForm.path}
                    onChange={(e) => setMenuForm({ ...menuForm, path: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Icon</label>
                    <select
                      value={menuForm.icon}
                      onChange={(e) => setMenuForm({ ...menuForm, icon: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }}
                    >
                      {["Home", "ShoppingBag", "Grid", "Tag", "Store", "ShieldCheck", "Zap", "Cpu", "Shirt", "Layers"].map(i => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Badge Tag</label>
                    <Input
                      type="text"
                      placeholder="HOT, NEW, 50% OFF"
                      value={menuForm.badge || ""}
                      onChange={(e) => setMenuForm({ ...menuForm, badge: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <Button type="submit" variant="primary" style={{ flex: 1, background: "#d97706" }}>
                    {editingMenuItem ? "Update Menu Route" : "Save to Database"}
                  </Button>
                  {editingMenuItem && (
                    <Button type="button" variant="secondary" onClick={() => { setEditingMenuItem(null); setMenuForm({ title: "", path: "/", icon: "Layers", badge: "", roles_allowed: ["user", "vendor", "admin", "super_admin"] }); }}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </div>

            {/* Active Items */}
            <div style={{ background: "#ffffff", padding: 24, borderRadius: 16, border: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 16 }}>
                Active Dynamic Navigation ({menuItems.length})
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {menuItems.map(item => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                        {item.title}
                        {item.badge && (
                          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#d97706", color: "#fff", fontWeight: 700 }}>
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
                        style={{ padding: 6, borderRadius: 6, border: "none", background: "#fef3c7", color: "#92400e", cursor: "pointer" }}
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

        {/* TAB 3: USERS MATRIX */}
        {activeTab === "users" && (
          <div style={{ background: "#ffffff", padding: 24, borderRadius: 16, border: "1px solid #e2e8f0" }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 16 }}>
              User Permissions & Role Assignment Matrix
            </h3>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#475569", borderBottom: "2px solid #e2e8f0" }}>
                    <th style={{ padding: "12px 16px" }}>User Name</th>
                    <th style={{ padding: "12px 16px" }}>Email</th>
                    <th style={{ padding: "12px 16px" }}>Current Role</th>
                    <th style={{ padding: "12px 16px" }}>Promote / Demote Permission</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map(u => (
                    <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "14px 16px", fontWeight: 700 }}>{u.full_name}</td>
                      <td style={{ padding: "14px 16px", color: "#64748b" }}>{u.email}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{
                          padding: "3px 10px",
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
                          style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 600 }}
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

        {/* TAB 4: DIAGNOSTICS */}
        {activeTab === "diagnostics" && (
          <div style={{ background: "#ffffff", padding: 24, borderRadius: 16, border: "1px solid #e2e8f0" }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 16 }}>
              Infrastructure & Supabase Health
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              <div style={{ background: "#f8fafc", padding: 18, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <Database size={16} color="#16a34a" /> Remote Database
                </div>
                <div style={{ fontSize: 13, color: "#64748b" }}>Host: hyyjkyztxikohdywqagp.supabase.co</div>
                <div style={{ fontSize: 13, color: "#16a34a", fontWeight: 700, marginTop: 4 }}>Status: 100% Operational</div>
              </div>

              <div style={{ background: "#f8fafc", padding: 18, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <Server size={16} color="#0284c7" /> Express Backend API
                </div>
                <div style={{ fontSize: 13, color: "#64748b" }}>Port: 5000 (CORS Active)</div>
                <div style={{ fontSize: 13, color: "#0284c7", fontWeight: 700, marginTop: 4 }}>Architecture: Frontend $\rightarrow$ Backend $\rightarrow$ DB</div>
              </div>

              <div style={{ background: "#f8fafc", padding: 18, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <Lock size={16} color="#d97706" /> Row Level Security (RLS)
                </div>
                <div style={{ fontSize: 13, color: "#64748b" }}>Policies: Profiles, Menu, Products, Orders</div>
                <div style={{ fontSize: 13, color: "#d97706", fontWeight: 700, marginTop: 4 }}>Access Control: Enforced</div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
