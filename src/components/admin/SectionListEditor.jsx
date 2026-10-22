import { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Edit2,
  FolderTree,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  Layout,
  Megaphone,
  MousePointerClick,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  Type,
  Video,
} from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "../ui";
import { ActiveToggle, OrderControls } from "./ContentEditorKit";
import ConfirmDialog from "./ConfirmDialog";
import SectionConfigForm from "./SectionConfigForm";
import { SECTION_STYLE_FIELDS, SECTION_TYPES } from "../../../server/lib/sectionTypes.js";
import "./admin-content.css";

/**
 * The ordered section list of a page.
 *
 * The list is held by the parent and every change is handed back through
 * `onChange` — the editor owns the working copy, this component owns the
 * arrangement.
 *
 * Two decisions are worth spelling out:
 *
 *   1. **Reordering uses up and down buttons.** A drag handle would be a
 *      pointer-only affordance; the buttons are native buttons, so they are
 *      keyboard-operable for free. After a move the focus follows the moved
 *      card, so a keyboard user does not lose their place, and the move is
 *      announced in a polite live region.
 *   2. **A section keeps its identity.** Every card carries a `uid` that is
 *      stable across a reorder, so the browser reuses the same node and the
 *      focus survives the move.
 */

/** The catalogue label of a type, or a neutral name for an unknown type. */
function typeLabel(type) {
  if (typeof type !== "string" || !Object.hasOwn(SECTION_TYPES, type)) return "Unknown section";
  return SECTION_TYPES[type].label;
}

/** The description the catalogue gives a type, or an empty string. */
function typeDescription(type) {
  if (typeof type !== "string" || !Object.hasOwn(SECTION_TYPES, type)) return "";
  return SECTION_TYPES[type].description;
}

/** The name a card's actions carry: "Hero banner 1". */
function sectionName(section, index) {
  return `${typeLabel(section?.type)} ${index + 1}`;
}

/** A friendly one-line summary of what the section contains for quick visual scanning. */
function sectionPreviewSummary(section) {
  if (!section || !section.data) return "";
  const d = section.data;
  switch (section.type) {
    case "hero":
      return d.heading ? `"${d.heading}"` : d.eyebrow || "Empty headline";
    case "richtext":
      return d.body
        ? `${d.body
            .replace(/[#*_`\n]/g, " ")
            .slice(0, 45)
            .trim()}…`
        : "No text entered";
    case "promo_banner":
      return d.title ? `"${d.title}"` : "Promo banner";
    case "cta":
      return d.heading
        ? `"${d.heading}"`
        : d.button_label
          ? `Button: ${d.button_label}`
          : "CTA block";
    case "product_grid":
      return `${d.layout || "grid"} • ${d.limit || 12} max items • ${d.columns || 4} cols`;
    case "category_grid":
      return `${d.columns || 3} columns • limit ${d.limit || 12}`;
    case "faq":
      return Array.isArray(d.items) && d.items.length > 0
        ? `${d.items.length} Q&A item${d.items.length > 1 ? "s" : ""}`
        : "No questions yet";
    case "image":
      return d.image_alt
        ? `Alt: "${d.image_alt}"`
        : d.image_url
          ? "Image configured"
          : "No image URL";
    case "gallery":
      return Array.isArray(d.images) && d.images.length > 0
        ? `${d.images.length} images (${d.carousel ? "carousel" : "grid"})`
        : "No images yet";
    case "video":
      return d.video_url ? "Video URL linked" : "No video URL";
    case "category_listing":
      return `Listing • ${d.layout || "grid"} layout • sort by ${d.sort || "featured"}`;
    case "spacer":
      return `${d.height || 48}px height`;
    default:
      return "";
  }
}

/** A copy of the section's data, with every list copied as well. */
function copyData(data) {
  if (!data || typeof data !== "object") return {};
  const copy = {};
  for (const [key, value] of Object.entries(data)) {
    copy[key] = Array.isArray(value) ? [...value] : value;
  }
  return copy;
}

/** The default data block of a type, straight from the catalogue. */
function defaultSectionData(type) {
  const data = {};
  if (typeof type !== "string" || !Object.hasOwn(SECTION_TYPES, type)) return data;
  for (const [name, rule] of Object.entries(SECTION_TYPES[type].fields)) {
    data[name] = Array.isArray(rule.default) ? [...rule.default] : (rule.default ?? "");
  }
  return data;
}

/** The default style block every section shares, straight from the catalogue. */
function defaultSectionStyle() {
  const style = {};
  for (const [name, rule] of Object.entries(SECTION_STYLE_FIELDS)) {
    style[name] = rule.default ?? "";
  }
  return style;
}

const SECTION_ICONS = {
  hero: Sparkles,
  richtext: Type,
  image: ImageIcon,
  gallery: Layout,
  product_grid: ShoppingBag,
  category_grid: FolderTree,
  promo_banner: Megaphone,
  cta: MousePointerClick,
  faq: HelpCircle,
  video: Video,
  category_listing: Layers,
  spacer: Layers,
};

const SECTION_CATEGORIES = {
  all: "All Sections",
  commerce: "Commerce",
  media: "Media & Visuals",
  content: "Content & Text",
};

const TYPE_TO_CATEGORY = {
  product_grid: "commerce",
  category_grid: "commerce",
  category_listing: "commerce",
  hero: "media",
  image: "media",
  gallery: "media",
  video: "media",
  richtext: "content",
  promo_banner: "content",
  cta: "content",
  faq: "content",
  spacer: "content",
};

export default function SectionListEditor({ sections = [], onChange }) {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [pickerCategory, setPickerCategory] = useState("all");
  const [pickerSearch, setPickerSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  const [focusTarget, setFocusTarget] = useState(null);
  const cardRefs = useRef(new Map());
  const counters = useRef({ added: 0, copied: 0, moved: 0 });

  /** Move the DOM focus to a card, so the keyboard user keeps their place. */
  const focusCard = (uid) => {
    counters.current.moved += 1;
    setFocusTarget({ uid, nonce: counters.current.moved });
  };

  useEffect(() => {
    if (!focusTarget) return;
    cardRefs.current.get(focusTarget.uid)?.focus();
  }, [focusTarget]);

  const handleMove = (from, to) => {
    if (from === to || from < 0 || to < 0 || from >= sections.length || to >= sections.length)
      return;
    const next = [...sections];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange?.(next);
    setAnnouncement(`${typeLabel(moved?.type)} moved to position ${to + 1} of ${sections.length}.`);
    focusCard(moved?.uid);
  };

  const handleToggle = (section, enabled) => {
    onChange?.(
      sections.map((candidate) =>
        candidate.uid === section.uid ? { ...candidate, enabled } : candidate
      )
    );
    setAnnouncement(`${typeLabel(section?.type)} ${enabled ? "shown" : "hidden"}.`);
  };

  const handleDuplicate = (section, index) => {
    counters.current.copied += 1;
    const copy = {
      ...section,
      // A copy is a new row: it carries no id until the server assigns one.
      uid: `${section.uid}-copy-${counters.current.copied}`,
      id: null,
      data: copyData(section.data),
      style: { ...(section.style ?? {}) },
    };
    const next = [...sections];
    next.splice(index + 1, 0, copy);
    onChange?.(next);
    setAnnouncement(`${typeLabel(section?.type)} duplicated.`);
  };

  const handleAdd = (type) => {
    counters.current.added += 1;
    const created = {
      uid: `section-new-${counters.current.added}`,
      id: null,
      type,
      enabled: true,
      data: defaultSectionData(type),
      style: defaultSectionStyle(),
    };
    onChange?.([...sections, created]);
    setAdding(false);
    setAnnouncement(`${typeLabel(type)} added at position ${sections.length + 1}.`);
    focusCard(created.uid);
  };

  const handleApplyEdit = () => {
    if (!editing) return;
    onChange?.(
      sections.map((candidate) =>
        candidate.uid === editing.uid
          ? { ...candidate, data: editing.data, style: editing.style }
          : candidate
      )
    );
    setEditing(null);
    setAnnouncement(`${typeLabel(editing.type)} updated.`);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const next = sections.filter((candidate) => candidate.uid !== deleteTarget.uid);
    setDeleteTarget(null);
    onChange?.(next);
    setAnnouncement(`${typeLabel(deleteTarget.type)} removed.`);
  };

  const deleteIndex = deleteTarget
    ? sections.findIndex((candidate) => candidate.uid === deleteTarget.uid)
    : -1;
  const deleteName = deleteTarget ? sectionName(deleteTarget, deleteIndex) : "this section";

  return (
    <div className="section-list-editor" style={{ display: "grid", gap: 12 }}>
      {/* The move announcement. It is mounted once, in the initial markup, so
          a screen reader is already listening when the first move happens. */}
      <div role="status" aria-live="polite" aria-atomic="true" className="text-sm text-muted">
        {announcement}
      </div>

      {sections.length === 0 ? (
        <p className="chart-subtitle">No sections yet. Add the first one.</p>
      ) : (
        sections.map((section, index) => {
          const name = sectionName(section, index);
          return (
            <div
              key={section.uid}
              className="section-card"
              tabIndex={-1}
              data-section-uid={section.uid}
              data-testid={`section-card-${section.uid}`}
              ref={(node) => {
                if (node) cardRefs.current.set(section.uid, node);
                else cardRefs.current.delete(section.uid);
              }}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                padding: 12,
                border: "1px solid var(--border-color, #e2e8f0)",
                borderRadius: 10,
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{typeLabel(section.type)}</div>
                {sectionPreviewSummary(section) && (
                  <div
                    style={{
                      fontSize: 12.5,
                      color: "#475569",
                      marginTop: 2,
                      maxWidth: 340,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {sectionPreviewSummary(section)}
                  </div>
                )}
                <div className="text-sm text-muted">
                  Position {index + 1} of {sections.length}
                  {section.enabled === false ? " — hidden" : ""}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <OrderControls
                  index={index}
                  total={sections.length}
                  label={name}
                  onMove={(from, to) => handleMove(from, to)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${name}`}
                  onClick={() =>
                    setEditing({
                      uid: section.uid,
                      type: section.type,
                      data: copyData(section.data),
                      style: { ...(section.style ?? {}) },
                    })
                  }
                >
                  <Edit2 size={15} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Duplicate ${name}`}
                  onClick={() => handleDuplicate(section, index)}
                >
                  <Copy size={15} />
                </Button>
                <ActiveToggle
                  active={section.enabled !== false}
                  label={name}
                  onChange={(enabled) => handleToggle(section, enabled)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${name}`}
                  onClick={() => setDeleteTarget(section)}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            </div>
          );
        })
      )}

      <div>
        <Button
          type="button"
          variant="outline"
          className="quick-add-user-btn"
          onClick={() => setAdding(true)}
        >
          <Plus size={16} />
          <span>Add section</span>
        </Button>
      </div>

      {/* The type picker: categorized, searchable, and accompanied by icons and clear descriptions */}
      <Dialog
        open={adding}
        onOpenChange={(open) => {
          setAdding(open);
          if (!open) {
            setPickerCategory("all");
            setPickerSearch("");
          }
        }}
      >
        <DialogContent style={{ maxWidth: 580 }}>
          <DialogHeader>
            <DialogTitle>Add section</DialogTitle>
            <DialogDescription>Pick a component to append to your page layout.</DialogDescription>
          </DialogHeader>

          {/* Quick search input */}
          <div style={{ position: "relative", marginBottom: 8 }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
                pointerEvents: "none",
              }}
            />
            <Input
              type="text"
              placeholder="Search sections by name or description..."
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              style={{ paddingLeft: 34, height: 38 }}
            />
          </div>

          {/* Category filter tabs */}
          <div
            style={{
              display: "flex",
              gap: 6,
              overflowX: "auto",
              paddingBottom: 6,
              marginBottom: 8,
            }}
          >
            {Object.entries(SECTION_CATEGORIES).map(([catKey, catLabel]) => {
              const active = pickerCategory === catKey;
              return (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => setPickerCategory(catKey)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: active ? 700 : 500,
                    color: active ? "#2563eb" : "#64748b",
                    background: active ? "#eff6ff" : "transparent",
                    border: active ? "1px solid #bfdbfe" : "1px solid #e2e8f0",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease",
                  }}
                >
                  {catLabel}
                </button>
              );
            })}
          </div>

          <div className="section-picker-grid" style={{ maxHeight: "50vh", overflowY: "auto" }}>
            {Object.entries(SECTION_TYPES)
              .filter(([type, definition]) => {
                if (pickerCategory !== "all" && TYPE_TO_CATEGORY[type] !== pickerCategory) {
                  return false;
                }
                if (pickerSearch.trim()) {
                  const query = pickerSearch.toLowerCase().trim();
                  const matchesLabel = definition.label.toLowerCase().includes(query);
                  const matchesDesc = definition.description.toLowerCase().includes(query);
                  return matchesLabel || matchesDesc;
                }
                return true;
              })
              .map(([type, definition]) => {
                const IconComponent = SECTION_ICONS[type] || Layout;
                return (
                  <button
                    key={type}
                    type="button"
                    aria-label={definition.label}
                    className="section-picker-option"
                    onClick={() => {
                      handleAdd(type);
                      setPickerCategory("all");
                      setPickerSearch("");
                    }}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "12px 14px",
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: "#f1f5f9",
                        color: "#2563eb",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      <IconComponent size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <span className="section-picker-title">{definition.label}</span>
                      <span className="section-picker-desc">{definition.description}</span>
                    </div>
                  </button>
                );
              })}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAdding(false);
                setPickerCategory("all");
                setPickerSearch("");
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* The generated form for one section. */}
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        {editing && (
          <DialogContent style={{ maxWidth: 640 }}>
            <DialogHeader>
              <DialogTitle>{`Edit ${typeLabel(editing.type)}`}</DialogTitle>
              <DialogDescription>{typeDescription(editing.type)}</DialogDescription>
            </DialogHeader>
            <SectionConfigForm
              type={editing.type}
              data={editing.data}
              style={editing.style}
              onChange={(data) =>
                setEditing((previous) => (previous ? { ...previous, data } : previous))
              }
              onStyleChange={(style) =>
                setEditing((previous) => (previous ? { ...previous, style } : previous))
              }
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleApplyEdit}>
                Apply
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete '${deleteName}'?`}
        message="The section is removed from the page when the sections are saved."
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
