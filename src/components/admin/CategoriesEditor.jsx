import { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import { Button, Input, useToast } from "../ui";
import {
  apiFetchSiteCategories,
  apiSaveSiteCategory,
  apiDeleteSiteCategory,
} from "../../api/backendApi";
import ConfirmDialog from "./ConfirmDialog";

function blankForm() {
  return {
    id: null,
    name: "",
    image_url: "",
    path: "/products",
    order_index: "0",
    is_active: true,
  };
}

function editForm(category) {
  return {
    id: category.id ?? null,
    name: category.name || "",
    image_url: category.image_url || "",
    path: category.path || "/products",
    order_index: category.order_index ?? "0",
    is_active: category.is_active !== false,
  };
}

export default function CategoriesEditor() {
  const { addToast } = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetchSiteCategories();
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
      setCategories(list);
    } catch (err) {
      addToast({ title: "Categories Load Failed", message: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleActive = async (category) => {
    try {
      await apiSaveSiteCategory({
        ...category,
        is_active: !category.is_active,
        order_index: Number(category.order_index ?? 0),
      });
      addToast({
        title: category.is_active ? "Category Hidden" : "Category Activated",
        message: `'${category.name}' updated.`,
        type: "success",
      });
      await load();
    } catch (err) {
      addToast({ title: "Update Failed", message: `save failed: ${err.message}`, type: "error" });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editing || !editing.name.trim() || !editing.image_url.trim()) {
      addToast({
        title: "Missing Information",
        message: "Name and image URL are required.",
        type: "error",
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...(editing.id ? { id: editing.id } : {}),
        name: editing.name.trim(),
        image_url: editing.image_url.trim(),
        path: editing.path.trim() || "/products",
        // order_index is sent as a NUMBER — the server enforces strict integer checks.
        order_index: Number(editing.order_index ?? 0),
        is_active: Boolean(editing.is_active),
      };
      await apiSaveSiteCategory(payload);
      setEditing(null);
      addToast({ title: "Category Saved", message: `'${payload.name}' saved.`, type: "success" });
      await load();
    } catch (err) {
      addToast({ title: "Save Failed", message: `save failed: ${err.message}`, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiDeleteSiteCategory(deleteTarget.id);
      setDeleteTarget(null);
      addToast({
        title: "Category Deleted",
        message: `Removed '${deleteTarget.name}'.`,
        type: "info",
      });
      await load();
    } catch (err) {
      addToast({ title: "Delete Failed", message: err.message, type: "error" });
    }
  };

  const setFormField = (field, value) => {
    setEditing((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  return (
    <div className="dashboard-tab-view animate-fade-in">
      <div className="chart-card-header">
        <div>
          <h3 className="chart-title">Site Categories</h3>
          <p className="chart-subtitle">Homepage category circles — order, edit, or add entries</p>
        </div>
        <Button onClick={() => setEditing(blankForm())} className="quick-add-user-btn">
          <Plus size={16} />
          <span>Add Category</span>
        </Button>
      </div>

      {loading ? (
        <p className="chart-subtitle">Loading categories...</p>
      ) : categories.length === 0 ? (
        <p className="chart-subtitle">No categories yet. Add the first one to get started.</p>
      ) : (
        <div className="menu-tree">
          {categories.map((category) => (
            <div key={category.id} className="menu-tree-node" data-level={1}>
              <div className="menu-tree-row">
                {category.image_url ? (
                  <img
                    src={category.image_url}
                    alt=""
                    width={40}
                    height={40}
                    style={{ objectFit: "cover", borderRadius: "50%" }}
                  />
                ) : (
                  <span className="menu-tree-toggle-spacer" />
                )}
                <span className="menu-tree-title">{category.name}</span>
                <span className="text-muted text-sm menu-tree-path">
                  #{category.order_index ?? 0}
                </span>
                <span
                  className={`status-pill ${category.is_active === false ? "inactive" : "active"}`}
                >
                  <span className="status-dot"></span>
                  {category.is_active === false ? "Hidden" : "Active"}
                </span>
                <div className="menu-tree-actions">
                  <button
                    type="button"
                    aria-label={`${category.is_active === false ? "Activate" : "Deactivate"} ${category.name}`}
                    onClick={() => handleToggleActive(category)}
                  >
                    {category.is_active === false ? "Show" : "Hide"}
                  </button>
                  <button
                    type="button"
                    aria-label={`Edit ${category.name}`}
                    onClick={() => setEditing(editForm(category))}
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${category.name}`}
                    onClick={() => setDeleteTarget(category)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="modal-backdrop-overlay">
          <div
            className="modal-content-container animate-scale-up"
            role="dialog"
            aria-label="Category editor"
          >
            <div className="modal-header">
              <div>
                <h3 className="modal-title">
                  {editing.id ? "Edit Category" : "Add Category"}
                </h3>
                <p className="modal-subtitle">Fields save to the content API</p>
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
              <div className="form-group">
                <label className="form-label" htmlFor="category-name">
                  Name *
                </label>
                <Input
                  id="category-name"
                  type="text"
                  value={editing.name}
                  onChange={(e) => setFormField("name", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="category-image">
                  Image URL * (paste signed_url from POST /api/upload)
                </label>
                <Input
                  id="category-image"
                  type="text"
                  value={editing.image_url}
                  onChange={(e) => setFormField("image_url", e.target.value)}
                />
              </div>
              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="category-path">
                    Path
                  </label>
                  <Input
                    id="category-path"
                    type="text"
                    value={editing.path}
                    onChange={(e) => setFormField("path", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="category-order">
                    Order index
                  </label>
                  <Input
                    id="category-order"
                    type="number"
                    value={editing.order_index}
                    onChange={(e) => setFormField("order_index", e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="category-active">
                  Active
                </label>
                <Input
                  id="category-active"
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) => setFormField("is_active", e.target.checked)}
                />
              </div>
              {editing.name.trim() && editing.image_url.trim() && (
                <div className="category-preview" aria-label="Category preview">
                  <img
                    src={editing.image_url}
                    alt="Category preview"
                    width={64}
                    height={64}
                    style={{ objectFit: "cover", borderRadius: "50%" }}
                  />
                  <strong>{editing.name}</strong>
                </div>
              )}
              <div className="modal-actions-footer">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="submit-primary-btn">
                  {saving ? "Saving..." : "Save Category"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete '${deleteTarget?.name || "category"}'?`}
        message="This will remove the category from the homepage circles."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
