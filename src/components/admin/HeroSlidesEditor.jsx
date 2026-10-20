import { useCallback, useEffect, useRef, useState } from "react";
import { Edit2, Plus, Trash2, X } from "lucide-react";
import { Button, Input, useToast } from "../ui";
import {
  apiDeleteHeroSlide,
  apiFetchHeroSlides,
  apiReorderHeroSlides,
  apiSaveHeroSlide,
  apiUpdateHeroSlide,
} from "../../api/contentApi";
import ConfirmDialog from "./ConfirmDialog";
import { ActiveToggle, ImageField, OrderControls } from "./ContentEditorKit";

const CONTENT_EVENT = "marvel_content_updated";

function trimOrNull(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function blankForm(order) {
  return {
    id: null,
    badge: "",
    title: "",
    subtitle: "",
    btnText: "",
    btnPath: "/products",
    bgImageUrl: "",
    productImageUrl: "",
    fallbackImageUrl: "",
    bgGradient: "",
    priceText: "",
    tag: "",
    ribbonText: "",
    orderIndex: order,
    isActive: true,
  };
}

function editForm(slide) {
  return {
    id: slide.id ?? null,
    badge: slide.badge ?? "",
    title: slide.title ?? "",
    subtitle: slide.subtitle ?? "",
    btnText: slide.btn_text ?? "",
    btnPath: slide.btn_path ?? "/products",
    bgImageUrl: slide.bg_image_url ?? "",
    productImageUrl: slide.product_image_url ?? "",
    fallbackImageUrl: slide.fallback_image_url ?? "",
    bgGradient: slide.bg_gradient ?? "",
    priceText: slide.price_text ?? "",
    tag: slide.tag ?? "",
    ribbonText: slide.ribbon_text ?? "",
    orderIndex: Number(slide.order_index ?? 0),
    isActive: slide.is_active !== false,
  };
}

/** The single source of truth for what a save writes: every field the form owns. */
function toPayload(form) {
  return {
    badge: trimOrNull(form.badge),
    title: (form.title ?? "").trim(),
    subtitle: trimOrNull(form.subtitle),
    btn_text: trimOrNull(form.btnText),
    btn_path: trimOrNull(form.btnPath) || "/products",
    // ImageField's Clear button reports null, so trim behind a null guard.
    bg_image_url: trimOrNull(form.bgImageUrl),
    product_image_url: trimOrNull(form.productImageUrl),
    fallback_image_url: trimOrNull(form.fallbackImageUrl),
    bg_gradient: trimOrNull(form.bgGradient),
    price_text: trimOrNull(form.priceText),
    tag: trimOrNull(form.tag),
    ribbon_text: trimOrNull(form.ribbonText),
    // hero_slides keeps `order_index`; the reorder route still speaks display_order.
    order_index: Number(form.orderIndex ?? 0),
    is_active: Boolean(form.isActive),
  };
}

/** The stored value of a payload field, normalized the same way a save is. */
function storedValue(slide, key) {
  switch (key) {
    case "order_index":
      return Number(slide.order_index ?? 0);
    case "is_active":
      return slide.is_active !== false;
    default:
      return slide[key] || null;
  }
}

function changedFields(slide, payload) {
  const patch = { id: slide.id };
  for (const [key, value] of Object.entries(payload)) {
    if (storedValue(slide, key) !== value) patch[key] = value;
  }
  return patch;
}

export default function HeroSlidesEditor() {
  const { addToast } = useToast();
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reordering, setReordering] = useState(false);
  // Synchronous guard: state updates are too late to stop a double-click that
  // lands in the same tick, so every write checks this ref first.
  const requestInFlight = useRef(false);
  const busy = saving || deleting || reordering;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetchHeroSlides({ includeInactive: true });
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

  const broadcast = () => window.dispatchEvent(new Event(CONTENT_EVENT));

  const openCreate = () => {
    setFormError("");
    setEditing(blankForm(slides.length));
  };

  const openEdit = (slide) => {
    setFormError("");
    setEditing(editForm(slide));
  };

  const setField = (field, value) =>
    setEditing((previous) => (previous ? { ...previous, [field]: value } : previous));

  const handleMove = async (slide, from, to) => {
    if (requestInFlight.current) return;
    if (from === to || from < 0 || to < 0 || from >= slides.length || to >= slides.length) {
      return;
    }

    const reordered = [...slides];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    // The API rejects a partial scope, so send every slide renumbered 0..n-1.
    const orders = reordered.map((entry, index) => ({ id: entry.id, display_order: index }));

    requestInFlight.current = true;
    setReordering(true);
    try {
      await apiReorderHeroSlides(orders);
      addToast({ title: "Hero Reordered", message: `'${slide.title}' moved.`, type: "success" });
      broadcast();
      await load();
    } catch (err) {
      addToast({ title: "Reorder Failed", message: err.message, type: "error" });
    } finally {
      requestInFlight.current = false;
      setReordering(false);
    }
  };

  const handleToggleActive = async (slide) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    try {
      await apiUpdateHeroSlide(slide.id, {
        id: slide.id,
        is_active: slide.is_active === false,
      });
      addToast({
        title: slide.is_active === false ? "Slide Activated" : "Slide Hidden",
        message: `'${slide.title}' updated.`,
        type: "success",
      });
      broadcast();
      await load();
    } catch (err) {
      addToast({ title: "Update Failed", message: err.message, type: "error" });
    } finally {
      requestInFlight.current = false;
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!editing || requestInFlight.current) return;

    requestInFlight.current = true;
    setSaving(true);
    setFormError("");
    try {
      const payload = toPayload(editing);
      if (!payload.title) {
        setFormError("Title is required.");
        addToast({
          title: "Missing Information",
          message: "Enter a title before saving the slide.",
          type: "error",
        });
        return;
      }

      if (editing.id) {
        const stored = slides.find((slide) => slide.id === editing.id) ?? null;
        await apiUpdateHeroSlide(
          editing.id,
          stored ? changedFields(stored, payload) : { id: editing.id, ...payload }
        );
      } else {
        await apiSaveHeroSlide(payload);
      }

      const savedId = editing.id;
      setEditing(null);
      addToast({
        title: savedId ? "Slide Updated" : "Slide Saved",
        message: `'${payload.title}' saved.`,
        type: "success",
      });
      broadcast();
      await load();
    } catch (err) {
      // Keep the form open: the admin's input must survive a failed write.
      const message = err?.message || "Could not save the slide.";
      setFormError(message);
      addToast({ title: "Save Failed", message, type: "error" });
    } finally {
      requestInFlight.current = false;
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || requestInFlight.current) return;
    const target = deleteTarget;
    requestInFlight.current = true;
    setDeleting(true);
    try {
      await apiDeleteHeroSlide(target.id);
      setDeleteTarget(null);
      addToast({ title: "Slide Deleted", message: `Removed '${target.title}'.`, type: "info" });
      broadcast();
      await load();
    } catch (err) {
      addToast({ title: "Delete Failed", message: err.message, type: "error" });
    } finally {
      requestInFlight.current = false;
      setDeleting(false);
    }
  };

  const previewImage = (slide) =>
    slide.productImageUrl || slide.bgImageUrl || slide.fallbackImageUrl || "";

  return (
    <div className="dashboard-tab-view animate-fade-in">
      <div className="chart-card-header">
        <div>
          <h3 className="chart-title">Hero Slides</h3>
          <p className="chart-subtitle">Homepage hero carousel — order, edit, or add slides</p>
        </div>
        <Button onClick={openCreate} className="quick-add-user-btn">
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
          {slides.map((slide, index) => (
            <div key={slide.id} className="menu-tree-node" data-level={1}>
              <div className="menu-tree-row">
                {slide.product_image_url || slide.bg_image_url || slide.fallback_image_url ? (
                  <img
                    src={slide.product_image_url || slide.bg_image_url || slide.fallback_image_url}
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
                  <OrderControls
                    index={index}
                    total={slides.length}
                    label={slide.title}
                    disabled={busy}
                    onMove={(from, to) => handleMove(slide, from, to)}
                  />
                  <ActiveToggle
                    active={slide.is_active !== false}
                    label={slide.title}
                    onChange={() => handleToggleActive(slide)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${slide.title}`}
                    disabled={busy}
                    onClick={() => openEdit(slide)}
                  >
                    <Edit2 size={15} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${slide.title}`}
                    disabled={busy}
                    onClick={() => setDeleteTarget(slide)}
                  >
                    <Trash2 size={15} />
                  </Button>
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
            aria-modal="true"
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
                    onChange={(event) => setField("badge", event.target.value)}
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
                    onChange={(event) => setField("tag", event.target.value)}
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
                  onChange={(event) => setField("title", event.target.value)}
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
                  onChange={(event) => setField("subtitle", event.target.value)}
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
                    value={editing.btnText}
                    onChange={(event) => setField("btnText", event.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="hero-btn-path">
                    Button path
                  </label>
                  <Input
                    id="hero-btn-path"
                    type="text"
                    value={editing.btnPath}
                    onChange={(event) => setField("btnPath", event.target.value)}
                  />
                </div>
              </div>

              <ImageField
                label="Background image"
                value={editing.bgImageUrl}
                onChange={(url) => setField("bgImageUrl", url)}
                folder="marvel_hero"
              />
              <ImageField
                label="Product image"
                value={editing.productImageUrl}
                onChange={(url) => setField("productImageUrl", url)}
                folder="marvel_hero"
              />
              <ImageField
                label="Fallback image"
                value={editing.fallbackImageUrl}
                onChange={(url) => setField("fallbackImageUrl", url)}
                folder="marvel_hero"
              />

              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="hero-bg-gradient">
                    Background gradient
                  </label>
                  <Input
                    id="hero-bg-gradient"
                    type="text"
                    value={editing.bgGradient}
                    onChange={(event) => setField("bgGradient", event.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="hero-price-text">
                    Price text
                  </label>
                  <Input
                    id="hero-price-text"
                    type="text"
                    value={editing.priceText}
                    onChange={(event) => setField("priceText", event.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="hero-ribbon">
                  Ribbon text
                </label>
                <Input
                  id="hero-ribbon"
                  type="text"
                  value={editing.ribbonText}
                  onChange={(event) => setField("ribbonText", event.target.value)}
                />
              </div>

              <div className="form-group">
                <span className="form-label">Active</span>
                <ActiveToggle
                  active={editing.isActive}
                  label={editing.title || "this slide"}
                  onChange={(active) => setField("isActive", active)}
                />
              </div>

              {editing.title.trim() && (
                <div
                  className="hero-preview"
                  aria-label="Slide preview"
                  style={editing.bgGradient ? { background: editing.bgGradient } : undefined}
                >
                  {editing.badge && <span className="role-pill admin">{editing.badge}</span>}
                  <strong>{editing.title}</strong>
                  {editing.subtitle && <p className="chart-subtitle">{editing.subtitle}</p>}
                  {editing.priceText && <span>{editing.priceText}</span>}
                  {editing.btnText && <span>{editing.btnText}</span>}
                  {editing.ribbonText && <span>{editing.ribbonText}</span>}
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

              {formError && (
                <p role="alert" className="form-error">
                  {formError}
                </p>
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
        message="This will remove the hero slide from the homepage carousel. This cannot be undone."
        destructive
        pending={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
