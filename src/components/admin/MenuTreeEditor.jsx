import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Edit2,
  Layers,
  MoreHorizontal,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  useToast,
} from "../ui";
import "./admin-content.css";
import {
  apiDeleteMenuItem,
  apiFetchCategoryTree,
  apiFetchMenuItems,
  apiReorderMenuItems,
  apiSaveCategory,
  apiSaveMenuItem,
  apiUpdateMenuItem,
} from "../../api/contentApi";
import ConfirmDialog from "./ConfirmDialog";
import { ActiveToggle, OrderControls } from "./ContentEditorKit";

const MENU_EVENT = "marvel_menu_updated";
const CONTENT_EVENT = "marvel_content_updated";
const ALL_ROLES = ["user", "vendor", "admin", "super_admin"];

/**
 * Badge styles the editor offers. These are the values the menu_items column
 * accepts; each one maps onto a Badge primitive variant for display.
 */
const BADGE_VARIANTS = ["accent", "secondary", "success", "neutral"];

const BADGE_RENDER_VARIANT = {
  accent: "accent",
  secondary: "secondary",
  success: "success",
  neutral: "outline",
};

/**
 * Fallback styling for rows that carry a badge but no usable variant — the
 * column is not in every deployed schema yet. The badge text carries the
 * intent, so it decides the colour. Display only: nothing here is saved.
 */
const BADGE_TEXT_VARIANTS = [
  [/\b(hot|flash|trending|limited|deal|deals|sale)\b/i, "destructive"],
  [/\b(new|just in|fresh)\b/i, "success"],
  [/\b(seller|vendor|store)\b/i, "accent"],
  [/\b(root|admin|management|super)\b/i, "default"],
];

/** Map a stored `badge_variant` onto a Badge primitive variant. */
function badgeVariantFor(value, text = "") {
  const key = String(value ?? "")
    .trim()
    .toLowerCase();
  if (BADGE_RENDER_VARIANT[key]) return BADGE_RENDER_VARIANT[key];
  for (const [pattern, variant] of BADGE_TEXT_VARIANTS) {
    if (pattern.test(String(text ?? ""))) return variant;
  }
  return "secondary";
}

function sortNodes(nodes = []) {
  return [...nodes]
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    .map((node) => ({ ...node, children: sortNodes(node.children ?? []) }));
}

/**
 * Normalize the menu API response to a tree. The API returns tree-shaped
 * nodes ({ children }) by default; older responses may be a legacy flat
 * list, which is rebuilt client-side via parent_id.
 */
function normalizeToTree(data) {
  const list = Array.isArray(data) ? data : Array.isArray(data?.menu) ? data.menu : [];
  if (list.length === 0) return [];
  if (list.some((item) => Array.isArray(item?.children))) {
    return sortNodes(list);
  }
  const byId = new Map();
  for (const row of list) {
    if (row && row.id != null) byId.set(row.id, { ...row, children: [] });
  }
  const roots = [];
  for (const node of byId.values()) {
    const parentId = node.parent_id ?? null;
    if (parentId == null || !byId.has(parentId) || parentId === node.id) {
      roots.push(node);
    } else {
      byId.get(parentId).children.push(node);
    }
  }
  return sortNodes(roots);
}

function collectIds(nodes, acc = {}) {
  for (const node of nodes) {
    acc[node.id] = true;
    if (Array.isArray(node.children)) collectIds(node.children, acc);
  }
  return acc;
}

function findNode(nodes = [], id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children ?? [], id);
    if (found) return found;
  }
  return null;
}

function findParent(nodes = [], id, parent = null) {
  for (const node of nodes) {
    if (node.id === id) return parent;
    const found = findParent(node.children ?? [], id, node);
    if (found) return found;
  }
  return null;
}

/** The complete sibling group for a parent — hidden rows included. */
function siblingsFor(nodes = [], parentId) {
  if (parentId == null) return nodes;
  return findNode(nodes, parentId)?.children ?? [];
}

function countDescendants(node) {
  return (node?.children ?? []).reduce((total, child) => total + 1 + countDescendants(child), 0);
}

/** Every node in the tree, at any depth. */
function countNodes(nodes = []) {
  return nodes.reduce((total, node) => total + 1 + countNodes(node.children ?? []), 0);
}

/** Level-2 and level-3 categories, with their full category path. */
function categoryChoices(nodes = [], ancestors = [], acc = []) {
  for (const node of nodes) {
    const chain = [...ancestors, node];
    const level = Number(node.level ?? chain.length);
    if (level >= 2 && level <= 3) {
      acc.push({
        id: node.id,
        label: chain.map((entry) => entry.name).join(" / "),
        path: `/category/${chain.map((entry) => entry.slug).join("/")}`,
      });
    }
    categoryChoices(node.children ?? [], chain, acc);
  }
  return acc;
}

/* -------------------------------------------------------------------------- */
/* Category page offer                                                        */
/* -------------------------------------------------------------------------- */

/** One path segment of a category URL — the slug rules the server enforces. */
const CATEGORY_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The slug chain of a category-style path, or null when the path is not one.
 *
 * Rule: the path must be exactly `/category/` followed by one to three slug
 * segments with no empty segment. `/category/electronics` and
 * `/category/audio/speakers` qualify. `/`, `/deals`, `/admin-dashboard`,
 * `/vendor-dashboard`, `/category`, `/category/` and `/category/a//b` do not —
 * those are not category pages, so the offer must stay hidden.
 */
function categoryPathSegments(path) {
  const trimmed = String(path ?? "").trim();
  if (!trimmed.startsWith("/category/")) return null;
  const segments = trimmed.split("/").slice(2);
  if (segments.length === 0 || segments.length > 3) return null;
  if (!segments.every((segment) => CATEGORY_SLUG.test(segment))) return null;
  return segments;
}

/** `/category/a/b` for a chain of category rows. */
function categoryPathOf(chain = []) {
  return `/category/${chain.map((entry) => entry.slug).join("/")}`;
}

/** Walk the category tree along slug segments; the row plus its ancestor chain. */
function findCategoryByPath(nodes = [], segments = [], ancestors = []) {
  if (segments.length === 0) return null;
  const [head, ...rest] = segments;
  for (const node of nodes) {
    if (node?.slug !== head) continue;
    const chain = [...ancestors, node];
    if (rest.length === 0) return { node, chain };
    const nested = findCategoryByPath(node.children ?? [], rest, chain);
    if (nested) return nested;
  }
  return null;
}

/**
 * First row with this slug, at any depth. Two levels may legitimately share a
 * slug, so the exact-path lookup above wins when it matches.
 */
function findCategoryBySlug(nodes = [], slug, ancestors = []) {
  for (const node of nodes) {
    const chain = [...ancestors, node];
    if (node?.slug === slug) return { node, chain };
    const nested = findCategoryBySlug(node.children ?? [], slug, chain);
    if (nested) return nested;
  }
  return null;
}

/** A category row by id, with its ancestor chain. */
function findCategoryById(nodes = [], id, ancestors = []) {
  if (id == null) return null;
  for (const node of nodes) {
    const chain = [...ancestors, node];
    if (node.id === id) return { node, chain };
    const nested = findCategoryById(node.children ?? [], id, chain);
    if (nested) return nested;
  }
  return null;
}

/**
 * What saving would do about the category page the item's path points at.
 *
 * - null: the offer does not apply — an edit, a category is already linked,
 *   or the path is not a category path.
 * - { action: "reuse" }: a category already covers this path or slug; link it
 *   instead of creating a duplicate.
 * - { action: "create" }: create the category under `parentId` (null = level 1)
 *   and point the menu item at `path`.
 * - { action: "error" }: the category cannot be created (below a level-3
 *   parent), so the item is saved alone and the admin is warned.
 *
 * The parent category is the one the PARENT menu item links to, so a level-2
 * menu item creates a level-2 category. A deeper path also resolves its own
 * ancestors, which covers a parent menu item that has no category linked yet.
 */
function planCategoryPage({ form, title, path, menuTree, categoryTree }) {
  if (!form || form.id || form.categoryId) return null;
  const segments = categoryPathSegments(path);
  if (!segments) return null;

  const slug = segments[segments.length - 1];
  const existing =
    findCategoryByPath(categoryTree, segments) ?? findCategoryBySlug(categoryTree, slug);
  if (existing) {
    return {
      action: "reuse",
      name: existing.node.name,
      categoryId: existing.node.id,
      path: categoryPathOf(existing.chain),
    };
  }

  const parentMenuItem = form.parentId != null ? findNode(menuTree, form.parentId) : null;
  const parent =
    findCategoryById(categoryTree, parentMenuItem?.category_id) ??
    (segments.length > 1 ? findCategoryByPath(categoryTree, segments.slice(0, -1)) : null);

  const parentChain = parent?.chain ?? [];
  const targetPath = categoryPathOf([...parentChain, { slug }]);
  if (parentChain.length >= 3) {
    return {
      action: "error",
      message: `'${targetPath}' would be a level 4 category, but categories stop at level 3.`,
    };
  }

  return {
    action: "create",
    name: String(title ?? "").trim(),
    slug,
    parentId: parent?.node.id ?? null,
    parentChain,
    path: targetPath,
  };
}

function toPayload(form) {
  return {
    title: (form.title ?? "").trim(),
    path: (form.path ?? "").trim(),
    icon: (form.icon ?? "").trim() || "Layers",
    badge: (form.badge ?? "").trim() || null,
    // Never drop the stored variant: the server would fall back to "accent".
    badge_variant: form.badgeVariant || "accent",
    roles_allowed: (form.rolesAllowed ?? "")
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean),
    order_index: Number(form.orderIndex ?? 0),
    level: Number(form.level ?? 1),
    parent_id: form.parentId ?? null,
    section: (form.section ?? "").trim() || null,
    section_icon: (form.sectionIcon ?? "").trim() || null,
    promo_title: (form.promoTitle ?? "").trim() || null,
    promo_subtitle: (form.promoSubtitle ?? "").trim() || null,
    promo_image_url: (form.promoImageUrl ?? "").trim() || null,
    promo_cta_text: (form.promoCtaText ?? "").trim() || null,
    promo_cta_path: (form.promoCtaPath ?? "").trim() || null,
    is_active: Boolean(form.isActive),
    category_id: form.categoryId || null,
  };
}

/** The stored value of a payload field, normalized the same way a save is. */
function storedValue(node, key) {
  switch (key) {
    case "parent_id":
      return node.parent_id ?? null;
    case "category_id":
      return node.category_id ?? null;
    case "level":
      return Number(node.level ?? 1);
    case "order_index":
      return Number(node.order_index ?? 0);
    case "is_active":
      return node.is_active !== false;
    case "roles_allowed":
      return Array.isArray(node.roles_allowed) ? node.roles_allowed : [];
    case "icon":
      return node.icon || "Layers";
    case "badge_variant":
      return node.badge_variant || "accent";
    default:
      return node[key] || null;
  }
}

function comparable(value) {
  return Array.isArray(value) ? JSON.stringify(value) : value;
}

/** PATCH body: the id plus only the fields the admin actually changed. */
function changedFields(node, payload) {
  const patch = { id: node.id };
  for (const [key, value] of Object.entries(payload)) {
    if (comparable(storedValue(node, key)) !== comparable(value)) patch[key] = value;
  }
  return patch;
}

function newForm(parent, order) {
  return {
    id: null,
    title: "",
    path: "/",
    icon: "Layers",
    badge: "",
    badgeVariant: "accent",
    rolesAllowed: ALL_ROLES.join(", "),
    orderIndex: order,
    level: parent ? Number(parent.level ?? 1) + 1 : 1,
    parentId: parent?.id ?? null,
    categoryId: "",
    section: "",
    sectionIcon: "",
    promoTitle: "",
    promoSubtitle: "",
    promoImageUrl: "",
    promoCtaText: "",
    promoCtaPath: "",
    isActive: true,
    // Defaults ON: when the path points at a category page that does not
    // exist yet, saving the item without it produces a dead link.
    createCategoryPage: true,
  };
}

function editForm(item, parentId) {
  return {
    id: item.id ?? null,
    title: item.title || "",
    path: item.path || "/",
    icon: item.icon || "Layers",
    badge: item.badge || "",
    badgeVariant: item.badge_variant || "accent",
    rolesAllowed: Array.isArray(item.roles_allowed) ? item.roles_allowed.join(", ") : "",
    orderIndex: Number(item.order_index ?? 0),
    level: Number(item.level ?? (parentId ? 2 : 1)),
    parentId: item.parent_id ?? parentId ?? null,
    categoryId: item.category_id ?? "",
    section: item.section || "",
    sectionIcon: item.section_icon || "",
    promoTitle: item.promo_title || "",
    promoSubtitle: item.promo_subtitle || "",
    promoImageUrl: item.promo_image_url || "",
    promoCtaText: item.promo_cta_text || "",
    promoCtaPath: item.promo_cta_path || "",
    isActive: item.is_active !== false,
  };
}

export default function MenuTreeEditor({ role = "admin" }) {
  const { addToast } = useToast();
  const [tree, setTree] = useState([]);
  const [categoryTree, setCategoryTree] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState({});
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
      // Reorder scope is every row sharing parent_id, hidden and role-filtered
      // rows included, so the editor must fetch the whole unfiltered tree.
      const data = await apiFetchMenuItems(role, { includeInactive: true });
      const normalized = normalizeToTree(data);
      setTree(normalized);
      setCollapsed((previous) => {
        const next = {};
        for (const id of Object.keys(collectIds(normalized))) {
          // Keep an explicit collapse, but never collapse a node by default.
          if (previous[id]) next[id] = true;
        }
        return next;
      });
    } catch (err) {
      addToast({ title: "Menu Load Failed", message: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }, [role, addToast]);

  const loadCategories = useCallback(async () => {
    try {
      const data = await apiFetchCategoryTree({ includeInactive: true });
      // Keep the raw tree: the offer needs slugs and ancestor chains, which
      // the flattened select options drop.
      const nodes = data?.categories ?? [];
      setCategoryTree(nodes);
      setCategories(categoryChoices(nodes));
    } catch (err) {
      // The menu is still editable without the optional category link.
      addToast({ title: "Categories Load Failed", message: err.message, type: "error" });
    }
  }, [addToast]);

  useEffect(() => {
    load();
    loadCategories();
  }, [load, loadCategories]);

  const broadcast = () => {
    window.dispatchEvent(new Event(MENU_EVENT));
    window.dispatchEvent(new Event(CONTENT_EVENT));
  };

  const openCreate = (parent = null) => {
    setFormError("");
    setEditing(newForm(parent, siblingsFor(tree, parent?.id ?? null).length));
  };

  const openEdit = (item) => {
    setFormError("");
    setEditing(editForm(item, findParent(tree, item.id)?.id ?? null));
  };

  const setField = (field, value) =>
    setEditing((previous) => (previous ? { ...previous, [field]: value } : previous));

  const handleCategoryChange = (value) =>
    setEditing((previous) => {
      if (!previous) return previous;
      const categoryId = value || "";
      const choice = categories.find((option) => option.id === categoryId);
      return {
        ...previous,
        categoryId,
        path: choice ? choice.path : previous.path,
      };
    });

  /**
   * Create or reuse the category page a new item points at. Returns null when
   * the offer does not apply, `{ categoryId, path }` when the item can be
   * linked, or `{ error }` when only the menu item can be saved.
   */
  const linkCategoryPage = async (form, payload) => {
    const plan = planCategoryPage({
      form,
      title: payload.title,
      path: payload.path,
      menuTree: tree,
      categoryTree,
    });
    if (!plan) return null;
    if (plan.action === "reuse") return { categoryId: plan.categoryId, path: plan.path };
    if (plan.action === "error") return { error: plan.message };

    try {
      // `level` is derived from `parent_id` server-side, so it is not sent.
      // The flags keep the new page visible in the nav and category strip.
      const saved = await apiSaveCategory({
        name: plan.name || payload.title,
        slug: plan.slug,
        parent_id: plan.parentId,
        is_active: true,
        show_in_nav: true,
        show_in_homepage: true,
      });
      const categoryId = saved?.category?.id ?? null;
      if (!categoryId) {
        return {
          error:
            "The category page was created but its id was not returned, so the menu item could not be linked to it.",
        };
      }
      return { categoryId, path: plan.path };
    } catch (err) {
      return { error: err?.message || "Could not create the category page." };
    }
  };

  const handleMove = async (item, from, to) => {
    if (requestInFlight.current) return;
    const parent = findParent(tree, item.id);
    const siblings = siblingsFor(tree, parent?.id ?? null);
    if (from === to || from < 0 || to < 0 || from >= siblings.length || to >= siblings.length) {
      return;
    }

    const reordered = [...siblings];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    // The API rejects a partial scope, so every sibling is sent renumbered.
    // A within-group move never changes parents: a present `parent_id`/`level`
    // would make the server treat the entry as a move and re-validate the
    // hierarchy, turning one stale stored level into a 400 (§3.6).
    const orders = reordered.map((sibling, index) => ({
      id: sibling.id,
      display_order: index,
    }));

    requestInFlight.current = true;
    setReordering(true);
    try {
      await apiReorderMenuItems(orders);
      addToast({ title: "Menu Reordered", message: `'${item.title}' moved.`, type: "success" });
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
      if (!payload.title || !payload.path) {
        const message = "Menu item title and path are required.";
        setFormError(message);
        addToast({ title: "Missing Information", message, type: "error" });
        return;
      }

      if (editing.id) {
        const stored = findNode(tree, editing.id);
        await apiUpdateMenuItem(
          editing.id,
          stored ? changedFields(stored, payload) : { id: editing.id, ...payload }
        );
      } else {
        // Create the page first so the menu item never points at a 404 when
        // the category write is what fails.
        let categoryWarning = "";
        let itemPayload = payload;
        if (editing.createCategoryPage !== false) {
          const linked = await linkCategoryPage(editing, payload);
          if (linked?.error) {
            categoryWarning = linked.error;
          } else if (linked?.categoryId) {
            itemPayload = { ...payload, category_id: linked.categoryId, path: linked.path };
          }
        }
        await apiSaveMenuItem(itemPayload);
        // The item is saved either way: an unavailable category must not lose
        // the admin's input, but it must never fail silently.
        if (categoryWarning) {
          addToast({
            title: "Category Not Created",
            message: `${categoryWarning} The menu item was saved, but its link may not resolve until the category page exists.`,
            type: "error",
          });
        }
      }
      const savedId = editing.id;
      setEditing(null);
      addToast({
        title: savedId ? "Menu Item Updated" : "Menu Item Saved",
        message: `'${payload.title}' saved.`,
        type: "success",
      });
      broadcast();
      await load();
      // A saved item may have created a category, so refresh the link options.
      await loadCategories();
    } catch (err) {
      // Keep the form open: the admin's input must survive a failed write.
      const message = err?.message || "Could not save the menu item.";
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
      await apiDeleteMenuItem(target.id);
      setDeleteTarget(null);
      addToast({ title: "Menu Item Deleted", message: `Removed '${target.title}'.`, type: "info" });
      broadcast();
      await load();
    } catch (err) {
      addToast({ title: "Delete Failed", message: err.message, type: "error" });
    } finally {
      requestInFlight.current = false;
      setDeleting(false);
    }
  };

  const renderNode = (item, depth) => {
    const children = item.children ?? [];
    const parent = findParent(tree, item.id);
    const siblings = siblingsFor(tree, parent?.id ?? null);
    const index = siblings.findIndex((sibling) => sibling.id === item.id);
    const isOpen = !collapsed[item.id];

    return (
      <div key={item.id} className="menu-tree-node" data-level={depth}>
        <div className="menu-tree-row" data-testid={`menu-row-${item.id}`}>
          {children.length > 0 ? (
            <button
              type="button"
              className="menu-tree-toggle"
              aria-label={`${isOpen ? "Collapse" : "Expand"} ${item.title}`}
              aria-expanded={isOpen}
              onClick={() =>
                setCollapsed((previous) => ({ ...previous, [item.id]: !previous[item.id] }))
              }
            >
              {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
          ) : (
            <span className="menu-tree-toggle-spacer" />
          )}
          <span className="menu-tree-label">
            <span className="menu-tree-title">{item.title}</span>
            {item.badge && (
              <Badge variant={badgeVariantFor(item.badge_variant, item.badge)} size="sm">
                {item.badge}
              </Badge>
            )}
          </span>
          <span className="menu-tree-path">{item.path}</span>
          <span className="menu-tree-status">
            <Badge
              variant={item.is_active === false ? "secondary" : "success"}
              size="sm"
              icon={<span className="menu-tree-status-dot" aria-hidden="true" />}
            >
              {item.is_active === false ? "Hidden" : "Active"}
            </Badge>
          </span>
          <div className="menu-tree-actions">
            <OrderControls
              index={index}
              total={siblings.length}
              label={item.title}
              disabled={busy}
              onMove={(from, to) => handleMove(item, from, to)}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`More actions for ${item.title}`}
                  disabled={busy}
                >
                  <MoreHorizontal size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  icon={<Plus size={14} />}
                  disabled={Number(item.level ?? depth) >= 3 || busy}
                  onSelect={() => openCreate(item)}
                >
                  Add child to {item.title}
                </DropdownMenuItem>
                <DropdownMenuItem
                  icon={<Edit2 size={14} />}
                  disabled={busy}
                  onSelect={() => openEdit(item)}
                >
                  Edit {item.title}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="menu-tree-danger-item"
                  icon={<Trash2 size={14} />}
                  disabled={busy}
                  onSelect={() => setDeleteTarget(item)}
                >
                  Delete {item.title}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {children.length > 0 && isOpen && (
          <div className="menu-tree-children">
            {children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const descendants = countDescendants(deleteTarget ? findNode(tree, deleteTarget.id) : null);
  const deleteName = deleteTarget?.title ?? "this item";
  // The cascade count is the headline: menu_items.parent_id is ON DELETE CASCADE.
  const deleteTitle =
    descendants > 0
      ? `Delete '${deleteName}' and ${descendants} ${descendants === 1 ? "child item" : "child items"}?`
      : `Delete '${deleteName}'?`;

  // A stored variant the editor does not offer (legacy or hand-typed rows)
  // still needs a matching option, otherwise the select renders blank.
  const storedBadgeVariant = (editing?.badgeVariant ?? "").trim();
  const badgeVariantOptions = BADGE_VARIANTS.includes(storedBadgeVariant)
    ? BADGE_VARIANTS
    : [...BADGE_VARIANTS, storedBadgeVariant].filter(Boolean);

  // The badge_variant column is not in every deployed menu_items schema, and
  // writing it to a table without it fails the save outright. The API returns
  // the key on every row when the column exists, so its absence is the signal.
  // An empty tree proves nothing, so the control stays available there.
  const badgeVariantSupported =
    tree.length === 0 || tree.some((node) => Object.hasOwn(node, "badge_variant"));

  // Recomputed from the live form: the offer disappears the moment a category
  // is linked, and it never applies while editing an existing item.
  const categoryPlan = editing
    ? planCategoryPage({
        form: editing,
        title: editing.title,
        path: editing.path,
        menuTree: tree,
        categoryTree,
      })
    : null;
  const categoryOfferOn = editing?.createCategoryPage !== false;

  return (
    <div className="dashboard-tab-view animate-fade-in">
      <div className="admin-page-header">
        <div className="admin-page-heading">
          <span className="admin-page-icon" aria-hidden="true">
            <Layers size={20} />
          </span>
          <div>
            <h2 className="admin-page-title">Navigation Menus</h2>
            <p className="admin-page-subtitle">
              Three-level menu tree — expand, reorder, edit, or add items
            </p>
          </div>
        </div>
        <Button
          variant="primary"
          onClick={() => openCreate(null)}
          className="admin-page-cta"
          leftIcon={<Plus size={16} />}
        >
          Add Top-Level Item
        </Button>
      </div>

      <div className="admin-content-card">
        <div className="admin-content-card-header">
          <div>
            <h3 className="admin-content-card-title">Menu structure</h3>
            {tree.length > 0 && (
              <p className="admin-content-card-meta">
                {tree.length} top-level · {countNodes(tree)} total
              </p>
            )}
          </div>
        </div>
        <div className="admin-content-card-body">
          {loading ? (
            <output
              className="menu-tree-skeleton"
              data-testid="menu-tree-skeleton"
              aria-label="Loading menu items"
            >
              <div className="menu-tree-skeleton-row" />
              <div className="menu-tree-skeleton-row" />
              <div className="menu-tree-skeleton-row" />
            </output>
          ) : tree.length === 0 ? (
            <div className="menu-tree-empty">
              <span className="menu-tree-empty-icon" aria-hidden="true">
                <Layers size={22} />
              </span>
              <h4 className="menu-tree-empty-title">No menu items yet</h4>
              <p className="menu-tree-empty-text">
                Add your first top-level item to start building the storefront navigation.
              </p>
              <Button
                variant="primary"
                onClick={() => openCreate(null)}
                leftIcon={<Plus size={16} />}
              >
                Add Top-Level Item
              </Button>
            </div>
          ) : (
            <div className="menu-tree">{tree.map((item) => renderNode(item, 1))}</div>
          )}
        </div>
      </div>

      {editing && (
        <div className="modal-backdrop-overlay">
          <div
            className="modal-content-container menu-item-editor animate-scale-up"
            role="dialog"
            aria-modal="true"
            aria-label="Menu item editor"
          >
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{editing.id ? "Edit Menu Item" : "Add Menu Item"}</h3>
                <p className="modal-subtitle">
                  Level {editing.level} —{" "}
                  {editing.level === 1
                    ? "a top-level item has no parent"
                    : "a child of the selected parent"}
                </p>
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
              <div className="form-section">
                <h4 className="form-section-title">Basics</h4>
                <div className="form-group-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="menu-title">
                      Title *
                    </label>
                    <Input
                      id="menu-title"
                      type="text"
                      value={editing.title}
                      onChange={(event) => setField("title", event.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="menu-path">
                      Path *
                    </label>
                    <Input
                      id="menu-path"
                      type="text"
                      value={editing.path}
                      onChange={(event) => setField("path", event.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="menu-category">
                    Category
                  </label>
                  <select
                    id="menu-category"
                    className="form-select-field"
                    value={editing.categoryId ?? ""}
                    onChange={(event) => handleCategoryChange(event.target.value)}
                  >
                    <option value="">No category link</option>
                    {categories.map((choice) => (
                      <option key={choice.id} value={choice.id}>
                        {choice.label}
                      </option>
                    ))}
                  </select>
                  <output className="form-hint">
                    Choosing a category rewrites the path to its full ancestor path.
                  </output>
                </div>

                <div className="form-group-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="menu-icon">
                      Icon
                    </label>
                    <Input
                      id="menu-icon"
                      type="text"
                      value={editing.icon}
                      onChange={(event) => setField("icon", event.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="menu-order">
                      Order index
                    </label>
                    <Input
                      id="menu-order"
                      type="number"
                      value={editing.orderIndex}
                      onChange={(event) => setField("orderIndex", event.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="menu-section">
                      Section
                    </label>
                    <Input
                      id="menu-section"
                      type="text"
                      value={editing.section}
                      onChange={(event) => setField("section", event.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="menu-section-icon">
                      Section icon
                    </label>
                    <Input
                      id="menu-section-icon"
                      type="text"
                      value={editing.sectionIcon}
                      onChange={(event) => setField("sectionIcon", event.target.value)}
                    />
                  </div>
                </div>
              </div>

              {categoryPlan && (
                <div className="form-section" data-testid="menu-create-category">
                  <h4 className="form-section-title">Category page</h4>
                  <p className="menu-create-page-text">
                    {categoryPlan.action === "reuse" ? (
                      <>
                        The page already exists at <code>{categoryPlan.path}</code>. Saving links
                        this menu item to it instead of creating a duplicate.
                      </>
                    ) : categoryPlan.action === "error" ? (
                      categoryPlan.message
                    ) : (
                      <>
                        <code>{editing.path}</code> has no category page yet. Saving can create{" "}
                        <code>{categoryPlan.path}</code> and point this menu item at it.
                      </>
                    )}
                  </p>

                  {categoryPlan.action !== "error" && (
                    <div className="form-group">
                      <span className="form-label">Matching category page</span>
                      <ActiveToggle
                        active={categoryOfferOn}
                        label="category page creation"
                        onChange={(active) => setField("createCategoryPage", active)}
                      />
                      <output className="form-hint">
                        {categoryOfferOn
                          ? "On: saving writes the category page first, then links this item to it."
                          : "Off: only the menu item is saved, so the path may not resolve."}
                      </output>
                    </div>
                  )}
                </div>
              )}

              <div className="form-section">
                <h4 className="form-section-title">Badge, roles &amp; visibility</h4>
                <div className="form-group-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="menu-badge">
                      Badge
                    </label>
                    <Input
                      id="menu-badge"
                      type="text"
                      value={editing.badge}
                      onChange={(event) => setField("badge", event.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="menu-badge-variant">
                      Badge variant
                    </label>
                    <select
                      id="menu-badge-variant"
                      className="form-select-field"
                      value={editing.badgeVariant}
                      disabled={!badgeVariantSupported}
                      onChange={(event) => setField("badgeVariant", event.target.value)}
                    >
                      {badgeVariantOptions.map((variant) => (
                        <option key={variant} value={variant}>
                          {variant}
                        </option>
                      ))}
                    </select>
                    {!badgeVariantSupported && (
                      <output className="form-hint">
                        This menu_items table has no badge_variant column, so a variant cannot be
                        stored yet.
                      </output>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="menu-roles">
                    Roles allowed (comma-separated)
                  </label>
                  <Input
                    id="menu-roles"
                    type="text"
                    value={editing.rolesAllowed}
                    onChange={(event) => setField("rolesAllowed", event.target.value)}
                  />
                </div>

                <div className="form-group">
                  <span className="form-label">Active</span>
                  <ActiveToggle
                    active={editing.isActive}
                    label={editing.title || "this menu item"}
                    onChange={(active) => setField("isActive", active)}
                  />
                </div>
              </div>

              <div className="form-section">
                <h4 className="form-section-title">Promo block</h4>
                <div className="form-group-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="menu-promo-title">
                      Promo title
                    </label>
                    <Input
                      id="menu-promo-title"
                      type="text"
                      value={editing.promoTitle}
                      onChange={(event) => setField("promoTitle", event.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="menu-promo-subtitle">
                      Promo subtitle
                    </label>
                    <Input
                      id="menu-promo-subtitle"
                      type="text"
                      value={editing.promoSubtitle}
                      onChange={(event) => setField("promoSubtitle", event.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="menu-promo-image">
                    Promo image URL
                  </label>
                  <Input
                    id="menu-promo-image"
                    type="text"
                    value={editing.promoImageUrl}
                    onChange={(event) => setField("promoImageUrl", event.target.value)}
                  />
                </div>

                <div className="form-group-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="menu-promo-cta-text">
                      Promo CTA text
                    </label>
                    <Input
                      id="menu-promo-cta-text"
                      type="text"
                      value={editing.promoCtaText}
                      onChange={(event) => setField("promoCtaText", event.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="menu-promo-cta-path">
                      Promo CTA path
                    </label>
                    <Input
                      id="menu-promo-cta-path"
                      type="text"
                      value={editing.promoCtaPath}
                      onChange={(event) => setField("promoCtaPath", event.target.value)}
                    />
                  </div>
                </div>
              </div>

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
                  {saving ? "Saving..." : "Save Menu Item"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={deleteTitle}
        message={
          descendants > 0
            ? "The entire subtree — every child item, hidden ones included — is deleted with it. This cannot be undone."
            : "This menu item has no children. This cannot be undone."
        }
        destructive
        pending={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
