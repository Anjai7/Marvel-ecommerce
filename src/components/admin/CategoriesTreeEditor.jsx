import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Edit2, Plus, Trash2, X } from "lucide-react";
import { Button, Input, useToast } from "../ui";
import {
  apiDeleteCategory,
  apiFetchCategoryTree,
  apiReorderCategories,
  apiSaveCategory,
  apiUpdateCategory,
} from "../../api/contentApi";
import ConfirmDialog from "./ConfirmDialog";
import { ActiveToggle, ImageField, OrderControls, slugify } from "./ContentEditorKit";

const CONTENT_EVENT = "marvel_content_updated";

/** Siblings and their descendants, ordered exactly as the server orders them. */
function sortTree(nodes = []) {
  return [...nodes]
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((node) => ({ ...node, children: sortTree(node.children ?? []) }));
}

function findNode(nodes = [], id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children ?? [], id);
    if (found) return found;
  }
  return null;
}

function flatten(nodes = [], acc = []) {
  for (const node of nodes) {
    acc.push(node);
    flatten(node.children ?? [], acc);
  }
  return acc;
}

/** The full sibling group for a parent — hidden rows included, because reorder
 *  requires the complete scope. Tree roots when `parentId` is null. */
function siblingsFor(nodes = [], parentId) {
  if (parentId == null) return nodes;
  return findNode(nodes, parentId)?.children ?? [];
}

function countDescendants(node) {
  return (node?.children ?? []).reduce((total, child) => total + 1 + countDescendants(child), 0);
}

function visibleNodes(nodes = [], showHidden) {
  if (showHidden) return nodes;
  return nodes
    .filter((node) => node.is_active !== false)
    .map((node) => ({ ...node, children: visibleNodes(node.children ?? [], showHidden) }));
}

/** The single source of truth for what a save writes: every field the form owns. */
function toPayload(form) {
  return {
    name: form.name.trim(),
    slug: form.slug.trim() || slugify(form.name),
    parent_id: form.parentId || null,
    level: Number(form.level),
    icon: form.icon.trim() || null,
    image_url: form.imageUrl.trim() || null,
    banner_image_url: form.bannerImageUrl.trim() || null,
    description: form.description.trim() || null,
    display_order: Number(form.displayOrder ?? 0),
    is_active: Boolean(form.isActive),
    show_in_nav: Boolean(form.showInNav),
    show_in_homepage: Boolean(form.showInHomepage),
  };
}

/** The stored value of a payload field, normalized the same way a save is. */
function storedValue(node, key) {
  switch (key) {
    case "parent_id":
      return node.parent_id ?? null;
    case "level":
      return Number(node.level ?? 1);
    case "display_order":
      return Number(node.display_order ?? 0);
    case "is_active":
      return node.is_active !== false;
    case "show_in_nav":
      return node.show_in_nav !== false;
    case "show_in_homepage":
      return node.show_in_homepage === true;
    default:
      return node[key] || null;
  }
}

/** PATCH body: the id (the server patches, never inserts) plus changed fields only. */
function changedFields(node, payload) {
  const patch = { id: node.id };
  for (const [key, value] of Object.entries(payload)) {
    if (storedValue(node, key) !== value) patch[key] = value;
  }
  return patch;
}

function newForm(parent, order) {
  return {
    id: null,
    name: "",
    slug: "",
    slugTouched: false,
    originalSlug: "",
    parentId: parent?.id ?? null,
    level: parent ? Number(parent.level ?? 1) + 1 : 1,
    icon: "",
    imageUrl: "",
    bannerImageUrl: "",
    description: "",
    displayOrder: order,
    isActive: true,
    showInNav: true,
    showInHomepage: false,
  };
}

function editForm(node) {
  return {
    id: node.id,
    name: node.name ?? "",
    slug: node.slug ?? "",
    slugTouched: true,
    originalSlug: node.slug ?? "",
    parentId: node.parent_id ?? null,
    level: Number(node.level ?? 1),
    icon: node.icon ?? "",
    imageUrl: node.image_url ?? "",
    bannerImageUrl: node.banner_image_url ?? "",
    description: node.description ?? "",
    displayOrder: Number(node.display_order ?? 0),
    isActive: node.is_active !== false,
    showInNav: node.show_in_nav !== false,
    showInHomepage: node.show_in_homepage === true,
  };
}

export default function CategoriesTreeEditor() {
  const { addToast } = useToast();
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [editing, setEditing] = useState(null);
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetchCategoryTree({ includeInactive: true });
      setTree(sortTree(data?.categories ?? []));
    } catch (err) {
      addToast({ title: "Categories Load Failed", message: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const broadcast = () => window.dispatchEvent(new Event(CONTENT_EVENT));

  const visible = useMemo(() => visibleNodes(tree, showHidden), [tree, showHidden]);

  const openCreate = (parent = null) => {
    setFormError("");
    setEditing(newForm(parent, siblingsFor(tree, parent?.id ?? null).length));
  };

  const openEdit = (node) => {
    setFormError("");
    setEditing(editForm(node));
  };

  const setField = (field, value) =>
    setEditing((previous) => (previous ? { ...previous, [field]: value } : previous));

  const handleNameChange = (name) =>
    setEditing((previous) => {
      if (!previous) return previous;
      const next = { ...previous, name };
      // A new row follows its name until the admin edits the slug; an existing
      // row keeps its stored slug until the admin changes it.
      if (!previous.id && !previous.slugTouched) next.slug = slugify(name);
      return next;
    });

  const handleSlugChange = (slug) =>
    setEditing((previous) => (previous ? { ...previous, slug, slugTouched: true } : previous));

  const handleParentChange = (value) =>
    setEditing((previous) => {
      if (!previous) return previous;
      const parentId = value || null;
      const parent = parentId ? findNode(tree, parentId) : null;
      return {
        ...previous,
        parentId,
        level: parent ? Number(parent.level ?? 1) + 1 : 1,
      };
    });

  const handleSave = async (event) => {
    event.preventDefault();
    if (!editing) return;

    const payload = toPayload(editing);
    if (!payload.name) {
      setFormError("Category name is required.");
      addToast({
        title: "Missing Information",
        message: "Category name is required.",
        type: "error",
      });
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      if (editing.id) {
        const stored = findNode(tree, editing.id);
        await apiUpdateCategory(editing.id, stored ? changedFields(stored, payload) : payload);
      } else {
        await apiSaveCategory(payload);
      }
      const savedId = editing.id;
      setEditing(null);
      addToast({
        title: savedId ? "Category Updated" : "Category Saved",
        message: `'${payload.name}' saved.`,
        type: "success",
      });
      broadcast();
      await load();
    } catch (err) {
      // Keep the form open: the admin's input must survive a failed write.
      const message = err?.message || "Could not save the category.";
      setFormError(message);
      addToast({ title: "Save Failed", message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleMove = async (node, from, to) => {
    const siblings = siblingsFor(tree, node.parent_id ?? null);
    if (from === to || from < 0 || to < 0 || from >= siblings.length || to >= siblings.length) {
      return;
    }

    const reordered = [...siblings];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    // The API rejects a partial scope, so send every sibling renumbered 0..n-1.
    const orders = reordered.map((sibling, index) => ({
      id: sibling.id,
      display_order: index,
    }));

    try {
      await apiReorderCategories(orders);
      addToast({
        title: "Categories Reordered",
        message: `'${node.name}' moved.`,
        type: "success",
      });
      broadcast();
      await load();
    } catch (err) {
      addToast({ title: "Reorder Failed", message: err.message, type: "error" });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiDeleteCategory(deleteTarget.id);
      setDeleteTarget(null);
      addToast({
        title: "Category Deleted",
        message: `Removed '${deleteTarget.name}'.`,
        type: "info",
      });
      broadcast();
      await load();
    } catch (err) {
      addToast({ title: "Delete Failed", message: err.message, type: "error" });
    }
  };

  const renderNode = (node, depth) => {
    const children = node.children ?? [];
    const siblings = siblingsFor(tree, node.parent_id ?? null);
    const index = siblings.findIndex((sibling) => sibling.id === node.id);
    const isOpen = !collapsed[node.id];

    return (
      <div
        key={node.id}
        className="menu-tree-node"
        data-level={depth}
        data-testid={`category-node-${node.id}`}
      >
        <div className="menu-tree-row">
          {children.length > 0 ? (
            <button
              type="button"
              className="menu-tree-toggle"
              aria-label={`${isOpen ? "Collapse" : "Expand"} ${node.name}`}
              aria-expanded={isOpen}
              onClick={() =>
                setCollapsed((previous) => ({ ...previous, [node.id]: !previous[node.id] }))
              }
            >
              {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
          ) : (
            <span className="menu-tree-toggle-spacer" />
          )}

          <span className="menu-tree-title">{node.name}</span>
          <span className="text-muted text-sm menu-tree-path">{node.slug}</span>
          <span className={`status-pill ${node.is_active === false ? "inactive" : "active"}`}>
            <span className="status-dot"></span>
            {node.is_active === false ? "Hidden" : "Active"}
          </span>

          <div className="menu-tree-actions">
            <OrderControls
              index={index}
              total={siblings.length}
              label={node.name}
              onMove={(from, to) => handleMove(node, from, to)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Add subcategory to ${node.name}`}
              disabled={Number(node.level ?? depth) >= 3}
              onClick={() => openCreate(node)}
            >
              <Plus size={15} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Edit ${node.name}`}
              onClick={() => openEdit(node)}
            >
              <Edit2 size={15} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Delete ${node.name}`}
              onClick={() => setDeleteTarget(node)}
            >
              <Trash2 size={15} />
            </Button>
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

  const editorSiblings = editing ? siblingsFor(tree, editing.parentId ?? null) : [];
  const editorIndex = editing?.id
    ? Math.max(
        0,
        editorSiblings.findIndex((sibling) => sibling.id === editing.id)
      )
    : editorSiblings.length;
  const editorTotal = editing?.id ? editorSiblings.length : editorSiblings.length + 1;
  const parentLevel = editing ? editing.level - 1 : 0;
  const parentOptions =
    editing && parentLevel >= 1
      ? flatten(tree).filter(
          (candidate) => Number(candidate.level) === parentLevel && candidate.id !== editing.id
        )
      : [];
  const descendants = countDescendants(deleteTarget ? findNode(tree, deleteTarget.id) : null);

  return (
    <div className="dashboard-tab-view animate-fade-in">
      <div className="chart-card-header">
        <div>
          <h3 className="chart-title">Categories &amp; Subcategories</h3>
          <p className="chart-subtitle">
            Three-level taxonomy — add, reorder, edit, or delete a category tree
          </p>
        </div>
        <Button onClick={() => openCreate(null)} className="quick-add-user-btn">
          <Plus size={16} />
          <span>Add Top-Level Category</span>
        </Button>
      </div>

      <label
        className="form-label"
        htmlFor="category-show-hidden"
        style={{ display: "flex", gap: 8 }}
      >
        <input
          id="category-show-hidden"
          type="checkbox"
          checked={showHidden}
          onChange={(event) => setShowHidden(event.target.checked)}
        />
        Show hidden
      </label>

      {loading ? (
        <p className="chart-subtitle">Loading category tree...</p>
      ) : visible.length === 0 ? (
        <p className="chart-subtitle">No categories yet. Add the first one to get started.</p>
      ) : (
        <div className="menu-tree">{visible.map((node) => renderNode(node, 1))}</div>
      )}

      {editing && (
        <div className="modal-backdrop-overlay">
          <div
            className="modal-content-container animate-scale-up"
            role="dialog"
            aria-modal="true"
            aria-label="Category editor"
          >
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{editing.id ? "Edit Category" : "Add Category"}</h3>
                <p className="modal-subtitle">
                  Level {editing.level} —{" "}
                  {editing.level === 1
                    ? "a top-level category has no parent"
                    : "a child of the selected parent"}
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
                  <label className="form-label" htmlFor="category-name">
                    Name *
                  </label>
                  <Input
                    id="category-name"
                    type="text"
                    value={editing.name}
                    onChange={(event) => handleNameChange(event.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="category-slug">
                    Slug *
                  </label>
                  <Input
                    id="category-slug"
                    type="text"
                    value={editing.slug}
                    onChange={(event) => handleSlugChange(event.target.value)}
                  />
                </div>
              </div>

              {editing.id && editing.slug !== editing.originalSlug && (
                <output className="form-hint" style={{ display: "block", margin: 0 }}>
                  Changing this slug changes the category's path and every descendant's path.
                  Existing links to the old URL will stop resolving.
                </output>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="category-parent">
                  Parent category
                </label>
                <select
                  id="category-parent"
                  className="form-select-field"
                  value={editing.parentId ?? ""}
                  onChange={(event) => handleParentChange(event.target.value)}
                  disabled={editing.level === 1}
                >
                  <option value="">No parent (level 1)</option>
                  {parentOptions.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="category-icon">
                    Icon
                  </label>
                  <Input
                    id="category-icon"
                    type="text"
                    value={editing.icon}
                    onChange={(event) => setField("icon", event.target.value)}
                  />
                </div>
                <div className="form-group">
                  <span className="form-label">Display order</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <OrderControls
                      index={editorIndex}
                      total={editorTotal}
                      label="this category"
                      onMove={(_from, to) => setField("displayOrder", to)}
                    />
                    <span className="text-sm text-muted">
                      Position {editorIndex + 1} of {editorTotal}
                    </span>
                  </div>
                </div>
              </div>

              <ImageField
                label="Category image"
                value={editing.imageUrl}
                onChange={(url) => setField("imageUrl", url)}
              />
              <ImageField
                label="Banner image"
                value={editing.bannerImageUrl}
                onChange={(url) => setField("bannerImageUrl", url)}
              />

              <div className="form-group">
                <label className="form-label" htmlFor="category-description">
                  Description
                </label>
                <textarea
                  id="category-description"
                  className="ui-input"
                  rows={3}
                  value={editing.description}
                  onChange={(event) => setField("description", event.target.value)}
                />
              </div>

              <div className="form-group">
                <span className="form-label">Active</span>
                <ActiveToggle
                  active={editing.isActive}
                  label={editing.name || "this category"}
                  onChange={(active) => setField("isActive", active)}
                />
              </div>

              <label
                className="form-label"
                htmlFor="category-show-nav"
                style={{ display: "flex", gap: 8, alignItems: "center" }}
              >
                <input
                  id="category-show-nav"
                  type="checkbox"
                  checked={editing.showInNav}
                  onChange={(event) => setField("showInNav", event.target.checked)}
                />
                Show in navigation
              </label>
              <label
                className="form-label"
                htmlFor="category-show-homepage"
                style={{ display: "flex", gap: 8, alignItems: "center" }}
              >
                <input
                  id="category-show-homepage"
                  type="checkbox"
                  checked={editing.showInHomepage}
                  onChange={(event) => setField("showInHomepage", event.target.checked)}
                />
                Show on homepage
              </label>

              {formError && (
                <p role="alert" className="form-error" style={{ color: "#dc2626", margin: 0 }}>
                  {formError}
                </p>
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
        title={`Delete '${deleteTarget?.name ?? "category"}'?`}
        message={
          descendants > 0
            ? `${descendants} ${descendants === 1 ? "subcategory" : "subcategories"} will also be deleted.`
            : "This category has no subcategories."
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
