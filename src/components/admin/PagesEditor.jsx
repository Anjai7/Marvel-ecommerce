import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  useToast,
} from "../ui";
import { EditorTable, slugify } from "./ContentEditorKit";
import PageEditor, { pageStatusLabel, pageUrl } from "./PageEditor";
import { formatAdminDate } from "./adminConstants";
import {
  apiDeletePage,
  apiFetchPages,
  apiPublishPage,
  apiSavePage,
  apiUnpublishPage,
} from "../../api/pagesApi";
import { PAGE_KINDS, PAGE_TEMPLATES } from "../../../server/lib/pageRules.js";

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
  return { title: "", slug: "", slugTouched: false, kind: "", template: "" };
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
   * published page, and `is_active` says whether the page is live — the
   * house table toggles it to publish and unpublish.
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
      setCreateOpen(false);
      setDraft(emptyDraft());
      addToast({
        title: "Page Created",
        message: `'${payload.title || payload.slug}' created as a draft.`,
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

  const handleDelete = async (row) => {
    if (requestInFlight.current) return;

    requestInFlight.current = true;
    try {
      await apiDeletePage(row.id);
      addToast({
        title: "Page Deleted",
        message: `Removed '${row.title ?? row.slug}'.`,
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
    }
  };

  /**
   * The visibility toggle of the table.
   *
   * A live page is unpublishable and a draft is publishable — the toggle
   * follows the editorial lifecycle. The stored schedule travels with the
   * publish, so a toggle never silently cancels a schedule.
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
          <p style={{ margin: "0 0 8px" }}>{loadError}</p>
          <Button type="button" variant="outline" size="sm" onClick={load}>
            Try again
          </Button>
        </div>
      )}

      {loading ? (
        <p className="chart-subtitle">Loading pages...</p>
      ) : loadError ? null : rows.length === 0 ? (
        <p className="chart-subtitle">No pages yet. Create the first one.</p>
      ) : (
        <EditorTable
          columns={["title", "slug", "status", "template", "updated_at", "url"]}
          rows={rows}
          rowLabel={(row) => row?.title ?? row?.slug ?? row?.id}
          onEdit={(row) => setEditing({ pageId: row.id })}
          onDelete={handleDelete}
          onToggleActive={handleToggleActive}
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New page</DialogTitle>
            <DialogDescription>
              The page is created as a draft — it stays invisible until it is published.
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: "grid", gap: 16 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="new-page-title">
                Title *
              </label>
              <Input
                id="new-page-title"
                type="text"
                value={draft.title}
                onChange={(event) => handleTitleChange(event.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="new-page-slug">
                Slug *
              </label>
              <Input
                id="new-page-slug"
                type="text"
                value={draft.slug}
                onChange={(event) => handleSlugChange(event.target.value)}
              />
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreate} disabled={creating}>
              {creating ? "Creating..." : "Create page"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
