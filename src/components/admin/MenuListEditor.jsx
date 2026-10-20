import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Edit2, Trash2, ArrowUp, ArrowDown, Layers, Search } from "lucide-react";
import { Button, Input, useToast, Dialog, DialogContent, DialogHeader } from "../ui";
import {
  apiFetchMenuItems,
  apiSaveMenuItem,
  apiUpdateMenuItem,
  apiDeleteMenuItem,
  apiReorderMenuItems,
} from "../../api/contentApi";

/** Flatten a tree response so sibling groups are complete whether the API
 * answered with a tree or a legacy flat list. */
function flattenMenu(nodes) {
  return (Array.isArray(nodes) ? nodes : []).flatMap((node) => [
    node,
    ...flattenMenu(node.children),
  ]);
}

export default function MenuListEditor({ role = "user" }) {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: "",
    path: "",
    icon: "Layers",
    badge: "",
    badge_variant: "accent",
    roles_allowed: ["user", "vendor", "admin", "super_admin"],
    order_index: 0,
    is_active: true,
    parent_id: null,
  });
  const [deletingId, setDeletingId] = useState(null);
  const [treeView, setTreeView] = useState(false);
  const [search, setSearch] = useState("");
  const { addToast } = useToast();

  const loadMenu = useCallback(async () => {
    try {
      const data = await apiFetchMenuItems(role);
      setMenuItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Menu load error:", err);
      addToast({ title: "Menu load failed", message: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }, [role, addToast]);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return menuItems.filter(
      (m) => m.title.toLowerCase().includes(s) || m.path.toLowerCase().includes(s)
    );
  }, [menuItems, search]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form };
      delete payload.badge_variant;
      // An edit is a PATCH: the server has no PUT /api/menu/:id.
      if (editingId) {
        await apiUpdateMenuItem(editingId, payload);
      } else {
        await apiSaveMenuItem(payload);
      }
      setShowForm(false);
      setEditingId(null);
      setForm({
        title: "",
        path: "",
        icon: "Layers",
        badge: "",
        badge_variant: "accent",
        roles_allowed: ["user", "vendor", "admin", "super_admin"],
        order_index: 0,
        is_active: true,
        parent_id: null,
      });
      await loadMenu();
      addToast({ title: "Menu saved", type: "success" });
    } catch (err) {
      addToast({ title: "Save failed", message: err.message, type: "error" });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this menu item?")) return;
    setDeletingId(id);
    try {
      await apiDeleteMenuItem(id);
      await loadMenu();
      addToast({ title: "Deleted", type: "success" });
    } catch (err) {
      addToast({ title: "Delete failed", message: err.message, type: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleReorder = async (id, delta) => {
    const flat = flattenMenu(menuItems);
    const item = flat.find((m) => m.id === id);
    if (!item) return;
    const siblings = flat
      .filter((m) => (m.parent_id ?? null) === (item.parent_id ?? null))
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    const idx = siblings.findIndex((m) => m.id === id);
    if (idx < 0 || idx + delta < 0 || idx + delta >= siblings.length) return;

    // The reorder route requires the complete sibling set in its new order.
    const next = [...siblings];
    [next[idx], next[idx + delta]] = [next[idx + delta], next[idx]];
    const orders = next.map((sibling, index) => ({ id: sibling.id, display_order: index }));

    try {
      await apiReorderMenuItems(orders);
      await loadMenu();
    } catch (err) {
      addToast({ title: "Reorder failed", message: err.message, type: "error" });
    }
  };

  const columns = [
    { key: "title", label: "Title" },
    { key: "path", label: "Path" },
    { key: "icon", label: "Icon" },
    { key: "badge", label: "Badge" },
    { key: "roles", label: "Roles" },
    { key: "order", label: "Order" },
    { key: "active", label: "Active" },
    { key: "actions", label: "Actions" },
  ];

  return (
    <div className="site-content-section">
      <div className="section-header">
        <h2 className="section-title">Navigation Menus</h2>
        <p className="section-subtitle">
          Three-level menu tree — expand, reorder, edit, or add items
        </p>
      </div>

      <div className="toolbar-row">
        <div className="search-wrap">
          <Search size={16} className="search-icon" />
          <Input
            placeholder="Search title or path..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="tree-toggle">
          <button
            onClick={() => setTreeView(!treeView)}
            className={`tree-toggle-btn ${treeView ? "active" : ""}`}
          >
            <Layers size={14} /> {treeView ? "List View" : "Tree View"}
          </button>
        </div>
        <Button
          onClick={() => {
            setEditingId(null);
            setForm({
              title: "",
              path: "",
              icon: "Layers",
              badge: "",
              badge_variant: "accent",
              roles_allowed: ["user", "vendor", "admin", "super_admin"],
              order_index: 0,
              is_active: true,
              parent_id: null,
            });
            setShowForm(true);
          }}
          className="add-top-level-btn"
        >
          <Plus size={16} /> Add Top-Level Item
        </Button>
      </div>

      {loading ? (
        <div className="loading-state">Loading menu items...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">No menu items found.</div>
      ) : treeView ? (
        <div className="tree-view">
          {menuItems
            .filter((m) => !m.parent_id)
            .map((root) => (
              <div key={root.id} className="tree-node">
                <div className="tree-node-header">
                  <span className="node-title">{root.title}</span>
                  <span className={`badge badge-${root.badge_variant || "accent"}`}>
                    {root.badge || ""}
                  </span>
                </div>
                {root.children?.map((child) => (
                  <div key={child.id} className="tree-node-child">
                    <span className="node-title">{child.title}</span>
                    {child.children?.map((sub) => (
                      <div key={sub.id} className="tree-node-sub">
                        <span className="node-title">{sub.title}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
        </div>
      ) : (
        <div className="data-table">
          <table className="admin-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="table-row">
                  <td className="cell-title">{item.title}</td>
                  <td className="cell-path">{item.path}</td>
                  <td className="cell-icon">{item.icon}</td>
                  <td className="cell-badge">
                    <span className={`badge badge-${item.badge_variant || "accent"}`}>
                      {item.badge || "—"}
                    </span>
                  </td>
                  <td className="cell-roles">
                    {item.roles_allowed?.map((r) => (
                      <span key={r} className="role-chip">
                        {r}
                      </span>
                    ))}{" "}
                    || <span className="text-muted">—</span>
                  </td>
                  <td className="cell-order">{item.order_index}</td>
                  <td className="cell-active">
                    <button
                      onClick={async () => {
                        const previous = menuItems;
                        setMenuItems(
                          menuItems.map((m) =>
                            m.id === item.id ? { ...m, is_active: !m.is_active } : m
                          )
                        );
                        try {
                          await apiUpdateMenuItem(item.id, { is_active: !item.is_active });
                        } catch (err) {
                          setMenuItems(previous);
                          addToast({
                            title: "Update failed",
                            message: err.message,
                            type: "error",
                          });
                        }
                      }}
                      className={`toggle-btn ${item.is_active ? "active" : "inactive"}`}
                    >
                      {item.is_active ? "Active" : "Hidden"}
                    </button>
                  </td>
                  <td className="cell-actions">
                    <button
                      onClick={() => {
                        setEditingId(item.id);
                        setForm({ ...item });
                        setShowForm(true);
                      }}
                      className="action-btn edit-btn"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => setDeletingId(item.id)}
                      className="action-btn delete-btn"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                    {item.order_index > 0 && (
                      <button
                        onClick={() => handleReorder(item.id, -1)}
                        className="action-btn reorder-btn"
                        title="Move up"
                      >
                        <ArrowUp size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => handleReorder(item.id, 1)}
                      className="action-btn reorder-btn"
                      title="Move down"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <h2 className="dialog-title">{editingId ? "Edit Menu Item" : "Add Menu Item"}</h2>
          </DialogHeader>
          <form onSubmit={handleSave} className="menu-form">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Title *</label>
                <Input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Home &amp; Trending"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Path *</label>
                <Input
                  required
                  value={form.path}
                  onChange={(e) => setForm({ ...form, path: e.target.value })}
                  placeholder="/products"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Icon</label>
                <Input
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  placeholder="Layers"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Badge</label>
                <Input
                  value={form.badge}
                  onChange={(e) => setForm({ ...form, badge: e.target.value })}
                  placeholder="HOT"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Roles Allowed</label>
                <select
                  className="ui-select-trigger"
                  value={(form.roles_allowed ?? []).join(",")}
                  onChange={(e) => setForm({ ...form, roles_allowed: e.target.value.split(",") })}
                >
                  <option value="user">User</option>
                  <option value="vendor">Vendor</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Order Index</label>
                <Input
                  type="number"
                  value={form.order_index ?? 0}
                  onChange={(e) => setForm({ ...form, order_index: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="form-actions">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingId ? "Save Changes" : "Add Menu Item"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {deletingId && (
        <Dialog open={Boolean(deletingId)} onOpenChange={(open) => !open && setDeletingId(null)}>
          <DialogContent>
            <DialogHeader>
              <h2 className="dialog-title">Delete Menu Item</h2>
            </DialogHeader>
            <p className="dialog-text">
              Are you sure you want to delete this menu item? This cannot be undone.
            </p>
            <div className="dialog-actions">
              <Button type="button" variant="outline" onClick={() => setDeletingId(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => handleDelete(deletingId)}>
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
