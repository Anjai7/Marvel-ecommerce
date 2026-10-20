import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Plus, Edit2, Trash2, X } from "lucide-react";
import { Button, Input, useToast } from "../ui";
import {
  apiFetchMenuItems,
  apiSaveMenuItem,
  apiDeleteMenuItem,
  apiReorderMenuItems,
} from "../../api/contentApi";
import ConfirmDialog from "./ConfirmDialog";

const ALL_ROLES = ["user", "vendor", "admin", "super_admin"];

function stripChildren(item) {
  const { children: _children, ...rest } = item;
  return rest;
}

/**
 * Normalize the menu API response to a tree. The API returns tree-shaped
 * nodes ({ children }) by default; older responses may be a legacy flat
 * list, which is rebuilt client-side via parent_id.
 */
function normalizeToTree(data) {
  const list = Array.isArray(data) ? data : Array.isArray(data?.menu) ? data.menu : [];
  if (list.length === 0) return [];
  if (list.some((item) => Array.isArray(item?.children))) {
    return [...list].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  }
  const byId = new Map();
  for (const row of list) {
    if (row && row.id != null) byId.set(row.id, { ...row, children: [] });
  }
  const roots = [];
  for (const node of byId.values()) {
    const parentId = node.parent_id ?? null;
    if (parentId == null || !byId.has(parentId) || parentId === node.id) {
      roots.push(node);
    } else {
      byId.get(parentId).children.push(node);
    }
  }
  const sortNodes = (nodes) => {
    nodes.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    nodes.forEach((n) => sortNodes(n.children));
    return nodes;
  };
  return sortNodes(roots);
}

function collectIds(nodes, acc = {}) {
  for (const node of nodes) {
    acc[node.id] = true;
    if (Array.isArray(node.children)) collectIds(node.children, acc);
  }
  return acc;
}

function findParent(nodes, id, parent = null) {
  for (const node of nodes) {
    if (node.id === id) return parent;
    const found = findParent(node.children || [], id, node);
    if (found) return found;
  }
  return null;
}

function blankForm(parent) {
  return {
    id: null,
    title: "",
    path: "/",
    icon: "Layers",
    badge: "",
    badge_variant: "accent",
    roles_allowed: ALL_ROLES.join(", "),
    order_index: "0",
    section: "",
    section_icon: "",
    promo_title: "",
    promo_subtitle: "",
    promo_image_url: "",
    promo_cta_text: "",
    promo_cta_path: "",
    parent_id: parent?.id ?? null,
    level: String(parent ? Number(parent.level ?? 1) + 1 : 1),
  };
}

function editForm(item, parentId) {
  return {
    id: item.id ?? null,
    title: item.title || "",
    path: item.path || "/",
    icon: item.icon || "Layers",
    badge: item.badge || "",
    badge_variant: item.badge_variant || "accent",
    roles_allowed: Array.isArray(item.roles_allowed) ? item.roles_allowed.join(", ") : "",
    order_index: item.order_index ?? "0",
    section: item.section || "",
    section_icon: item.section_icon || "",
    promo_title: item.promo_title || "",
    promo_subtitle: item.promo_subtitle || "",
    promo_image_url: item.promo_image_url || "",
    promo_cta_text: item.promo_cta_text || "",
    promo_cta_path: item.promo_cta_path || "",
    parent_id: item.parent_id ?? parentId ?? null,
    level: String(item.level ?? (parentId ? 2 : 1)),
  };
}

export default function MenuTreeEditor({ role = "admin" }) {
  const { addToast } = useToast();
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetchMenuItems(role);
      const normalized = normalizeToTree(data);
      setTree(normalized);
      setExpanded(collectIds(normalized));
    } catch (err) {
      addToast({ title: "Menu Load Failed", message: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }, [role, addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const broadcastUpdate = () => {
    window.dispatchEvent(new Event("marvel_menu_updated"));
  };

  const toggleExpanded = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleToggleActive = async (item) => {
    try {
      await apiSaveMenuItem({
        ...stripChildren(item),
        is_active: !item.is_active,
        level: Number(item.level ?? 1),
        order_index: Number(item.order_index ?? 0),
      });
      addToast({
        title: item.is_active ? "Menu Item Hidden" : "Menu Item Activated",
        message: `'${item.title}' updated.`,
        type: "success",
      });
      broadcastUpdate();
      await load();
    } catch (err) {
      addToast({ title: "Update Failed", message: err.message, type: "error" });
    }
  };

  const handleMove = async (item, direction) => {
    const parent = findParent(tree, item.id);
    const siblings = parent ? parent.children || [] : tree;
    const idx = siblings.findIndex((s) => s.id === item.id);
    const neighborIdx = direction === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || neighborIdx < 0 || neighborIdx >= siblings.length) return;
    const reordered = [...siblings];
    [reordered[idx], reordered[neighborIdx]] = [reordered[neighborIdx], reordered[idx]];
    const depthLevel = parent ? Number(parent.level ?? 1) + 1 : 1;
    // Levels are sent as NUMBERS — the server enforces strict integer checks.
    const orders = reordered.map((sibling, i) => ({
      id: sibling.id,
      order_index: Number(i),
      level: Number(sibling.level ?? depthLevel),
    }));
    try {
      await apiReorderMenuItems(orders);
      addToast({
        title: "Menu Reordered",
        message: `'${item.title}' moved ${direction}.`,
        type: "success",
      });
      broadcastUpdate();
      await load();
    } catch (err) {
      addToast({ title: "Reorder Failed", message: err.message, type: "error" });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editing || !editing.title.trim() || !editing.path.trim()) {
      addToast({
        title: "Missing Information",
        message: "Title and path are required.",
        type: "error",
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...(editing.id ? { id: editing.id } : {}),
        title: editing.title.trim(),
        path: editing.path.trim(),
        icon: editing.icon || "Layers",
        badge: editing.badge || null,
        badge_variant: editing.badge_variant || "accent",
        roles_allowed: editing.roles_allowed
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean),
        // Levels are sent as NUMBERS — the server enforces strict integer checks.
        order_index: Number(editing.order_index ?? 0),
        level: Number(editing.level ?? 1),
        parent_id: editing.parent_id ?? null,
        section: editing.section || null,
        section_icon: editing.section_icon || null,
        promo_title: editing.promo_title || null,
        promo_subtitle: editing.promo_subtitle || null,
        promo_image_url: editing.promo_image_url || null,
        promo_cta_text: editing.promo_cta_text || null,
        promo_cta_path: editing.promo_cta_path || null,
      };
      await apiSaveMenuItem(payload);
      setEditing(null);
      addToast({ title: "Menu Saved", message: `'${payload.title}' saved.`, type: "success" });
      broadcastUpdate();
      await load();
    } catch (err) {
      addToast({ title: "Save Failed", message: err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiDeleteMenuItem(deleteTarget.id);
      setDeleteTarget(null);
      addToast({
        title: "Menu Deleted",
        message: `Removed '${deleteTarget.title}'.`,
        type: "info",
      });
      broadcastUpdate();
      await load();
    } catch (err) {
      addToast({ title: "Delete Failed", message: err.message, type: "error" });
    }
  };

  const setFormField = (field, value) => {
    setEditing((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const renderNode = (item, depth) => {
    const children = Array.isArray(item.children) ? item.children : [];
    const isOpen = expanded[item.id] !== false;
    const parent = findParent(tree, item.id);
    const siblings = parent ? parent.children || [] : tree;
    const idx = siblings.findIndex((s) => s.id === item.id);

    return (
      <div key={item.id} className="menu-tree-node" data-level={depth}>
        <div className="menu-tree-row">
          {children.length > 0 ? (
            <button
              type="button"
              aria-label={isOpen ? `Collapse ${item.title}` : `Expand ${item.title}`}
              onClick={() => toggleExpanded(item.id)}
              className="menu-tree-toggle"
            >
              {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
          ) : (
            <span className="menu-tree-toggle-spacer" />
          )}
          <span className="menu-tree-title">{item.title}</span>
          {item.badge && <span className="role-pill admin">{item.badge}</span>}
          <span className="text-muted text-sm menu-tree-path">{item.path}</span>
          <span className={`status-pill ${item.is_active === false ? "inactive" : "active"}`}>
            <span className="status-dot"></span>
            {item.is_active === false ? "Hidden" : "Active"}
          </span>
          <div className="menu-tree-actions">
            <button
              type="button"
              aria-label={`Move ${item.title} up`}
              disabled={idx <= 0}
              onClick={() => handleMove(item, "up")}
            >
              <ChevronUp size={15} />
            </button>
            <button
              type="button"
              aria-label={`Move ${item.title} down`}
              disabled={idx < 0 || idx >= siblings.length - 1}
              onClick={() => handleMove(item, "down")}
            >
              <ChevronDown size={15} />
            </button>
            <button
              type="button"
              aria-label={`${item.is_active === false ? "Activate" : "Deactivate"} ${item.title}`}
              onClick={() => handleToggleActive(item)}
            >
              {item.is_active === false ? "Show" : "Hide"}
            </button>
            {depth < 3 && (
              <button
                type="button"
                aria-label={`Add child to ${item.title}`}
                onClick={() => setEditing(blankForm(item))}
              >
                <Plus size={15} />
              </button>
            )}
            <button
              type="button"
              aria-label={`Edit ${item.title}`}
              onClick={() => setEditing(editForm(item, parent?.id ?? null))}
            >
              <Edit2 size={15} />
            </button>
            <button
              type="button"
              aria-label={`Delete ${item.title}`}
              onClick={() => setDeleteTarget(item)}
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
        {children.length > 0 && isOpen && (
          <div className="menu-tree-children">
            {children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="dashboard-tab-view animate-fade-in">
      <div className="chart-card-header">
        <div>
          <h3 className="chart-title">Navigation Menus</h3>
          <p className="chart-subtitle">
            Three-level menu tree — expand, reorder, edit, or add items
          </p>
        </div>
        <Button onClick={() => setEditing(blankForm(null))} className="quick-add-user-btn">
          <Plus size={16} />
          <span>Add Top-Level Item</span>
        </Button>
      </div>

      {loading ? (
        <p className="chart-subtitle">Loading menu tree...</p>
      ) : tree.length === 0 ? (
        <p className="chart-subtitle">No menu items yet. Add the first one to get started.</p>
      ) : (
        <div className="menu-tree">{tree.map((item) => renderNode(item, 1))}</div>
      )}

      {editing && (
        <div className="modal-backdrop-overlay">
          <div
            className="modal-content-container animate-scale-up"
            role="dialog"
            aria-label="Menu item editor"
          >
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{editing.id ? "Edit Menu Item" : "Add Menu Item"}</h3>
                <p className="modal-subtitle">
                  Level {editing.level} — fields save to the menu API
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="modal-close-btn"
                aria-label="Close editor"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="modal-form">
              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="menu-title">
                    Title *
                  </label>
                  <Input
                    id="menu-title"
                    type="text"
                    value={editing.title}
                    onChange={(e) => setFormField("title", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="menu-path">
                    Path *
                  </label>
                  <Input
                    id="menu-path"
                    type="text"
                    value={editing.path}
                    onChange={(e) => setFormField("path", e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="menu-icon">
                    Icon
                  </label>
                  <Input
                    id="menu-icon"
                    type="text"
                    value={editing.icon}
                    onChange={(e) => setFormField("icon", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="menu-order">
                    Order index
                  </label>
                  <Input
                    id="menu-order"
                    type="number"
                    value={editing.order_index}
                    onChange={(e) => setFormField("order_index", e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="menu-badge">
                    Badge
                  </label>
                  <Input
                    id="menu-badge"
                    type="text"
                    value={editing.badge}
                    onChange={(e) => setFormField("badge", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="menu-badge-variant">
                    Badge variant
                  </label>
                  <Input
                    id="menu-badge-variant"
                    type="text"
                    value={editing.badge_variant}
                    onChange={(e) => setFormField("badge_variant", e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="menu-roles">
                  Roles allowed (comma-separated)
                </label>
                <Input
                  id="menu-roles"
                  type="text"
                  value={editing.roles_allowed}
                  onChange={(e) => setFormField("roles_allowed", e.target.value)}
                />
              </div>
              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="menu-section">
                    Section
                  </label>
                  <Input
                    id="menu-section"
                    type="text"
                    value={editing.section}
                    onChange={(e) => setFormField("section", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="menu-section-icon">
                    Section icon
                  </label>
                  <Input
                    id="menu-section-icon"
                    type="text"
                    value={editing.section_icon}
                    onChange={(e) => setFormField("section_icon", e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="menu-promo-title">
                  Promo title
                </label>
                <Input
                  id="menu-promo-title"
                  type="text"
                  value={editing.promo_title}
                  onChange={(e) => setFormField("promo_title", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="menu-promo-subtitle">
                  Promo subtitle
                </label>
                <Input
                  id="menu-promo-subtitle"
                  type="text"
                  value={editing.promo_subtitle}
                  onChange={(e) => setFormField("promo_subtitle", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="menu-promo-image">
                  Promo image URL
                </label>
                <Input
                  id="menu-promo-image"
                  type="text"
                  value={editing.promo_image_url}
                  onChange={(e) => setFormField("promo_image_url", e.target.value)}
                />
              </div>
              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="menu-promo-cta-text">
                    Promo CTA text
                  </label>
                  <Input
                    id="menu-promo-cta-text"
                    type="text"
                    value={editing.promo_cta_text}
                    onChange={(e) => setFormField("promo_cta_text", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="menu-promo-cta-path">
                    Promo CTA path
                  </label>
                  <Input
                    id="menu-promo-cta-path"
                    type="text"
                    value={editing.promo_cta_path}
                    onChange={(e) => setFormField("promo_cta_path", e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-actions-footer">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="submit-primary-btn">
                  {saving ? "Saving..." : "Save Menu Item"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete '${deleteTarget?.title || "menu item"}'?`}
        message="This will remove the menu item and its children from the storefront navigation."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
