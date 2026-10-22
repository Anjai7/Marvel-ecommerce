import { useCallback, useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useToast,
} from "../ui";
import { apiFetchCategoryPage, apiSavePage, normalisePagePayload } from "../../api/pagesApi";
import PageEditor from "./PageEditor";

const CONTENT_EVENT = "marvel_content_updated";

/**
 * The page panel of one category.
 *
 * A category page is **optional**: a category without a custom page is served
 * by the built-in default category template, which reads the category's own
 * name, description and listing settings. The panel says so plainly, so an
 * admin is never told that a category needs a page before it can be used.
 *
 * The panel owns two states and one write:
 *
 *   1. **No page** — the panel offers "Create page", which creates a draft
 *      bound to the category and opens the page editor for it.
 *   2. **A page** — the panel opens the page editor for that page.
 *
 * The page id is read from the API rather than from the category row: the
 * binding lives on the page (`pages.category_id`), not on the category, so the
 * tree cannot carry it.
 */
export default function CategoryPagePanel({ category, onClose }) {
  const { addToast } = useToast();
  const [page, setPage] = useState(null);
  const [editingPageId, setEditingPageId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  // Synchronous guard: a state update is too late to stop a double-click that
  // lands in the same tick, so the write checks this ref first.
  const requestInFlight = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      // The preview flag is what makes a draft visible to an admin: a
      // category's page is a draft until it is published, so without it the
      // panel would never see the page it is here to edit.
      const payload = await apiFetchCategoryPage(category.id, { preview: true });
      const { page: row } = normalisePagePayload(payload);
      setPage(row);
    } catch (error) {
      setLoadError(error?.message || "Could not load the category page.");
    } finally {
      setLoading(false);
    }
  }, [category.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setCreating(true);
    setCreateError("");
    try {
      const result = await apiSavePage({
        title: category.name,
        slug: category.slug,
        kind: "category",
        template: "category",
        category_id: category.id,
        status: "draft",
      });
      // The create route answers `{ message, page }`; a bare row is accepted
      // too, so the panel never loses the page it just created.
      const created = result?.page ?? result ?? null;
      if (!created?.id) throw new Error("The page was created but its id could not be read.");
      setPage(created);
      setEditingPageId(created.id);
      addToast({
        title: "Page Created",
        message: `'${category.name}' now has a custom page.`,
        type: "success",
      });
      window.dispatchEvent(new Event(CONTENT_EVENT));
    } catch (error) {
      const message = error?.message || "Could not create the page.";
      setCreateError(message);
      addToast({ title: "Page Not Created", message, type: "error" });
    } finally {
      requestInFlight.current = false;
      setCreating(false);
    }
  };

  /** Leaving the page editor returns to the panel, with a fresh read. */
  const handleEditorClose = () => {
    setEditingPageId(null);
    load();
  };

  if (!category) return null;

  const name = category.name || "this category";

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose?.();
      }}
    >
      <DialogContent style={{ maxWidth: 760 }}>
        {editingPageId ? (
          <>
            <DialogHeader>
              <DialogTitle>Page for {name}</DialogTitle>
              <DialogDescription>
                The page&apos;s own sections sit on top of the category. Publishing it replaces the
                default category template.
              </DialogDescription>
            </DialogHeader>
            <PageEditor pageId={editingPageId} onClose={handleEditorClose} />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Category page</DialogTitle>
              <DialogDescription>
                A custom page is optional. {name} works without one.
              </DialogDescription>
            </DialogHeader>

            <p className="chart-subtitle" style={{ marginTop: 0 }}>
              A category does <strong>not</strong> need a custom page. Without one the built-in
              default category template is used: the category&apos;s own name, description and
              listing settings. A custom page only adds sections on top of that — a hero, a rich
              text block, a product grid — so creating one is never a step between an admin and a
              working category.
            </p>

            {loading ? (
              <p className="chart-subtitle">Loading the category page...</p>
            ) : loadError ? (
              <>
                <p role="alert" className="form-error">
                  {loadError}
                </p>
                <p className="chart-subtitle">
                  The page could not be read. The category itself is unaffected and still uses the
                  built-in default category template.
                </p>
                <Button type="button" variant="outline" onClick={load}>
                  Try again
                </Button>
              </>
            ) : page ? (
              <>
                <p className="chart-subtitle" style={{ marginTop: 0 }}>
                  <strong>This category has a custom page.</strong> {page.title}
                  {page.slug ? ` — ${page.slug}` : ""}
                </p>
                <Button type="button" onClick={() => setEditingPageId(page.id)}>
                  <FileText size={15} />
                  <span>Open page editor</span>
                </Button>
              </>
            ) : (
              <>
                <p className="chart-subtitle" style={{ marginTop: 0 }}>
                  <strong>This category has no custom page.</strong> The built-in default category
                  template is serving it.
                </p>
                {createError && (
                  <p role="alert" className="form-error">
                    {createError}
                  </p>
                )}
                <Button type="button" disabled={creating} onClick={handleCreate}>
                  <FileText size={15} />
                  <span>Create page</span>
                </Button>
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onClose?.()}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
