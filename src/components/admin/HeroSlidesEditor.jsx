import { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import { Button, Input, useToast } from "../ui";
import { apiFetchHeroSlides, apiSaveHeroSlide, apiDeleteHeroSlide } from "../../api/contentApi";
import ConfirmDialog from "./ConfirmDialog";

function blankForm() {
  return {
    id: null,
    badge: "",
    title: "",
    subtitle: "",
    btn_text: "",
    btn_path: "/products",
    bg_image_url: "",
    product_image_url: "",
    fallback_image_url: "",
    bg_gradient: "",
    price_text: "",
    tag: "",
    ribbon_text: "",
    order_index: "0",
    is_active: true,
  };
}

function editForm(slide) {
  return {
    id: slide.id ?? null,
    badge: slide.badge || "",
    title: slide.title || "",
    subtitle: slide.subtitle || "",
    btn_text: slide.btn_text || "",
    btn_path: slide.btn_path || "/products",
    bg_image_url: slide.bg_image_url || "",
    product_image_url: slide.product_image_url || "",
    fallback_image_url: slide.fallback_image_url || "",
    bg_gradient: slide.bg_gradient || "",
    price_text: slide.price_text || "",
    tag: slide.tag || "",
    ribbon_text: slide.ribbon_text || "",
    order_index: slide.order_index ?? "0",
    is_active: slide.is_active !== false,
  };
}

export default function HeroSlidesEditor() {
  const { addToast } = useToast();
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetchHeroSlides();
      const list = Array.isArray(data?.slides) ? [...data.slides] : [];
      list.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
      setSlides(list);
    } catch (err) {
      addToast({ title: "Hero Load Failed", message: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleActive = async (slide) => {
    try {
      await apiSaveHeroSlide({
        ...slide,
        is_active: !slide.is_active,
        order_index: Number(slide.order_index ?? 0),
      });
      addToast({
        title: slide.is_active ? "Slide Hidden" : "Slide Activated",
        message: `'${slide.title}' updated.`,
        type: "success",
      });
      await load();
    } catch (err) {
      addToast({ title: "Update Failed", message: `save failed: ${err.message}`, type: "error" });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editing || !editing.title.trim()) {
      addToast({
        title: "Missing Information",
        message: "Title is required.",
        type: "error",
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...(editing.id ? { id: editing.id } : {}),
        badge: editing.badge.trim() || null,
        title: editing.title.trim(),
        subtitle: editing.subtitle.trim() || null,
        btn_text: editing.btn_text.trim() || null,
        btn_path: editing.btn_path.trim() || "/products",
        bg_image_url: editing.bg_image_url.trim() || null,
        product_image_url: editing.product_image_url.trim() || null,
        fallback_image_url: editing.fallback_image_url.trim() || null,
        bg_gradient: editing.bg_gradient.trim() || null,
        price_text: editing.price_text.trim() || null,
        tag: editing.tag.trim() || null,
        ribbon_text: editing.ribbon_text.trim() || null,
        // order_index is sent as a NUMBER — the server enforces strict integer checks.
        order_index: Number(editing.order_index ?? 0),
        is_active: Boolean(editing.is_active),
      };
      await apiSaveHeroSlide(payload);
      setEditing(null);
      addToast({ title: "Slide Saved", message: `'${payload.title}' saved.`, type: "success" });
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
      await apiDeleteHeroSlide(deleteTarget.id);
      setDeleteTarget(null);
      addToast({
        title: "Slide Deleted",
        message: `Removed '${deleteTarget.title}'.`,
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

  const previewImage = (slide) =>
    slide.product_image_url || slide.bg_image_url || slide.fallback_image_url || "";

  return (
    <div className="dashboard-tab-view animate-fade-in">
      <div className="chart-card-header">
        <div>
          <h3 className="chart-title">Hero Slides</h3>
          <p className="chart-subtitle">Homepage hero carousel — order, edit, or add slides</p>
        </div>
        <Button onClick={() => setEditing(blankForm())} className="quick-add-user-btn">
          <Plus size={16} />
          <span>Add Slide</span>
        </Button>
      </div>

      {loading ? (
        <p className="chart-subtitle">Loading hero slides...</p>
      ) : slides.length === 0 ? (
        <p className="chart-subtitle">No hero slides yet. Add the first one to get started.</p>
      ) : (
        <div className="menu-tree">
          {slides.map((slide) => (
            <div key={slide.id} className="menu-tree-node" data-level={1}>
              <div className="menu-tree-row">
                {previewImage(slide) ? (
                  <img
                    src={previewImage(slide)}
                    alt=""
                    width={48}
                    height={32}
                    style={{ objectFit: "cover", borderRadius: 4 }}
                  />
                ) : (
                  <span className="menu-tree-toggle-spacer" />
                )}
                <span className="menu-tree-title">{slide.title}</span>
                {slide.badge && <span className="role-pill admin">{slide.badge}</span>}
                <span className="text-muted text-sm menu-tree-path">#{slide.order_index ?? 0}</span>
                <span
                  className={`status-pill ${slide.is_active === false ? "inactive" : "active"}`}
                >
                  <span className="status-dot"></span>
                  {slide.is_active === false ? "Hidden" : "Active"}
                </span>
                <div className="menu-tree-actions">
                  <button
                    type="button"
                    aria-label={`${slide.is_active === false ? "Activate" : "Deactivate"} ${slide.title}`}
                    onClick={() => handleToggleActive(slide)}
                  >
                    {slide.is_active === false ? "Show" : "Hide"}
                  </button>
                  <button
                    type="button"
                    aria-label={`Edit ${slide.title}`}
                    onClick={() => setEditing(editForm(slide))}
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${slide.title}`}
                    onClick={() => setDeleteTarget(slide)}
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
            aria-label="Hero slide editor"
          >
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{editing.id ? "Edit Hero Slide" : "Add Hero Slide"}</h3>
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
              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="hero-badge">
                    Badge
                  </label>
                  <Input
                    id="hero-badge"
                    type="text"
                    value={editing.badge}
                    onChange={(e) => setFormField("badge", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="hero-tag">
                    Tag
                  </label>
                  <Input
                    id="hero-tag"
                    type="text"
                    value={editing.tag}
                    onChange={(e) => setFormField("tag", e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="hero-title">
                  Title *
                </label>
                <Input
                  id="hero-title"
                  type="text"
                  value={editing.title}
                  onChange={(e) => setFormField("title", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="hero-subtitle">
                  Subtitle
                </label>
                <Input
                  id="hero-subtitle"
                  type="text"
                  value={editing.subtitle}
                  onChange={(e) => setFormField("subtitle", e.target.value)}
                />
              </div>
              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="hero-btn-text">
                    Button text
                  </label>
                  <Input
                    id="hero-btn-text"
                    type="text"
                    value={editing.btn_text}
                    onChange={(e) => setFormField("btn_text", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="hero-btn-path">
                    Button path
                  </label>
                  <Input
                    id="hero-btn-path"
                    type="text"
                    value={editing.btn_path}
                    onChange={(e) => setFormField("btn_path", e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="hero-bg-image">
                  Background image URL (paste signed_url from POST /api/upload)
                </label>
                <Input
                  id="hero-bg-image"
                  type="text"
                  value={editing.bg_image_url}
                  onChange={(e) => setFormField("bg_image_url", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="hero-product-image">
                  Product image URL (paste signed_url from POST /api/upload)
                </label>
                <Input
                  id="hero-product-image"
                  type="text"
                  value={editing.product_image_url}
                  onChange={(e) => setFormField("product_image_url", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="hero-fallback-image">
                  Fallback image URL (paste signed_url from POST /api/upload)
                </label>
                <Input
                  id="hero-fallback-image"
                  type="text"
                  value={editing.fallback_image_url}
                  onChange={(e) => setFormField("fallback_image_url", e.target.value)}
                />
              </div>
              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="hero-bg-gradient">
                    Background gradient
                  </label>
                  <Input
                    id="hero-bg-gradient"
                    type="text"
                    value={editing.bg_gradient}
                    onChange={(e) => setFormField("bg_gradient", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="hero-price-text">
                    Price text
                  </label>
                  <Input
                    id="hero-price-text"
                    type="text"
                    value={editing.price_text}
                    onChange={(e) => setFormField("price_text", e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="hero-ribbon">
                    Ribbon text
                  </label>
                  <Input
                    id="hero-ribbon"
                    type="text"
                    value={editing.ribbon_text}
                    onChange={(e) => setFormField("ribbon_text", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="hero-order">
                    Order index
                  </label>
                  <Input
                    id="hero-order"
                    type="number"
                    value={editing.order_index}
                    onChange={(e) => setFormField("order_index", e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="hero-active">
                  Active
                </label>
                <Input
                  id="hero-active"
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) => setFormField("is_active", e.target.checked)}
                />
              </div>
              {editing.title.trim() && (
                <div
                  className="hero-preview"
                  aria-label="Slide preview"
                  style={editing.bg_gradient ? { background: editing.bg_gradient } : undefined}
                >
                  {editing.badge && <span className="role-pill admin">{editing.badge}</span>}
                  <strong>{editing.title}</strong>
                  {editing.subtitle && <p className="chart-subtitle">{editing.subtitle}</p>}
                  {editing.price_text && <span>{editing.price_text}</span>}
                  {editing.btn_text && <span>{editing.btn_text}</span>}
                  {editing.ribbon_text && <span>{editing.ribbon_text}</span>}
                  {previewImage(editing) && (
                    <img
                      src={previewImage(editing)}
                      alt="Slide preview"
                      width={96}
                      height={64}
                      style={{ objectFit: "cover", borderRadius: 4 }}
                    />
                  )}
                </div>
              )}
              <div className="modal-actions-footer">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="submit-primary-btn">
                  {saving ? "Saving..." : "Save Slide"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete '${deleteTarget?.title || "slide"}'?`}
        message="This will remove the hero slide from the homepage carousel."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
