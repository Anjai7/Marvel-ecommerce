import { useEffect, useRef, useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { Badge, Button, Input, useToast } from "../ui";
import { slugify } from "./ContentEditorKit";
import SectionListEditor from "./SectionListEditor";
import ConfirmDialog from "./ConfirmDialog";
import {
  apiDeletePage,
  apiFetchPage,
  apiPublishPage,
  apiSavePageSections,
  apiUnpublishPage,
  apiUpdatePage,
} from "../../api/pagesApi";
import { PAGE_KINDS, PAGE_TEMPLATES } from "../../../server/lib/pageRules.js";
import { validateSection } from "../../../server/lib/sectionTypes.js";

/**
 * The editor of one CMS page.
 *
 * Two contracts matter more than the layout:
 *
 *   1. **The status label is derived, never stored.** The API has no
 *      `scheduled` status value: a publish always writes `published`, and a
 *      future `scheduled_at` is what holds the page back. The label therefore
 *      comes from the timestamps, so the screen can never disagree with the
 *      visibility rule the API applies.
 *   2. **The sections are one write.** Adding, editing, reordering,
 *      duplicating, hiding and removing a section all change the same
 *      ordered list, and that list is sent in a single call.
 */

const CONTENT_EVENT = "marvel_content_updated";

/**
 * The status label of a page, derived from its own timestamps.
 *
 * `draft` → Draft; published with a future `scheduled_at` → Scheduled;
 * published with a past `expired_at` → Expired; otherwise → Published.
 */
export function pageStatusLabel(page, now = new Date()) {
  const status = typeof page?.status === "string" ? page.status : "";
  if (status === "draft") return "Draft";

  if (status === "published") {
    const at = now.getTime();
    const scheduled = Date.parse(page?.scheduled_at ?? "");
    if (!Number.isNaN(scheduled) && scheduled > at) return "Scheduled";
    const expired = Date.parse(page?.expired_at ?? "");
    if (!Number.isNaN(expired) && expired <= at) return "Expired";
  }

  return "Published";
}

/** The public address of a page. */
export const pageUrl = (slug) => `#/pages/${slug ?? ""}`;

/** The preview address of a page — the draft, revealed to an admin. */
const pagePreviewUrl = (slug) => `#/pages/${slug ?? ""}?preview=1`;

/** An ISO timestamp, or null for anything that is not a date. */
function toIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** An ISO timestamp as the text a `datetime-local` input carries. */
function toLocalInput(value) {
  const iso = toIso(value);
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

/** The SEO block without its blank keys, so two blocks compare honestly. */
function normaliseSeo(seo) {
  const clean = {};
  if (!seo || typeof seo !== "object") return clean;
  for (const [key, value] of Object.entries(seo)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    clean[key] = value;
  }
  return clean;
}

/** True when two SEO blocks hold the same keys and the same values. */
function sameSeo(left, right) {
  const a = normaliseSeo(left);
  const b = normaliseSeo(right);
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key, index) => bKeys[index] === key && a[key] === b[key]);
}

/** The editable form of a stored page. */
function formFromPage(page) {
  const seo = page?.seo && typeof page.seo === "object" ? page.seo : {};
  return {
    title: page?.title ?? "",
    slug: page?.slug ?? "",
    originalSlug: page?.slug ?? "",
    description: page?.description ?? "",
    kind: page?.kind ?? "",
    template: page?.template ?? "",
    seoBase: { ...seo },
    seoTitle: seo.title ?? "",
    seoDescription: seo.description ?? "",
    seoCanonical: seo.canonical ?? "",
    scheduledAt: toLocalInput(page?.scheduled_at),
    expiredAt: toLocalInput(page?.expired_at),
  };
}

/** The single source of truth for what a save writes: every owned field. */
function toPayload(form) {
  const seo = {
    ...normaliseSeo(form.seoBase),
    title: (form.seoTitle ?? "").trim(),
    description: (form.seoDescription ?? "").trim(),
    canonical: (form.seoCanonical ?? "").trim(),
  };
  for (const key of Object.keys(seo)) {
    if (seo[key] === "") delete seo[key];
  }

  return {
    title: (form.title ?? "").trim(),
    slug: (form.slug ?? "").trim(),
    description: (form.description ?? "").trim(),
    kind: form.kind || null,
    template: form.template || null,
    seo,
    scheduled_at: toIso(form.scheduledAt),
    expired_at: toIso(form.expiredAt),
  };
}

/** The stored value of a payload field, normalised the way a save is. */
function storedValue(page, key) {
  switch (key) {
    case "title":
      return page?.title ?? "";
    case "slug":
      return page?.slug ?? "";
    case "description":
      return page?.description ?? "";
    case "kind":
      return page?.kind ?? null;
    case "template":
      return page?.template ?? null;
    case "scheduled_at":
      return toIso(page?.scheduled_at);
    case "expired_at":
      return toIso(page?.expired_at);
    default:
      return page?.[key] ?? null;
  }
}

/** PATCH body: only the fields the admin actually changed. */
function changedFields(page, payload) {
  const patch = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key === "seo") {
      if (!sameSeo(page?.seo, value)) patch.seo = value;
      continue;
    }
    if (storedValue(page, key) !== value) patch[key] = value;
  }
  return patch;
}

/** The working copy of the stored sections. */
function toWorkingSections(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list.map((row, index) => ({
    uid: typeof row?.id === "string" && row.id ? row.id : `section-row-${index}`,
    id: typeof row?.id === "string" && row.id ? row.id : null,
    type: typeof row?.type === "string" ? row.type : "",
    enabled: row?.enabled !== false,
    data: row?.data && typeof row.data === "object" ? { ...row.data } : {},
    style: row?.style && typeof row.style === "object" ? { ...row.style } : {},
  }));
}

/**
 * The body of the one section write.
 *
 * A section with an id is an update, a section without one is an insert, and
 * a section left out of the list is deleted. The array order is the new
 * order — the server renumbers the positions itself.
 */
function sectionsPayload(sections) {
  return sections.map((section) => ({
    id: section.id ?? null,
    type: section.type,
    enabled: section.enabled !== false,
    data: section.data ?? {},
    style: section.style ?? {},
  }));
}

/** The problems of a whole section list, in the order the server reports. */
function sectionErrors(sections) {
  const errors = [];
  for (const section of sections) {
    const result = validateSection({
      type: section.type,
      data: section.data,
      style: section.style,
    });
    if (!result.ok) errors.push(...result.errors);
  }
  return errors;
}

export default function PageEditor({ pageId, onClose }) {
  const { addToast } = useToast();
  const [page, setPage] = useState(null);
  const [form, setForm] = useState(null);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [sectionError, setSectionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Synchronous guard: a state update is too late to stop a double-click that
  // lands in the same tick, so every write checks this ref first.
  const requestInFlight = useRef(false);

  const broadcast = () => window.dispatchEvent(new Event(CONTENT_EVENT));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");

    apiFetchPage(pageId)
      .then((payload) => {
        if (cancelled) return;
        const row = payload?.page ?? null;
        const rows = Array.isArray(payload?.sections) ? payload.sections : [];
        setPage(row);
        setForm(formFromPage(row));
        setSections(toWorkingSections(rows));
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error?.message || "Could not load the page.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pageId]);

  const setField = (field, value) =>
    setForm((previous) => (previous ? { ...previous, [field]: value } : previous));

  /** Keep the stored page and the form in step after a write. */
  const applyPage = (row) => {
    if (!row) return;
    setPage(row);
    setForm(formFromPage(row));
  };

  /** The metadata write: only the fields that changed. */
  const saveMetadata = async () => {
    const payload = toPayload(form);
    if (!payload.title) throw new Error("Page title is required.");
    if (!payload.slug) throw new Error("Page slug is required.");

    const patch = changedFields(page, payload);
    if (Object.keys(patch).length === 0) return payload;

    const result = await apiUpdatePage(pageId, patch);
    applyPage(result?.page);
    return payload;
  };

  /** The one section write: the whole ordered list. */
  const saveSections = async () => {
    const errors = sectionErrors(sections);
    if (errors.length > 0) throw new Error(errors[0]);

    const result = await apiSavePageSections(pageId, sectionsPayload(sections));
    // The answer carries the stored sections, ids included: a section that
    // was inserted must not be inserted again by the next save.
    if (Array.isArray(result?.sections)) setSections(toWorkingSections(result.sections));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!page || !form || requestInFlight.current) return;

    requestInFlight.current = true;
    setBusy(true);
    setFormError("");
    setSectionError("");
    try {
      // The sections are checked before anything is written, so a rejected
      // section cannot leave the page half-saved.
      const errors = sectionErrors(sections);
      if (errors.length > 0) {
        setSectionError(errors[0]);
        addToast({ title: "Save Failed", message: errors[0], type: "error" });
        return;
      }

      const payload = await saveMetadata();

      // The section list travels with the page: saving the metadata must
      // never throw away a section the admin just arranged.
      try {
        await saveSections();
      } catch (error) {
        const message = error?.message || "Could not save the sections.";
        setSectionError(message);
        addToast({ title: "Sections Not Saved", message, type: "error" });
        return;
      }

      addToast({
        title: "Page Saved",
        message: `'${payload.title}' saved.`,
        type: "success",
      });
      broadcast();
    } catch (error) {
      const message = error?.message || "Could not save the page.";
      setFormError(message);
      addToast({ title: "Save Failed", message, type: "error" });
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  };

  const handleSaveSections = async () => {
    if (!page || requestInFlight.current) return;

    requestInFlight.current = true;
    setBusy(true);
    setSectionError("");
    try {
      await saveSections();
      addToast({
        title: "Sections Saved",
        message: `${sections.length} section${sections.length === 1 ? "" : "s"} saved.`,
        type: "success",
      });
      broadcast();
    } catch (error) {
      const message = error?.message || "Could not save the sections.";
      setSectionError(message);
      addToast({ title: "Sections Not Saved", message, type: "error" });
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  };

  const handlePublish = async () => {
    if (!page || !form || requestInFlight.current) return;

    requestInFlight.current = true;
    setBusy(true);
    setFormError("");
    setSectionError("");
    try {
      // The sections are checked before anything is written, so a rejected
      // section cannot leave a half-published page behind.
      const errors = sectionErrors(sections);
      if (errors.length > 0) {
        setSectionError(errors[0]);
        addToast({ title: "Publish Failed", message: errors[0], type: "error" });
        return;
      }

      const payload = toPayload(form);
      const patch = changedFields(page, payload);
      if (Object.keys(patch).length > 0) {
        const updated = await apiUpdatePage(pageId, patch);
        applyPage(updated?.page);
      }
      await apiSavePageSections(pageId, sectionsPayload(sections));

      // The publish route owns the lifecycle: `status` is never sent, and a
      // future `scheduled_at` is what holds the page back.
      const schedule = {};
      if (payload.scheduled_at) schedule.scheduled_at = payload.scheduled_at;
      if (payload.expired_at) schedule.expired_at = payload.expired_at;

      const result = await apiPublishPage(pageId, schedule);
      applyPage(result?.page);
      addToast({
        title: result?.scheduled ? "Page Scheduled" : "Page Published",
        message: result?.scheduled
          ? `The page goes live on ${payload.scheduled_at}.`
          : "The page is live.",
        type: "success",
      });
      broadcast();
    } catch (error) {
      const message = error?.message || "Could not publish the page.";
      setFormError(message);
      addToast({ title: "Publish Failed", message, type: "error" });
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  };

  const handleUnpublish = async () => {
    if (!page || requestInFlight.current) return;

    requestInFlight.current = true;
    setBusy(true);
    setFormError("");
    try {
      const result = await apiUnpublishPage(pageId);
      applyPage(result?.page);
      addToast({
        title: "Page Unpublished",
        message: "The page is back to a draft.",
        type: "info",
      });
      broadcast();
    } catch (error) {
      const message = error?.message || "Could not unpublish the page.";
      setFormError(message);
      addToast({ title: "Unpublish Failed", message, type: "error" });
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (requestInFlight.current) return;

    requestInFlight.current = true;
    setDeleting(true);
    try {
      await apiDeletePage(pageId);
      setDeleteOpen(false);
      addToast({
        title: "Page Deleted",
        message: "The page and its sections are gone.",
        type: "info",
      });
      broadcast();
      onClose?.();
    } catch (error) {
      const message = error?.message || "Could not delete the page.";
      setFormError(message);
      addToast({ title: "Delete Failed", message, type: "error" });
    } finally {
      requestInFlight.current = false;
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-tab-view animate-fade-in">
        <p className="chart-subtitle">Loading page...</p>
      </div>
    );
  }

  if (loadError || !page || !form) {
    return (
      <div className="dashboard-tab-view animate-fade-in">
        <p role="alert" className="form-error">
          {loadError || "This page could not be loaded."}
        </p>
        <div className="modal-actions-footer">
          <Button type="button" variant="outline" onClick={onClose}>
            Back to pages
          </Button>
        </div>
      </div>
    );
  }

  const status = pageStatusLabel(page);

  return (
    <div className="dashboard-tab-view animate-fade-in">
      <div className="chart-card-header">
        <div>
          <h3 className="chart-title">{page.title}</h3>
          <p className="chart-subtitle">
            {pageUrl(page.slug)} —{" "}
            <Badge variant={status === "Published" ? "success" : "secondary"}>{status}</Badge>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button type="button" variant="outline" onClick={onClose}>
            Back to pages
          </Button>
          {/* A link that looks like a button is a real anchor: the house button
              cannot wrap another element. */}
          <a
            className="ui-btn ui-btn-outline ui-btn-md"
            href={pagePreviewUrl(page.slug)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="ui-btn-content">
              <ExternalLink size={15} /> Preview
            </span>
          </a>
          <Button
            type="button"
            variant="danger"
            disabled={busy}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 size={15} />
            <span>Delete Page</span>
          </Button>
        </div>
      </div>

      <form onSubmit={handleSave} noValidate style={{ display: "grid", gap: 16 }}>
        <div className="form-group-row">
          <div className="form-group">
            <label className="form-label" htmlFor="page-title">
              Title *
            </label>
            <Input
              id="page-title"
              type="text"
              value={form.title}
              onChange={(event) => setField("title", event.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="page-slug">
              Slug *
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <Input
                id="page-slug"
                type="text"
                value={form.slug}
                onChange={(event) => setField("slug", event.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setField("slug", slugify(form.title))}
              >
                Regenerate from title
              </Button>
            </div>
          </div>
        </div>

        {form.slug !== form.originalSlug && (
          <p className="form-hint" style={{ margin: 0 }}>
            Changing the slug changes the page&apos;s address to {pageUrl(form.slug)}. Links to the
            old address stop resolving.
          </p>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="page-description">
            Description
          </label>
          <textarea
            id="page-description"
            className="ui-input"
            rows={3}
            value={form.description}
            onChange={(event) => setField("description", event.target.value)}
          />
        </div>

        <div className="form-group-row">
          <div className="form-group">
            <label className="form-label" htmlFor="page-kind">
              Kind
            </label>
            <select
              id="page-kind"
              className="form-select-field"
              value={form.kind}
              onChange={(event) => setField("kind", event.target.value)}
            >
              <option value="">Not set</option>
              {PAGE_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="page-template">
              Template
            </label>
            <select
              id="page-template"
              className="form-select-field"
              value={form.template}
              onChange={(event) => setField("template", event.target.value)}
            >
              <option value="">Not set</option>
              {PAGE_TEMPLATES.map((template) => (
                <option key={template} value={template}>
                  {template}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group-row">
          <div className="form-group">
            <label className="form-label" htmlFor="page-seo-title">
              SEO title
            </label>
            <Input
              id="page-seo-title"
              type="text"
              value={form.seoTitle}
              onChange={(event) => setField("seoTitle", event.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="page-seo-canonical">
              SEO canonical
            </label>
            <Input
              id="page-seo-canonical"
              type="text"
              inputMode="url"
              value={form.seoCanonical}
              onChange={(event) => setField("seoCanonical", event.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="page-seo-description">
            SEO description
          </label>
          <textarea
            id="page-seo-description"
            className="ui-input"
            rows={2}
            value={form.seoDescription}
            onChange={(event) => setField("seoDescription", event.target.value)}
          />
        </div>

        <div className="form-group-row">
          <div className="form-group">
            <label className="form-label" htmlFor="page-scheduled-at">
              Scheduled at
            </label>
            <Input
              id="page-scheduled-at"
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(event) => setField("scheduledAt", event.target.value)}
            />
            <span className="form-hint text-sm">
              A future moment holds the page back; it goes live on its own.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="page-expired-at">
              Expired at
            </label>
            <Input
              id="page-expired-at"
              type="datetime-local"
              value={form.expiredAt}
              onChange={(event) => setField("expiredAt", event.target.value)}
            />
            <span className="form-hint text-sm">A past moment hides the page again.</span>
          </div>
        </div>

        {formError && (
          <p role="alert" className="form-error">
            {formError}
          </p>
        )}

        <div className="modal-actions-footer">
          <Button type="submit" disabled={busy} className="submit-primary-btn">
            {busy ? "Saving..." : "Save"}
          </Button>
          <Button type="button" variant="primary" disabled={busy} onClick={handlePublish}>
            Publish
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={handleUnpublish}>
            Unpublish
          </Button>
        </div>
      </form>

      <div style={{ marginTop: 24, display: "grid", gap: 12 }}>
        <div className="chart-card-header">
          <div>
            <h4 className="chart-title">Sections</h4>
            <p className="chart-subtitle">
              The order of the list is the order of the page. Saving the page saves the sections
              too.
            </p>
          </div>
          <Button type="button" onClick={handleSaveSections} disabled={busy}>
            Save Sections
          </Button>
        </div>

        {sectionError && (
          <p role="alert" className="form-error">
            {sectionError}
          </p>
        )}

        <SectionListEditor sections={sections} onChange={setSections} />
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title={`Delete '${page.title}'?`}
        message="The page and every section on it are deleted with it. This cannot be undone."
        destructive
        pending={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
