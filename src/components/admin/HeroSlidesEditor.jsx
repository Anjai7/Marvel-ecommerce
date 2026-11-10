import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Edit2, Eye, Plus, Trash2 } from "lucide-react";
import { Button, Input, useToast } from "../ui";
import Switch from "../ui/Switch";
import "./admin-content.css";
import {
  apiDeleteHeroSlide,
  apiFetchHeroSlides,
  apiReorderHeroSlides,
  apiSaveHeroSlide,
  apiUpdateHeroSlide,
} from "../../api/contentApi";
import AdminConfirmStrip from "./AdminConfirmStrip";
import AdminInlinePanel from "./AdminInlinePanel";
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
    btnEnabled: true,
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
    btnEnabled: slide.btn_enabled !== false,
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
    btn_enabled: Boolean(form.btnEnabled),
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
    case "btn_enabled":
      return slide.btn_enabled !== false;
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
  const [viewing, setViewing] = useState(null);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
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
    setFieldErrors({});
    setEditing(blankForm(slides.length));
  };

  const openEdit = (slide) => {
    setFormError("");
    setFieldErrors({});
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

  /** `active` is the value the kit computed from the current row; trust it. */
  const handleToggleActive = async (slide, active) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    const nextActive = Boolean(active);
    try {
      await apiUpdateHeroSlide(slide.id, {
        id: slide.id,
        is_active: nextActive,
      });
      addToast({
        title: nextActive ? "Slide Activated" : "Slide Hidden",
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
    setFieldErrors({});
    try {
      const payload = toPayload(editing);
      const errors = {};
      if (!payload.title) {
        errors.title = "Hero slide title is required.";
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setFormError("Title is required.");
        addToast({
          title: "Missing Information",
          message: "Enter a title before saving the slide.",
          type: "error",
        });
        const el = document.getElementById("hero-title");
        if (el) el.focus();
        requestInFlight.current = false;
        setSaving(false);
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

      {editing && (
        <AdminInlinePanel
          title={editing.id ? "Edit Hero Slide" : "Add Hero Slide"}
          subtitle="Fields save to the content API"
          tone="purple"
          onClose={() => setEditing(null)}
          closeLabel="Close the hero slide editor"
        >
          <form onSubmit={handleSave} className="admin-inline-form">
            <div className="form-group-row">
              <div className="form-group">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <label className="form-label" htmlFor="hero-badge">
                    Badge
                  </label>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>(Optional)</span>
                </div>
                <Input
                  id="hero-badge"
                  type="text"
                  value={editing.badge}
                  onChange={(event) => setField("badge", event.target.value)}
                />
              </div>
              <div className="form-group">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <label className="form-label" htmlFor="hero-tag">
                    Tag
                  </label>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>(Optional)</span>
                </div>
                <Input
                  id="hero-tag"
                  type="text"
                  value={editing.tag}
                  onChange={(event) => setField("tag", event.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <label
                  className="form-label"
                  htmlFor="hero-title"
                  style={{
                    color: fieldErrors.title ? "#dc2626" : undefined,
                    fontWeight: 600,
                  }}
                >
                  Title *
                </label>
                <span
                  style={{
                    fontSize: "11px",
                    color: fieldErrors.title ? "#dc2626" : "#ef4444",
                    fontWeight: 600,
                  }}
                >
                  (Mandatory)
                </span>
              </div>
              <Input
                id="hero-title"
                type="text"
                value={editing.title}
                style={
                  fieldErrors.title
                    ? {
                        borderColor: "#ef4444",
                        borderWidth: "2px",
                        backgroundColor: "#fef2f2",
                        boxShadow: "0 0 0 3px rgba(239, 68, 68, 0.15)",
                      }
                    : {}
                }
                onChange={(event) => {
                  setField("title", event.target.value);
                  if (fieldErrors.title) {
                    setFieldErrors((prev) => ({ ...prev, title: undefined }));
                  }
                }}
              />
              {fieldErrors.title && (
                <span
                  className="field-error-text"
                  style={{
                    color: "#dc2626",
                    fontSize: "12px",
                    fontWeight: 600,
                    marginTop: "5px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <AlertCircle size={13} color="#dc2626" />
                  {fieldErrors.title}
                </span>
              )}
            </div>

            <div className="form-group">
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <label className="form-label" htmlFor="hero-subtitle">
                  Subtitle
                </label>
                <span style={{ fontSize: "11px", color: "#64748b" }}>(Optional)</span>
              </div>
              <Input
                id="hero-subtitle"
                type="text"
                value={editing.subtitle}
                onChange={(event) => setField("subtitle", event.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: "8px" }}>
              <div
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <label className="form-label" htmlFor="hero-cta-toggle" style={{ margin: 0 }}>
                  CTA Button
                </label>
                <div className="hero-status-switch">
                  <Switch
                    id="hero-cta-toggle"
                    checked={editing.btnEnabled}
                    onChange={(event) => setField("btnEnabled", event.target.checked)}
                    slotProps={{ input: { "aria-label": "Enable CTA button" } }}
                  />
                  <span className="hero-status-switch-text" aria-hidden="true">
                    {editing.btnEnabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>
              <p
                className="form-hint"
                style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 0" }}
              >
                When disabled, the button is hidden on the storefront while retaining configured
                text and link.
              </p>
            </div>

            <div className="form-group-row">
              <div className="form-group">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <label className="form-label" htmlFor="hero-btn-text">
                    Button text
                  </label>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>(Optional)</span>
                </div>
                <Input
                  id="hero-btn-text"
                  type="text"
                  placeholder="e.g. Shop Now"
                  value={editing.btnText}
                  onChange={(event) => setField("btnText", event.target.value)}
                />
              </div>
              <div className="form-group">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <label className="form-label" htmlFor="hero-btn-path">
                    Button path
                  </label>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>(Optional)</span>
                </div>
                <Input
                  id="hero-btn-path"
                  type="text"
                  placeholder="e.g. /products"
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
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <label className="form-label" htmlFor="hero-bg-gradient">
                    Background gradient
                  </label>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>(Optional)</span>
                </div>
                <Input
                  id="hero-bg-gradient"
                  type="text"
                  value={editing.bgGradient}
                  onChange={(event) => setField("bgGradient", event.target.value)}
                />
              </div>
              <div className="form-group">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <label className="form-label" htmlFor="hero-price-text">
                    Price text
                  </label>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>(Optional)</span>
                </div>
                <Input
                  id="hero-price-text"
                  type="text"
                  value={editing.priceText}
                  onChange={(event) => setField("priceText", event.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <label className="form-label" htmlFor="hero-ribbon">
                  Ribbon text
                </label>
                <span style={{ fontSize: "11px", color: "#64748b" }}>(Optional)</span>
              </div>
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
                {editing.btnEnabled && editing.btnText && <span>{editing.btnText}</span>}
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

            <div className="admin-inline-actions">
              <Button
                type="button"
                variant="outline"
                className="btn-cancel-red"
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="submit-primary-btn">
                {saving ? "Saving..." : "Save Slide"}
              </Button>
            </div>
          </form>
        </AdminInlinePanel>
      )}

      {viewing && (
        <AdminInlinePanel
          title={viewing.title}
          subtitle="Hero slide details & storefront preview"
          tone="blue"
          onClose={() => setViewing(null)}
          closeLabel="Close the slide preview"
        >
          <div
            className="admin-inline-stack"
            style={{
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div
              className="hero-preview"
              aria-label="Slide preview details"
              style={viewing.bg_gradient ? { background: viewing.bg_gradient } : undefined}
            >
              {viewing.badge && <span className="role-pill admin">{viewing.badge}</span>}
              <strong>{viewing.title}</strong>
              {viewing.subtitle && <p className="chart-subtitle">{viewing.subtitle}</p>}
              {viewing.price_text && <span>{viewing.price_text}</span>}
              {viewing.btn_enabled !== false && viewing.btn_text && (
                <span style={{ fontWeight: 600, color: "#2563eb" }}>{viewing.btn_text}</span>
              )}
              {viewing.ribbon_text && <span>{viewing.ribbon_text}</span>}
              {(viewing.product_image_url ||
                viewing.bg_image_url ||
                viewing.fallback_image_url) && (
                <img
                  src={
                    viewing.product_image_url || viewing.bg_image_url || viewing.fallback_image_url
                  }
                  alt={viewing.title}
                  width={96}
                  height={64}
                  style={{ objectFit: "cover", borderRadius: 4 }}
                />
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                fontSize: "13px",
              }}
            >
              <div>
                <strong>Order:</strong> #{viewing.order_index ?? 0}
              </div>
              <div>
                <strong>Status:</strong>{" "}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontWeight: 700,
                    color: viewing.is_active === false ? "#64748b" : "#059669",
                  }}
                >
                  {viewing.is_active === false ? "OFF" : "ON"}
                </span>
              </div>
              <div>
                <strong>Tag:</strong> {viewing.tag || "None"}
              </div>
              <div>
                <strong>Price:</strong> {viewing.price_text || "None"}
              </div>
              <div>
                <strong>CTA Status:</strong>{" "}
                {viewing.btn_enabled === false ? "Disabled" : "Enabled"}
              </div>
              <div>
                <strong>CTA Destination:</strong> {viewing.btn_path || "/products"}
              </div>
            </div>

            <div
              className="admin-inline-actions"
              style={{ padding: "12px 0 0 0", borderTop: "1px solid #e2e8f0" }}
            >
              <Button type="button" variant="outline" onClick={() => setViewing(null)}>
                Close
              </Button>
              <Button
                type="button"
                className="submit-primary-btn"
                onClick={() => {
                  const toEdit = viewing;
                  setViewing(null);
                  openEdit(toEdit);
                }}
              >
                Edit Slide
              </Button>
            </div>
          </div>
        </AdminInlinePanel>
      )}

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
                <div className="hero-status-switch">
                  <Switch
                    checked={slide.is_active !== false}
                    disabled={busy}
                    onChange={(event) => handleToggleActive(slide, event.target.checked)}
                    slotProps={{ input: { "aria-label": slide.title } }}
                    title={
                      slide.is_active !== false
                        ? `Deactivate ${slide.title}`
                        : `Activate ${slide.title}`
                    }
                  />
                  <span className="hero-status-switch-text" aria-hidden="true">
                    {slide.is_active !== false ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="menu-tree-actions">
                  <OrderControls
                    index={index}
                    total={slides.length}
                    label={slide.title}
                    disabled={busy}
                    onMove={(from, to) => handleMove(slide, from, to)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`View ${slide.title}`}
                    disabled={busy}
                    onClick={() => setViewing(slide)}
                  >
                    <Eye size={15} />
                  </Button>
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

      <AdminConfirmStrip
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
