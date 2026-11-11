import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  apiDeleteFooterLink,
  apiDeleteFooterSection,
  apiFetchFooter,
  apiReorderFooterLinks,
  apiReorderFooterSections,
  apiSaveFooterLink,
  apiSaveFooterSection,
  apiUpdateFooterLink,
  apiUpdateFooterSection,
} from "../../api/contentApi";
import AdminConfirmStrip from "./AdminConfirmStrip";
import AdminInlinePanel from "./AdminInlinePanel";
import { ActiveToggle, OrderControls } from "./ContentEditorKit";
import "./admin-panels.css";

const CONTENT_EVENT = "marvel_content_updated";
const SECTION_TYPES = [
  { value: "links", label: "Links" },
  { value: "tags", label: "Tags" },
];

const text = (value) => (value ?? "").trim();
const byOrder = (left, right) => (left.display_order ?? 0) - (right.display_order ?? 0);

function sortSections(sections) {
  return [...sections].sort(
    (left, right) =>
      (left.display_order ?? 0) - (right.display_order ?? 0) ||
      (left.column_index ?? 0) - (right.column_index ?? 0)
  );
}

function sortLinks(links) {
  return [...links].sort(byOrder);
}

/** Sections with their nested links; falls back to the flat list when needed. */
function normalizeFooter(data) {
  const flat = Array.isArray(data?.links) ? data.links : [];
  const sections = Array.isArray(data?.sections) ? data.sections : [];
  return sortSections(
    sections.map((section) => ({
      ...section,
      links: sortLinks(
        Array.isArray(section.links)
          ? section.links
          : flat.filter((link) => link.section_id === section.id)
      ),
    }))
  );
}

function sectionForm(section, order) {
  return section
    ? {
        id: section.id,
        heading: section.heading ?? "",
        sectionType: section.section_type ?? "links",
        columnIndex: Number(section.column_index ?? 0),
        displayOrder: Number(section.display_order ?? 0),
        isActive: section.is_active !== false,
      }
    : {
        id: null,
        heading: "",
        sectionType: "links",
        columnIndex: 0,
        displayOrder: order,
        isActive: true,
      };
}

function linkForm(link, sectionId, order) {
  return link
    ? {
        id: link.id,
        sectionId: link.section_id ?? sectionId,
        label: link.label ?? "",
        href: link.href ?? "",
        displayOrder: Number(link.display_order ?? 0),
        isActive: link.is_active !== false,
      }
    : {
        id: null,
        sectionId,
        label: "",
        href: "",
        displayOrder: order,
        isActive: true,
      };
}

/** The form-owned fields, shaped for the API. */
function toSectionPayload(form) {
  return {
    heading: text(form.heading),
    section_type: form.sectionType,
    column_index: Number(form.columnIndex ?? 0),
    display_order: Number(form.displayOrder ?? 0),
    is_active: Boolean(form.isActive),
  };
}

/** href is sent exactly as typed — hash routes are valid link values (§4.1). */
function toLinkPayload(form) {
  return {
    section_id: form.sectionId,
    label: text(form.label),
    href: text(form.href),
    display_order: Number(form.displayOrder ?? 0),
    is_active: Boolean(form.isActive),
  };
}

/**
 * The complete sibling group renumbered 0..n-1. A create reuses a
 * display_order that a delete left behind, so the group is renumbered after
 * every create instead of writing a raw position that may still be taken.
 */
function groupOrders(rows, extraId = null) {
  const ids = rows.map((row) => row.id);
  if (extraId && !ids.includes(extraId)) ids.push(extraId);
  return ids.map((id, index) => ({ id, display_order: index }));
}

function storedValue(row, key) {
  switch (key) {
    case "column_index":
    case "display_order":
      return Number(row[key] ?? 0);
    case "is_active":
      return row.is_active !== false;
    default:
      return row[key] ?? null;
  }
}

function changedFields(row, payload) {
  const patch = { id: row.id };
  for (const [key, value] of Object.entries(payload)) {
    if (storedValue(row, key) !== value) patch[key] = value;
  }
  return patch;
}

export default function FooterEditor() {
  const { addToast } = useToast();
  const [sections, setSections] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
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
      const data = await apiFetchFooter({ includeInactive: true });
      const next = normalizeFooter(data);
      setSections(next);
      setSelectedId((previous) =>
        next.some((section) => section.id === previous) ? previous : (next[0]?.id ?? null)
      );
    } catch (err) {
      addToast({ title: "Footer Load Failed", message: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const broadcast = () => window.dispatchEvent(new Event(CONTENT_EVENT));

  const selectedSection = sections.find((section) => section.id === selectedId) ?? null;
  const links = selectedSection?.links ?? [];

  const setField = (field, value) =>
    setEditing((previous) =>
      previous ? { ...previous, form: { ...previous.form, [field]: value } } : previous
    );

  const openSectionCreate = () => {
    setFormError("");
    setEditing({ kind: "section", form: sectionForm(null, sections.length) });
  };

  const openSectionEdit = (section) => {
    setFormError("");
    setEditing({ kind: "section", form: sectionForm(section, sections.length) });
  };

  const openLinkCreate = () => {
    if (!selectedSection) return;
    setFormError("");
    setEditing({
      kind: "link",
      form: linkForm(null, selectedSection.id, selectedSection.links.length),
    });
  };

  const openLinkEdit = (link) => {
    setFormError("");
    setEditing({ kind: "link", form: linkForm(link, selectedId, links.length) });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!editing || requestInFlight.current) return;

    requestInFlight.current = true;
    setSaving(true);
    setFormError("");
    try {
      if (editing.kind === "section") {
        const payload = toSectionPayload(editing.form);
        if (!payload.heading) {
          setFormError("Footer section heading is required.");
          addToast({
            title: "Missing Information",
            message: "Footer section heading is required.",
            type: "error",
          });
          return;
        }
        if (editing.form.id) {
          const stored = sections.find((section) => section.id === editing.form.id);
          await apiUpdateFooterSection(
            editing.form.id,
            stored ? changedFields(stored, payload) : { ...payload, id: editing.form.id }
          );
        } else {
          const saved = await apiSaveFooterSection(payload);
          const createdId = saved?.section?.id ?? null;
          // The new section joins the ordered column: renumber the group so
          // no two sections share a position.
          if (createdId) await apiReorderFooterSections(groupOrders(sections, createdId));
        }
      } else {
        const payload = toLinkPayload(editing.form);
        if (!payload.label) {
          setFormError("Footer link label is required.");
          addToast({
            title: "Missing Information",
            message: "Footer link label is required.",
            type: "error",
          });
          return;
        }
        if (!payload.href) {
          setFormError("Footer link href is required.");
          addToast({
            title: "Missing Information",
            message: "Footer link href is required.",
            type: "error",
          });
          return;
        }
        if (editing.form.id) {
          const stored = links.find((link) => link.id === editing.form.id);
          await apiUpdateFooterLink(
            editing.form.id,
            stored ? changedFields(stored, payload) : { ...payload, id: editing.form.id }
          );
        } else {
          const saved = await apiSaveFooterLink(payload);
          const createdId = saved?.link?.id ?? null;
          // The new link joins the section's ordered list: renumber the group
          // so no two links share a position.
          if (createdId) await apiReorderFooterLinks(groupOrders(links, createdId));
        }
      }

      const wasEdit = Boolean(editing.form.id);
      const label = editing.kind === "section" ? editing.form.heading : editing.form.label;
      setEditing(null);
      addToast({
        title: wasEdit ? "Footer Updated" : "Footer Saved",
        message: `'${label}' saved.`,
        type: "success",
      });
      broadcast();
      await load();
    } catch (err) {
      // Keep the form open: the admin's input must survive a failed write.
      const message = err?.message || "Could not save the footer content.";
      setFormError(message);
      addToast({ title: "Save Failed", message, type: "error" });
    } finally {
      requestInFlight.current = false;
      setSaving(false);
    }
  };

  const handleToggleSection = async (section, active) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    try {
      await apiUpdateFooterSection(section.id, { is_active: active });
      broadcast();
      await load();
    } catch (err) {
      addToast({ title: "Update Failed", message: err.message, type: "error" });
    } finally {
      requestInFlight.current = false;
    }
  };

  const handleToggleLink = async (link, active) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    try {
      await apiUpdateFooterLink(link.id, { is_active: active });
      broadcast();
      await load();
    } catch (err) {
      addToast({ title: "Update Failed", message: err.message, type: "error" });
    } finally {
      requestInFlight.current = false;
    }
  };

  const handleMoveSection = async (section, from, to) => {
    if (requestInFlight.current) return;
    if (from === to || from < 0 || to < 0 || from >= sections.length || to >= sections.length)
      return;

    const reordered = [...sections];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const orders = reordered.map((item, index) => ({ id: item.id, display_order: index }));

    requestInFlight.current = true;
    setReordering(true);
    try {
      await apiReorderFooterSections(orders);
      addToast({
        title: "Sections Reordered",
        message: `'${section.heading}' moved.`,
        type: "success",
      });
      broadcast();
      await load();
    } catch (err) {
      addToast({ title: "Reorder Failed", message: err.message, type: "error" });
    } finally {
      requestInFlight.current = false;
      setReordering(false);
    }
  };

  const handleMoveLink = async (link, from, to) => {
    if (requestInFlight.current) return;
    if (from === to || from < 0 || to < 0 || from >= links.length || to >= links.length) return;

    const reordered = [...links];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    // The API rejects a partial scope, so send every link of the section.
    const orders = reordered.map((item, index) => ({ id: item.id, display_order: index }));

    requestInFlight.current = true;
    setReordering(true);
    try {
      await apiReorderFooterLinks(orders);
      addToast({ title: "Links Reordered", message: `'${link.label}' moved.`, type: "success" });
      broadcast();
      await load();
    } catch (err) {
      addToast({ title: "Reorder Failed", message: err.message, type: "error" });
    } finally {
      requestInFlight.current = false;
      setReordering(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || requestInFlight.current) return;
    const target = deleteTarget;
    requestInFlight.current = true;
    setDeleting(true);
    try {
      if (target.kind === "section") {
        await apiDeleteFooterSection(target.item.id);
        addToast({
          title: "Section Deleted",
          message: `Removed '${target.item.heading}' and its links.`,
          type: "info",
        });
      } else {
        await apiDeleteFooterLink(target.item.id);
        addToast({
          title: "Link Deleted",
          message: `Removed '${target.item.label}'.`,
          type: "info",
        });
      }
      setDeleteTarget(null);
      broadcast();
      await load();
    } catch (err) {
      addToast({ title: "Delete Failed", message: err.message, type: "error" });
    } finally {
      requestInFlight.current = false;
      setDeleting(false);
    }
  };

  const isSectionForm = editing?.kind === "section";
  const form = editing?.form;
  const deleteLinks =
    deleteTarget?.kind === "section"
      ? (sections.find((section) => section.id === deleteTarget.item.id)?.links ?? []).length
      : 0;
  const deleteTitle =
    deleteTarget?.kind === "section"
      ? deleteLinks === 0
        ? `Delete '${deleteTarget.item.heading}'?`
        : `Delete '${deleteTarget.item.heading}' and its ${deleteLinks} ${
            deleteLinks === 1 ? "link" : "links"
          }?`
      : `Delete '${deleteTarget?.item?.label || "link"}'?`;

  return (
    <div className="dashboard-tab-view animate-fade-in">
      <div className="chart-card-header">
        <div>
          <h3 className="chart-title">Footer Content</h3>
          <p className="chart-subtitle">Sections and their links — reorder, edit, or add both</p>
        </div>
        <Button onClick={openSectionCreate} className="quick-add-user-btn">
          <Plus size={16} />
          <span>Add Section</span>
        </Button>
      </div>

      {editing && (
        <AdminInlinePanel
          title={
            isSectionForm
              ? form.id
                ? "Edit Footer Section"
                : "Add Footer Section"
              : form.id
                ? "Edit Footer Link"
                : "Add Footer Link"
          }
          subtitle={isSectionForm ? "A footer column or tag group" : selectedSection?.heading}
          tone="amber"
          onClose={() => setEditing(null)}
          closeLabel="Close the footer editor"
        >
          <form onSubmit={handleSave} className="admin-inline-form">
            {isSectionForm ? (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="footer-heading">
                    Heading <RequiredMark />
                  </label>
                  <Input
                    id="footer-heading"
                    type="text"
                    aria-required="true"
                    value={form.heading}
                    onChange={(event) => setField("heading", event.target.value)}
                  />
                </div>
                <div className="form-group-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="footer-section-type">
                      Section type
                    </label>
                    <select
                      id="footer-section-type"
                      className="form-select-field"
                      value={form.sectionType}
                      onChange={(event) => setField("sectionType", event.target.value)}
                    >
                      {SECTION_TYPES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="footer-column-index">
                      Column index
                    </label>
                    <Input
                      id="footer-column-index"
                      type="number"
                      value={form.columnIndex}
                      onChange={(event) => setField("columnIndex", event.target.value)}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="footer-link-label">
                    Label <RequiredMark />
                  </label>
                  <Input
                    id="footer-link-label"
                    type="text"
                    aria-required="true"
                    value={form.label}
                    onChange={(event) => setField("label", event.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="footer-link-href">
                    Href <RequiredMark />
                  </label>
                  <Input
                    id="footer-link-href"
                    type="text"
                    aria-required="true"
                    value={form.href}
                    onChange={(event) => setField("href", event.target.value)}
                  />
                  <p className="form-hint">
                    Use a route such as <code>/category/electronics</code>, or an https URL. A bare
                    path like <code>/help</code> leaves the app and will not resolve.
                  </p>
                </div>
              </>
            )}

            {/* Ordering lives in the row-level up/down controls, which
                  renumber the complete sibling group; a raw form-level
                  display_order could leave two rows sharing a position. */}
            <div className="form-group">
              <span className="form-label">Active</span>
              <ActiveToggle
                active={form.isActive}
                label={isSectionForm ? form.heading || "this section" : form.label || "this link"}
                onChange={(active) => setField("isActive", active)}
              />
            </div>

            {formError && (
              <p role="alert" className="form-error">
                {formError}
              </p>
            )}

            <div className="admin-inline-actions">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="submit-primary-btn">
                {saving ? "Saving..." : isSectionForm ? "Save Section" : "Save Link"}
              </Button>
            </div>
          </form>
        </AdminInlinePanel>
      )}

      {loading ? (
        <p className="chart-subtitle">Loading footer content...</p>
      ) : (
        <div className="footer-editor-layout">
          <div className="admin-content-card">
            <div className="admin-content-card-header">
              <div>
                <h4 className="admin-content-card-title">Sections</h4>
                <p className="admin-content-card-meta">
                  Footer column sections — click any section to view and manage its links
                </p>
              </div>
              <Button onClick={openSectionCreate} className="quick-add-user-btn">
                <Plus size={16} />
                <span>Add Section</span>
              </Button>
            </div>
            {sections.length === 0 ? (
              <div className="admin-panel-empty">
                <p className="chart-subtitle">No footer sections yet. Add the first one.</p>
              </div>
            ) : (
              <div className="table-responsive-wrapper">
                <Table className="ui-table--cards">
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Heading</TableHead>
                      <TableHead scope="col">Type</TableHead>
                      <TableHead scope="col">Column</TableHead>
                      <TableHead scope="col">Order</TableHead>
                      <TableHead scope="col">Active</TableHead>
                      <TableHead scope="col">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sections.map((section, index) => {
                      const isSelected = section.id === selectedId;
                      return (
                        <TableRow
                          key={section.id}
                          data-testid={`footer-section-${section.id}`}
                          aria-current={isSelected ? "true" : undefined}
                          data-selected={isSelected ? "true" : undefined}
                        >
                          <TableCell>
                            <button
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => setSelectedId(section.id)}
                              className={`admin-chip footer-section-select${
                                isSelected ? " is-selected" : ""
                              }`}
                            >
                              {section.heading}
                            </button>
                          </TableCell>
                          <TableCell data-label="Type">
                            <span
                              className={`footer-section-type${
                                section.section_type === "links" ? " is-links" : ""
                              }`}
                            >
                              {section.section_type}
                            </span>
                          </TableCell>
                          <TableCell data-label="Column">
                            <span className="footer-section-column">
                              Col {Number(section.column_index ?? 0) + 1}
                            </span>
                          </TableCell>
                          <TableCell data-label="Order">
                            <OrderControls
                              index={index}
                              total={sections.length}
                              label={section.heading}
                              disabled={busy}
                              onMove={(from, to) => handleMoveSection(section, from, to)}
                            />
                          </TableCell>
                          <TableCell data-label="Active">
                            <ActiveToggle
                              active={section.is_active !== false}
                              label={section.heading}
                              onChange={(active) => handleToggleSection(section, active)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="admin-row-actions">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Edit section ${section.heading}`}
                                onClick={() => openSectionEdit(section)}
                              >
                                <Edit2 size={15} />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete section ${section.heading}`}
                                disabled={busy}
                                onClick={() => setDeleteTarget({ kind: "section", item: section })}
                              >
                                <Trash2 size={15} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="admin-content-card">
            <div className="admin-content-card-header">
              <div>
                <h4 className="admin-content-card-title">
                  Links{selectedSection ? ` — ${selectedSection.heading}` : ""}
                </h4>
                <p className="admin-content-card-meta">
                  {selectedSection
                    ? `Navigation links inside "${selectedSection.heading}" column`
                    : "Select a section above to view and manage its links"}
                </p>
              </div>
              <Button
                onClick={openLinkCreate}
                disabled={!selectedSection}
                className="quick-add-user-btn"
              >
                <Plus size={16} />
                <span>Add Link</span>
              </Button>
            </div>

            {!selectedSection ? (
              <div className="admin-panel-empty">
                <p className="chart-subtitle">Select a section to edit its links.</p>
              </div>
            ) : links.length === 0 ? (
              <div className="admin-panel-empty">
                <p className="chart-subtitle">No links in this section yet.</p>
              </div>
            ) : (
              <div className="table-responsive-wrapper">
                <Table className="ui-table--cards">
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Label</TableHead>
                      <TableHead scope="col">Href</TableHead>
                      <TableHead scope="col">Order</TableHead>
                      <TableHead scope="col">Active</TableHead>
                      <TableHead scope="col">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {links.map((link, index) => (
                      <TableRow key={link.id} data-testid={`footer-link-${link.id}`}>
                        <TableCell className="footer-link-label">{link.label}</TableCell>
                        <TableCell data-label="Href">
                          <code className="footer-link-href">{link.href}</code>
                        </TableCell>
                        <TableCell data-label="Order">
                          <OrderControls
                            index={index}
                            total={links.length}
                            label={link.label}
                            disabled={busy}
                            onMove={(from, to) => handleMoveLink(link, from, to)}
                          />
                        </TableCell>
                        <TableCell data-label="Active">
                          <ActiveToggle
                            active={link.is_active !== false}
                            label={link.label}
                            onChange={(active) => handleToggleLink(link, active)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="admin-row-actions">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit link ${link.label}`}
                              onClick={() => openLinkEdit(link)}
                            >
                              <Edit2 size={15} />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete link ${link.label}`}
                              disabled={busy}
                              onClick={() => setDeleteTarget({ kind: "link", item: link })}
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
          </div>
        </div>
      )}

      <AdminConfirmStrip
        open={Boolean(deleteTarget)}
        title={deleteTitle}
        message={
          deleteTarget?.kind === "section"
            ? deleteLinks === 0
              ? "This section has no links. This cannot be undone."
              : `Every link in this section is deleted with it (${deleteLinks} ${
                  deleteLinks === 1 ? "link" : "links"
                }). This cannot be undone.`
            : "This removes the link from the footer. This cannot be undone."
        }
        destructive
        pending={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
