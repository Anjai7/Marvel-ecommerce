import { useCallback, useEffect, useRef, useState } from "react";
import { Edit2, Plus, Trash2, X } from "lucide-react";
import { Button, Input, useToast } from "../ui";
import {
  apiDeleteBanner,
  apiFetchBanners,
  apiReorderBanners,
  apiSaveBanner,
  apiUpdateBanner,
} from "../../api/contentApi";
import ConfirmDialog from "./ConfirmDialog";
import { ActiveToggle, cellValue, ImageField, OrderControls } from "./ContentEditorKit";
import "./banners-editor.css";

const CONTENT_EVENT = "marvel_content_updated";

const PLACEMENTS = [
  { value: "home_banner_layout", label: "Home Banner Layout" },
  { value: "home_promo_carousel", label: "Home Promo Carousel" },
  { value: "promo_strip", label: "Promo Strip" },
];

const COLUMNS = {
  home_banner_layout: ["title", "variant", "display_order"],
  home_promo_carousel: ["title", "badge", "display_order"],
  promo_strip: ["title", "code", "display_order"],
};

const trimOrNull = (value) => {
  const text = String(value ?? "").trim();
  return text || null;
};

/** A datetime-local value in the browser's zone, for an ISO timestamp. */
function toDatetimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function newForm(placement, order) {
  return {
    id: null,
    // The row this edit was opened from, captured so the save can diff against
    // the values the admin actually saw — the list may have been refetched
    // since (changing the placement tab refetches it).
    original: null,
    placement,
    title: "",
    subtitle: "",
    badge: "",
    highlight: "",
    description: "",
    ctaText: "",
    ctaPath: "",
    imageUrl: "",
    variant: "large",
    gallery: [],
    endsAt: "",
    emoji: "",
    code: "",
    accent: "",
    bgColor: "",
    displayOrder: order,
    isActive: true,
  };
}

function editForm(row) {
  return {
    id: row.id,
    original: row,
    placement: row.placement,
    title: row.title ?? "",
    subtitle: row.subtitle ?? "",
    badge: row.badge ?? "",
    highlight: row.highlight ?? "",
    description: row.description ?? "",
    ctaText: row.cta_text ?? "",
    ctaPath: row.cta_path ?? "",
    imageUrl: row.image_url ?? "",
    variant: row.variant === "large" ? "large" : "small",
    gallery: Array.isArray(row.gallery) ? [...row.gallery] : [],
    endsAt: toDatetimeLocal(row.ends_at),
    emoji: row.emoji ?? "",
    code: row.code ?? "",
    accent: row.accent ?? "",
    bgColor: row.bg_color ?? "",
    displayOrder: Number(row.display_order ?? 0),
    isActive: row.is_active !== false,
  };
}

/** The single source of truth for what a save writes: every field the form owns. */
function toPayload(form) {
  const common = {
    placement: form.placement,
    title: form.title.trim(),
    display_order: Number(form.displayOrder ?? 0),
    is_active: Boolean(form.isActive),
  };

  if (form.placement === "home_promo_carousel") {
    return {
      ...common,
      badge: trimOrNull(form.badge),
      highlight: trimOrNull(form.highlight),
      description: trimOrNull(form.description),
      cta_text: trimOrNull(form.ctaText),
      cta_path: trimOrNull(form.ctaPath),
      // promo_banners.gallery is NOT NULL — always an array, never null.
      gallery: (form.gallery ?? []).map((url) => String(url ?? "").trim()).filter(Boolean),
      ends_at: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    };
  }

  if (form.placement === "promo_strip") {
    return {
      ...common,
      subtitle: trimOrNull(form.subtitle),
      emoji: trimOrNull(form.emoji),
      code: trimOrNull(form.code),
      accent: trimOrNull(form.accent),
      bg_color: trimOrNull(form.bgColor),
      cta_text: trimOrNull(form.ctaText),
      cta_path: trimOrNull(form.ctaPath),
    };
  }

  return {
    ...common,
    subtitle: trimOrNull(form.subtitle),
    cta_text: trimOrNull(form.ctaText),
    cta_path: trimOrNull(form.ctaPath),
    image_url: form.imageUrl || null,
    // A variant that is neither large nor small renders as small (§3.4).
    // Normalizing here and in storedValue keeps an untouched "standard" out
    // of a patch that only changed the title.
    variant: form.variant === "large" ? "large" : "small",
  };
}

/** The stored value of a payload field, normalized the same way a save is. */
function storedValue(row, key) {
  switch (key) {
    case "display_order":
      return Number(row.display_order ?? 0);
    case "is_active":
      return row.is_active !== false;
    case "variant":
      return row.variant === "large" ? "large" : "small";
    case "gallery":
      return Array.isArray(row.gallery) ? row.gallery : [];
    case "ends_at":
      return row.ends_at ?? null;
    default:
      // A stored empty string and a cleared form field both mean "no value".
      return row[key] || null;
  }
}

/** Arrays compare by contents; timestamps by instant, not by formatting. */
function comparable(key, value) {
  if (key === "ends_at") return value ? Date.parse(value) : null;
  if (Array.isArray(value)) return JSON.stringify(value);
  return value;
}

/** PATCH body: the id plus only the fields the admin actually changed. */
function changedFields(row, payload) {
  const patch = { id: row.id };
  for (const [key, value] of Object.entries(payload)) {
    if (comparable(key, storedValue(row, key)) !== comparable(key, value)) patch[key] = value;
  }
  return patch;
}

/**
 * A complete, renumbered order list for one placement with `rowId` at
 * `position`. Positions must be unique inside a placement, so a form-level
 * move renumbers every sibling instead of writing a single raw display_order.
 * The list is fetched fresh: the caller may just have changed the row's
 * placement, in which case the cached list is the old placement's.
 */
async function renumberPlacement(rowId, placement, position) {
  const data = await apiFetchBanners({ placement, includeInactive: true });
  const rows = Array.isArray(data?.banners) ? data.banners : [];
  const source = rows.find((row) => row.id === rowId) ?? { id: rowId };
  const others = rows.filter((row) => row.id !== rowId);
  const target = Math.max(0, Math.min(Number(position ?? 0) || 0, others.length));
  const reordered = [...others];
  reordered.splice(target, 0, source);
  if (reordered.length < 2) return;
  await apiReorderBanners(reordered.map((row, index) => ({ id: row.id, display_order: index })));
}

const textField = ({ id, label, value, onChange, type = "text" }) => (
  <div className="form-group" key={id}>
    <label className="form-label" htmlFor={id}>
      {label}
    </label>
    <Input
      id={id}
      type={type}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
    />
  </div>
);

export default function BannersEditor() {
  const { addToast } = useToast();
  const [placement, setPlacement] = useState(PLACEMENTS[0].value);
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reordering, setReordering] = useState(false);
  const requestInFlight = useRef(false);
  const busy = saving || deleting || reordering;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetchBanners({ placement, includeInactive: true });
      const list = Array.isArray(data?.banners) ? [...data.banners] : [];
      list.sort((left, right) => (left.display_order ?? 0) - (right.display_order ?? 0));
      setBanners(list);
    } catch (err) {
      addToast({ title: "Banners Load Failed", message: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }, [placement, addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const broadcast = () => window.dispatchEvent(new Event(CONTENT_EVENT));

  const setField = (field, value) =>
    setEditing((previous) => (previous ? { ...previous, [field]: value } : previous));

  const switchPlacement = (value) => {
    setEditing(null);
    setFormError("");
    setPlacement(value);
  };

  const openCreate = () => {
    setFormError("");
    setEditing(newForm(placement, banners.length));
  };

  const openEdit = (row) => {
    setFormError("");
    setEditing(editForm(row));
  };

  const setGalleryItem = (index, url) =>
    setEditing((previous) => {
      if (!previous) return previous;
      const gallery = [...(previous.gallery ?? [])];
      gallery[index] = url ?? "";
      return { ...previous, gallery };
    });

  const addGalleryImage = () => setField("gallery", [...(editing?.gallery ?? []), ""]);

  const removeGalleryImage = (index) =>
    setEditing((previous) =>
      previous
        ? { ...previous, gallery: previous.gallery.filter((_url, at) => at !== index) }
        : previous
    );

  const toggleActive = async (row, active) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    try {
      await apiUpdateBanner(row.id, { id: row.id, is_active: active });
      addToast({
        title: active ? "Banner Activated" : "Banner Hidden",
        message: `'${row.title}' updated.`,
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

  const handleDelete = async () => {
    if (!deleteTarget || requestInFlight.current) return;
    const target = deleteTarget;
    requestInFlight.current = true;
    setDeleting(true);
    try {
      await apiDeleteBanner(target.id);
      setDeleteTarget(null);
      addToast({ title: "Banner Deleted", message: `Removed '${target.title}'.`, type: "info" });
      broadcast();
      await load();
    } catch (err) {
      addToast({ title: "Delete Failed", message: err.message, type: "error" });
    } finally {
      requestInFlight.current = false;
      setDeleting(false);
    }
  };

  /** One placement's complete list, renumbered 0..n-1 in array order. */
  const handleMove = async (row, from, to) => {
    if (requestInFlight.current) return;
    if (from === to || from < 0 || to < 0 || from >= banners.length || to >= banners.length) return;

    const reordered = [...banners];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    // The API rejects a partial scope, so every banner of the placement is sent.
    const orders = reordered.map((banner, index) => ({ id: banner.id, display_order: index }));

    requestInFlight.current = true;
    setReordering(true);
    try {
      await apiReorderBanners(orders);
      addToast({ title: "Banners Reordered", message: `'${row.title}' moved.`, type: "success" });
      broadcast();
      await load();
    } catch (err) {
      addToast({ title: "Reorder Failed", message: err.message, type: "error" });
    } finally {
      requestInFlight.current = false;
      setReordering(false);
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
        setFormError("Banner title is required.");
        addToast({
          title: "Missing Information",
          message: "Banner title is required.",
          type: "error",
        });
        return;
      }

      // Diff against the row captured when the edit opened, not the current
      // list: changing the placement tab refetches the list, so the edited row
      // is no longer in it and a list lookup would create a duplicate instead
      // of moving it (§3.4 allows a banner to move between placements).
      const stored = editing.original ?? null;
      if (stored) {
        const patch = changedFields(stored, payload);
        const changed = Object.keys(patch).filter((key) => key !== "id");
        if (changed.length === 0) {
          // A no-op save is not a write: no toast claim, no refresh event.
          setEditing(null);
          addToast({
            title: "No Changes",
            message: `'${payload.title}' was not modified.`,
            type: "info",
          });
          return;
        }

        await apiUpdateBanner(stored.id, patch);
        // A moved row must not leave two banners sharing a display_order.
        if (patch.display_order !== undefined || patch.placement !== undefined) {
          await renumberPlacement(stored.id, payload.placement, payload.display_order);
        }
      } else {
        const saved = await apiSaveBanner(payload);
        const createdId = saved?.banner?.id ?? saved?.id ?? null;
        // The new banner joins the placement's ordered list: renumber the
        // whole group so no two banners share a display_order.
        if (createdId) {
          await renumberPlacement(createdId, payload.placement, payload.display_order);
        }
      }

      setEditing(null);
      addToast({
        title: stored ? "Banner Updated" : "Banner Saved",
        message: `'${payload.title}' saved.`,
        type: "success",
      });
      broadcast();
      await load();
    } catch (err) {
      // Keep the form open: the admin's input must survive a failed write.
      const message = err?.message || "Could not save the banner.";
      setFormError(message);
      addToast({ title: "Save Failed", message, type: "error" });
    } finally {
      requestInFlight.current = false;
      setSaving(false);
    }
  };

  const isCarousel = editing?.placement === "home_promo_carousel";
  const isStrip = editing?.placement === "promo_strip";
  // The edited row belongs to the visible list unless the placement changed
  // (the tab refetched another placement), in which case it is an extra slot.
  const rowIsListed = Boolean(editing?.original) && banners.some((row) => row.id === editing?.id);
  const formTotal = banners.length + (rowIsListed ? 0 : 1);
  const formPosition = Math.max(
    0,
    Math.min(Number(editing?.displayOrder ?? 0) || 0, Math.max(formTotal - 1, 0))
  );

  return (
    <div className="dashboard-tab-view banners-editor animate-fade-in">
      <div className="chart-card-header banners-editor-header">
        <div>
          <h3 className="chart-title">Banners &amp; Promo Surfaces</h3>
          <p className="chart-subtitle">
            Home layout, promo carousel and promo strip — add, reorder, edit, or hide
          </p>
        </div>
        <Button onClick={openCreate} className="quick-add-user-btn banners-add-btn">
          <Plus size={16} />
          <span>Add Banner</span>
        </Button>
      </div>

      <div role="tablist" aria-label="Banner placement" className="banners-placement-tabs">
        {PLACEMENTS.map((option) => (
          <Button
            key={option.value}
            type="button"
            role="tab"
            size="sm"
            variant={placement === option.value ? "primary" : "outline"}
            aria-selected={placement === option.value}
            onClick={() => switchPlacement(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="chart-subtitle">Loading banners...</p>
      ) : banners.length === 0 ? (
        <p className="chart-subtitle">No banners for this placement yet. Add the first one.</p>
      ) : (
        <div className="table-responsive-wrapper banners-table-wrapper">
          <table className="editor-table admin-data-table banners-table">
            <thead>
              <tr>
                {COLUMNS[placement].map((column) => (
                  <th key={column}>{column.replaceAll("_", " ")}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {banners.map((row, index) => (
                <tr key={row.id} data-testid={`editor-row-${row.id}`} className="banners-table-row">
                  {COLUMNS[placement].map((column) => (
                    <td
                      key={column}
                      data-label={column.replaceAll("_", " ")}
                      className="banners-table-cell"
                    >
                      {cellValue(row[column])}
                    </td>
                  ))}
                  <td data-label="Actions" className="banners-table-cell banners-actions-cell">
                    <div className="banners-actions-wrapper">
                      <OrderControls
                        index={index}
                        total={banners.length}
                        label={row.title}
                        disabled={busy}
                        onMove={(from, to) => handleMove(row, from, to)}
                      />
                      <ActiveToggle
                        active={row.is_active !== false}
                        label={row.title}
                        onChange={(active) => toggleActive(row, active)}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-label={`Edit ${row.title}`}
                        disabled={busy}
                        onClick={() => openEdit(row)}
                      >
                        <Edit2 size={14} />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={`Delete ${row.title}`}
                        disabled={busy}
                        onClick={() => setDeleteTarget(row)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="modal-backdrop-overlay banners-modal-overlay">
          <div
            className="modal-content-container banners-modal-container animate-scale-up"
            role="dialog"
            aria-modal="true"
            aria-label="Banner editor"
          >
            <div className="modal-header banners-modal-header">
              <div>
                <h3 className="modal-title">{editing.id ? "Edit Banner" : "Add Banner"}</h3>
                <p className="modal-subtitle">Fields save to the banners API</p>
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

            <form onSubmit={handleSave} className="modal-form banners-modal-form">
              <div className="form-group">
                <label className="form-label" htmlFor="banner-placement">
                  Placement
                </label>
                <select
                  id="banner-placement"
                  className="form-select-field"
                  value={editing.placement}
                  onChange={(event) => {
                    setField("placement", event.target.value);
                    setPlacement(event.target.value);
                  }}
                >
                  {PLACEMENTS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {!isCarousel && !isStrip && (
                <>
                  {textField({
                    id: "banner-title",
                    label: "Title *",
                    value: editing.title,
                    onChange: (value) => setField("title", value),
                  })}
                  {textField({
                    id: "banner-subtitle",
                    label: "Subtitle",
                    value: editing.subtitle,
                    onChange: (value) => setField("subtitle", value),
                  })}
                  {textField({
                    id: "banner-cta-text",
                    label: "CTA text",
                    value: editing.ctaText,
                    onChange: (value) => setField("ctaText", value),
                  })}
                  {textField({
                    id: "banner-cta-path",
                    label: "CTA path",
                    value: editing.ctaPath,
                    onChange: (value) => setField("ctaPath", value),
                  })}
                  <ImageField
                    label="Banner image"
                    value={editing.imageUrl}
                    onChange={(url) => setField("imageUrl", url)}
                  />
                  <div className="form-group">
                    <label className="form-label" htmlFor="banner-variant">
                      Variant
                    </label>
                    <select
                      id="banner-variant"
                      className="form-select-field"
                      value={editing.variant}
                      onChange={(event) => setField("variant", event.target.value)}
                    >
                      <option value="large">Large</option>
                      <option value="small">Small</option>
                    </select>
                  </div>
                  <output
                    className="form-hint"
                    data-testid="banner-preview"
                    data-variant={editing.variant === "large" ? "large" : "small"}
                    style={{ display: "block" }}
                  >
                    {editing.variant === "large"
                      ? "Renders in the large slot."
                      : "Renders in a small slot — any variant other than large does."}
                  </output>
                </>
              )}

              {isCarousel && (
                <>
                  {textField({
                    id: "banner-badge",
                    label: "Badge",
                    value: editing.badge,
                    onChange: (value) => setField("badge", value),
                  })}
                  {textField({
                    id: "banner-title",
                    label: "Title *",
                    value: editing.title,
                    onChange: (value) => setField("title", value),
                  })}
                  {textField({
                    id: "banner-highlight",
                    label: "Highlight",
                    value: editing.highlight,
                    onChange: (value) => setField("highlight", value),
                  })}
                  <div className="form-group">
                    <label className="form-label" htmlFor="banner-description">
                      Description
                    </label>
                    <textarea
                      id="banner-description"
                      className="ui-input"
                      rows={3}
                      value={editing.description}
                      onChange={(event) => setField("description", event.target.value)}
                    />
                  </div>
                  {textField({
                    id: "banner-cta-text",
                    label: "CTA text",
                    value: editing.ctaText,
                    onChange: (value) => setField("ctaText", value),
                  })}
                  {textField({
                    id: "banner-cta-path",
                    label: "CTA path",
                    value: editing.ctaPath,
                    onChange: (value) => setField("ctaPath", value),
                  })}
                  <div className="form-group">
                    <span className="form-label">Gallery</span>
                    {(editing.gallery ?? []).map((url, index) => (
                      <div key={`gallery-${index}`} className="banners-gallery-item">
                        <ImageField
                          label={`Gallery image ${index + 1}`}
                          value={url}
                          onChange={(next) => setGalleryItem(index, next)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove gallery image ${index + 1}`}
                          onClick={() => removeGalleryImage(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={addGalleryImage}>
                      Add gallery image
                    </Button>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="banner-ends-at">
                      Ends at
                    </label>
                    <Input
                      id="banner-ends-at"
                      type="datetime-local"
                      value={editing.endsAt}
                      onChange={(event) => setField("endsAt", event.target.value)}
                    />
                  </div>
                </>
              )}

              {isStrip && (
                <>
                  {textField({
                    id: "banner-title",
                    label: "Title *",
                    value: editing.title,
                    onChange: (value) => setField("title", value),
                  })}
                  {textField({
                    id: "banner-subtitle",
                    label: "Subtitle",
                    value: editing.subtitle,
                    onChange: (value) => setField("subtitle", value),
                  })}
                  {textField({
                    id: "banner-emoji",
                    label: "Emoji",
                    value: editing.emoji,
                    onChange: (value) => setField("emoji", value),
                  })}
                  {textField({
                    id: "banner-code",
                    label: "Code",
                    value: editing.code,
                    onChange: (value) => setField("code", value),
                  })}
                  {textField({
                    id: "banner-accent",
                    label: "Accent",
                    value: editing.accent,
                    onChange: (value) => setField("accent", value),
                  })}
                  {textField({
                    id: "banner-bg-color",
                    label: "Background color",
                    value: editing.bgColor,
                    onChange: (value) => setField("bgColor", value),
                  })}
                  {textField({
                    id: "banner-cta-text",
                    label: "CTA text",
                    value: editing.ctaText,
                    onChange: (value) => setField("ctaText", value),
                  })}
                  {textField({
                    id: "banner-cta-path",
                    label: "CTA path",
                    value: editing.ctaPath,
                    onChange: (value) => setField("ctaPath", value),
                  })}
                </>
              )}

              <div className="form-group-row">
                <div className="form-group">
                  <span className="form-label">Display order</span>
                  <div className="banners-order-wrapper">
                    <OrderControls
                      index={formPosition}
                      total={formTotal}
                      label="this banner"
                      onMove={(_from, to) => setField("displayOrder", to)}
                    />
                    <span className="text-sm text-muted">
                      Position {formPosition + 1} of {formTotal}
                    </span>
                  </div>
                </div>
                <div className="form-group">
                  <span className="form-label">Active</span>
                  <ActiveToggle
                    active={editing.isActive}
                    label={editing.title || "this banner"}
                    onChange={(active) => setField("isActive", active)}
                  />
                </div>
              </div>

              {formError && (
                <p role="alert" className="form-error">
                  {formError}
                </p>
              )}

              <div className="modal-actions-footer banners-modal-footer">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="submit-primary-btn">
                  {saving ? "Saving..." : "Save Banner"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this banner?"
        message={
          deleteTarget
            ? `'${deleteTarget.title}' will be removed from this placement. This cannot be undone.`
            : ""
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        destructive
        pending={deleting}
        confirmLabel="Delete Banner"
      />
    </div>
  );
}
