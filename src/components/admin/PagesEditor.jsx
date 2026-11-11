import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Edit2, Plus, Trash2 } from "lucide-react";
import {
  Button,
  Input,
  RequiredMark,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from "../ui";
import { slugify } from "./ContentEditorKit";
import PageEditor, { pageUrl } from "./PageEditor";
import { pageStatusLabel } from "./pageStatus";
import AdminConfirmStrip from "./AdminConfirmStrip";
import AdminInlinePanel from "./AdminInlinePanel";
import { formatAdminDate } from "./adminConstants";
import {
  apiDeletePage,
  apiFetchPages,
  apiPublishPage,
  apiSavePage,
  apiSavePageSections,
  apiUnpublishPage,
} from "../../api/pagesApi";
import { PAGE_KINDS, PAGE_TEMPLATES } from "../../../server/lib/pageRules.js";
import { PAGE_STARTER_PRESETS } from "./pageTemplates.js";
import "./admin-panels.css";

/**
 * The pages screen: the list of CMS pages and the editor behind it.
 *
 * The list is the admin's map of the site — every page, its address, its
 * derived status and when it was last touched. The editor takes over the
 * screen when a page is opened, so the two never fight over the space.
 *
 * A new page is created as a **draft**: the API defaults to a draft, but the
 * status is sent explicitly so the intent is on the wire.
 */

const CONTENT_EVENT = "marvel_content_updated";

/** The empty form of the new-page dialog. */
function emptyDraft() {
  return {
    title: "",
    slug: "",
    slugTouched: false,
    kind: "landing",
    template: "landing",
    presetId: "landing",
  };
}

export default function PagesEditor() {
  const { addToast } = useToast();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const requestInFlight = useRef(false);

  const broadcast = () => window.dispatchEvent(new Event(CONTENT_EVENT));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetchPages({ includeInactive: true });
      setPages(Array.isArray(data?.pages) ? data.pages : []);
      setLoadError("");
    } catch (error) {
      setLoadError(error?.message || "Could not load the pages.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * The rows of the table.
   *
   * The status is the derived label, the address is the public URL of a
   * published page, and `is_active` says whether the page is live.
   */
  const rows = useMemo(
    () =>
      pages.map((page) => ({
        ...page,
        status: pageStatusLabel(page),
        updated_at: formatAdminDate(page.updated_at),
        url: page.status === "published" ? pageUrl(page.slug) : "",
        is_active: page.status === "published",
      })),
    [pages]
  );

  const openCreate = () => {
    setCreateError("");
    setDraft(emptyDraft());
    setCreateOpen(true);
  };

  const handleTitleChange = (title) =>
    setDraft((previous) => {
      const next = { ...previous, title };
      // A new page follows its title until the admin types a slug of their
      // own — the house behaviour of the other editors.
      if (!previous.slugTouched) next.slug = slugify(title);
      return next;
    });

  const handleSlugChange = (slug) =>
    setDraft((previous) => ({ ...previous, slug, slugTouched: true }));

  const handleCreate = async () => {
    if (requestInFlight.current) return;

    const payload = {
      title: draft.title.trim(),
      slug: draft.slug.trim(),
      status: "draft",
    };
    if (draft.kind) payload.kind = draft.kind;
    if (draft.template) payload.template = draft.template;

    requestInFlight.current = true;
    setCreating(true);
    setCreateError("");
    try {
      const result = await apiSavePage(payload);
      const created = result?.page;

      // If a starter preset with sections was picked, populate them automatically
      const preset = PAGE_STARTER_PRESETS.find((p) => p.id === draft.presetId);
      if (created?.id && preset && preset.sections.length > 0) {
        try {
          await apiSavePageSections(
            created.id,
            preset.sections.map((sec, idx) => ({
              type: sec.type,
              enabled: true,
              data: sec.data || {},
              style: sec.style || {},
            }))
          );
        } catch (sectionErr) {
          console.warn("[cms] could not apply starter sections:", sectionErr?.message);
        }
      }

      setCreateOpen(false);
      setDraft(emptyDraft());
      addToast({
        title: "Page Created",
        message: `'${payload.title || payload.slug}' created with ${preset?.sections?.length || 0} starter sections.`,
        type: "success",
      });
      broadcast();
      if (created?.id) setEditing({ pageId: created.id });
      await load();
    } catch (error) {
      // The dialog stays open: the admin's input must survive a failed write.
      const message = error?.message || "Could not create the page.";
      setCreateError(message);
      addToast({ title: "Create Failed", message, type: "error" });
    } finally {
      requestInFlight.current = false;
      setCreating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || requestInFlight.current) return;
    const target = deleteTarget;
    requestInFlight.current = true;
    setDeleting(true);
    try {
      await apiDeletePage(target.id);
      setDeleteTarget(null);
      addToast({
        title: "Page Deleted",
        message: `Removed '${target.title ?? target.slug}'.`,
        type: "info",
      });
      broadcast();
      await load();
    } catch (error) {
      addToast({
        title: "Delete Failed",
        message: error?.message || "Could not delete the page.",
        type: "error",
      });
    } finally {
      requestInFlight.current = false;
      setDeleting(false);
    }
  };

  /**
   * The publish/unpublish action of the table.
   *
   * A live page is unpublishable and a draft is publishable. The stored
   * schedule travels with the publish, so a publish never silently cancels a
   * schedule.
   */
  const handleToggleActive = async (row, active) => {
    if (requestInFlight.current) return;

    requestInFlight.current = true;
    try {
      if (active) {
        const schedule = {};
        if (row.scheduled_at) schedule.scheduled_at = row.scheduled_at;
        if (row.expired_at) schedule.expired_at = row.expired_at;
        await apiPublishPage(row.id, schedule);
      } else {
        await apiUnpublishPage(row.id);
      }
      addToast({
        title: active ? "Page Published" : "Page Unpublished",
        message: `'${row.title ?? row.slug}' is ${active ? "live" : "a draft"} now.`,
        type: "success",
      });
      broadcast();
      await load();
    } catch (error) {
      addToast({
        title: active ? "Publish Failed" : "Unpublish Failed",
        message: error?.message || "Could not change the page.",
        type: "error",
      });
    } finally {
      requestInFlight.current = false;
    }
  };

  if (editing) {
    return (
      <PageEditor
        pageId={editing.pageId}
        onClose={() => {
          setEditing(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="dashboard-tab-view animate-fade-in">
      <div className="chart-card-header">
        <div>
          <h3 className="chart-title">Pages</h3>
          <p className="chart-subtitle">
            Campaign, policy and landing pages — drafts, scheduled pages and live pages
          </p>
        </div>
        <Button onClick={openCreate} className="quick-add-user-btn">
          <Plus size={16} />
          <span>New page</span>
        </Button>
      </div>

      {loadError && (
        <div role="alert" className="form-error">
          <p className="pages-create-error">{loadError}</p>
          <Button type="button" variant="outline" size="sm" onClick={load}>
            Try again
          </Button>
        </div>
      )}

      {createOpen && (
        <AdminInlinePanel
          title="New page"
          subtitle="The page is created as a draft — it stays invisible until it is published."
          tone="blue"
          onClose={() => setCreateOpen(false)}
          closeLabel="Close the new page form"
        >
          <div className="pages-create-form">
            <div className="form-group">
              <label className="form-label" htmlFor="new-page-title">
                Title <RequiredMark />
              </label>
              <Input
                id="new-page-title"
                type="text"
                aria-required="true"
                value={draft.title}
                onChange={(event) => handleTitleChange(event.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="new-page-slug">
                Slug <RequiredMark />
              </label>
              <Input
                id="new-page-slug"
                type="text"
                aria-required="true"
                value={draft.slug}
                onChange={(event) => handleSlugChange(event.target.value)}
              />
            </div>

            {/* Starter Presets */}
            <div className="form-group">
              <label className="form-label pages-preset-label">Choose a Starter Layout</label>
              <div className="pages-preset-grid">
                {PAGE_STARTER_PRESETS.map((preset) => {
                  const selected = draft.presetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={`admin-chip pages-preset-option${selected ? " is-selected" : ""}`}
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          presetId: preset.id,
                          kind: preset.kind || prev.kind,
                          template: preset.template || prev.template,
                        }))
                      }
                    >
                      <div className="pages-preset-head">
                        <span className="pages-preset-name">{preset.name}</span>
                        {preset.badge && <span className="pages-preset-badge">{preset.badge}</span>}
                      </div>
                      <span className="pages-preset-description">{preset.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-group-row">
              <div className="form-group">
                <label className="form-label" htmlFor="new-page-kind">
                  Kind
                </label>
                <select
                  id="new-page-kind"
                  className="form-select-field"
                  value={draft.kind}
                  onChange={(event) =>
                    setDraft((previous) => ({ ...previous, kind: event.target.value }))
                  }
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
                <label className="form-label" htmlFor="new-page-template">
                  Template
                </label>
                <select
                  id="new-page-template"
                  className="form-select-field"
                  value={draft.template}
                  onChange={(event) =>
                    setDraft((previous) => ({ ...previous, template: event.target.value }))
                  }
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

            {createError && (
              <p role="alert" className="form-error">
                {createError}
              </p>
            )}
          </div>

          <div className="admin-inline-actions">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreate} disabled={creating}>
              {creating ? "Creating..." : "Create page"}
            </Button>
          </div>
        </AdminInlinePanel>
      )}

      {loading ? (
        <p className="chart-subtitle">Loading pages...</p>
      ) : loadError ? null : rows.length === 0 ? (
        <p className="chart-subtitle">No pages yet. Create the first one.</p>
      ) : (
        <div className="table-responsive-wrapper">
          <Table className="ui-table--cards">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Title</TableHead>
                <TableHead scope="col">Slug</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col">Template</TableHead>
                <TableHead scope="col">Updated At</TableHead>
                <TableHead scope="col">URL</TableHead>
                <TableHead scope="col">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} data-testid={`editor-row-${row.id}`}>
                  <TableCell>{row.title}</TableCell>
                  <TableCell data-label="Slug">{row.slug}</TableCell>
                  <TableCell data-label="Status">{row.status}</TableCell>
                  <TableCell data-label="Template">{row.template || "—"}</TableCell>
                  <TableCell data-label="Updated At">{row.updated_at}</TableCell>
                  <TableCell data-label="URL">
                    {row.url ? <a href={row.url}>{row.url}</a> : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="admin-row-actions admin-row-actions--wide">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${row.title ?? row.slug}`}
                        onClick={() => setEditing({ pageId: row.id })}
                      >
                        <Edit2 size={15} />
                      </Button>
                      {row.status === "Published" || row.status === "Scheduled" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`Unpublish ${row.title ?? row.slug}`}
                          onClick={() => handleToggleActive(row, false)}
                        >
                          Unpublish
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`Publish ${row.title ?? row.slug}`}
                          onClick={() => handleToggleActive(row, true)}
                        >
                          Publish
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${row.title ?? row.slug}`}
                        onClick={() => setDeleteTarget(row)}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AdminConfirmStrip
        open={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.title ?? deleteTarget?.slug ?? "this page"}?`}
        message="This will permanently delete this page and all its sections. This cannot be undone."
        destructive
        pending={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
