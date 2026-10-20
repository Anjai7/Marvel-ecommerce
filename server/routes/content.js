import express from "express";
import { supabase } from "../db.js";
import { createCrudRouter, applyReorder } from "../lib/crudRouter.js";
import {
  adminGuards,
  includesInactive,
  inactiveRefused,
  isValidOrderValue,
  ORDER_INTEGER_MESSAGE,
} from "../lib/guards.js";
import {
  validateHeroSlide,
  validateBanner,
  validateFooterSection,
  validateFooterLink,
  validateCategory,
  slugify,
} from "../lib/validation.js";

const adminOnly = adminGuards;

const READ_ERROR = "Could not load content.";
const REORDER_ERROR = "Reorder must include every item in the scope.";
const GALLERY_ERROR = "gallery entries must be https URLs.";
const SECTION_TYPE_ERROR = "section_type must be one of: links, tags.";
const SECTION_ID_ERROR = "section_id is required.";

const HERO_FIELDS = [
  "badge",
  "title",
  "subtitle",
  "btn_text",
  "btn_path",
  "bg_image_url",
  "product_image_url",
  "fallback_image_url",
  "bg_gradient",
  "price_text",
  "tag",
  "ribbon_text",
  "order_index",
  "is_active",
];

const BANNER_FIELDS = [
  "placement",
  "variant",
  "badge",
  "title",
  "subtitle",
  "highlight",
  "description",
  "cta_text",
  "cta_path",
  "image_url",
  "bg_image_url",
  "fallback_image_url",
  "bg_gradient",
  "emoji",
  "code",
  "accent",
  "bg_color",
  "gallery",
  "display_order",
  "is_active",
  "starts_at",
  "ends_at",
];

const SECTION_FIELDS = ["heading", "section_type", "column_index", "display_order", "is_active"];
const LINK_FIELDS = ["section_id", "label", "href", "display_order", "is_active"];

const SECTION_TYPES = ["links", "tags"];

const isHttpsImage = (value) => typeof value === "string" && value.trim().startsWith("https://");

/** A present `display_order` must be a strict integer; the column is NOT NULL. */
function displayOrderError(body) {
  if (!Object.hasOwn(body, "display_order")) return null;
  return isValidOrderValue(body.display_order) ? null : ORDER_INTEGER_MESSAGE;
}

/** Banner validation plus the `gallery` array the shared validator leaves alone. */
function validateBannerRow(body = {}, opts = {}) {
  const error = validateBanner(body, opts);
  if (error) return error;

  if (body.gallery !== undefined) {
    if (!Array.isArray(body.gallery) || !body.gallery.every(isHttpsImage)) {
      return GALLERY_ERROR;
    }
  }
  return displayOrderError(body);
}

/** Footer section validation plus the DB CHECK the shared validator omits. */
function validateFooterSectionRow(body = {}, opts = {}) {
  const error = validateFooterSection(body, opts);
  if (error) return error;

  if (body.section_type !== undefined && !SECTION_TYPES.includes(body.section_type)) {
    return SECTION_TYPE_ERROR;
  }
  return displayOrderError(body);
}

/** Footer link validation plus the NOT NULL section_id the DB would reject. */
function validateFooterLinkRow(body = {}, opts = {}) {
  const error = validateFooterLink(body, opts);
  if (error) return error;

  const partial = opts.partial === true;
  if (!(partial && body.section_id === undefined)) {
    if (typeof body.section_id !== "string" || body.section_id.trim() === "") {
      return SECTION_ID_ERROR;
    }
  }
  return displayOrderError(body);
}

const sortByOrder = (a, b) => {
  const order = (a.display_order ?? 0) - (b.display_order ?? 0);
  if (order !== 0) return order;
  return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
};

/**
 * Build a `PATCH .../reorder` handler. `scopeColumn` narrows the complete id
 * set to one group (a banner placement, a footer link section); without it the
 * scope is every row in the table. Array order is authoritative and the
 * renumbered values are persisted to `orderColumn`.
 */
function makeReorderHandler({ table, orderColumn, label, scopeColumn = null }) {
  return async (req, res) => {
    const orders = req.body?.orders;
    const ids = Array.isArray(orders)
      ? orders.map((order) => (order && typeof order === "object" ? order.id : undefined))
      : [];

    if (!Array.isArray(orders) || ids.some((id) => typeof id !== "string" || id === "")) {
      return res.status(400).json({ error: REORDER_ERROR });
    }

    try {
      const { data, error } = await supabase
        .from(table)
        .select(scopeColumn ? `id, ${scopeColumn}` : "id");
      if (error) {
        console.error(`Supabase ${table} reorder read error:`, error.message);
        return res.status(500).json({ error: READ_ERROR });
      }

      const rows = data ?? [];
      const byId = new Map(rows.map((row) => [row.id, row]));
      const selected = ids.map((id) => byId.get(id));
      if (selected.some((row) => !row)) return res.status(400).json({ error: REORDER_ERROR });

      let scope = rows;
      if (scopeColumn) {
        const groups = new Set(selected.map((row) => row[scopeColumn] ?? null));
        if (groups.size !== 1) return res.status(400).json({ error: REORDER_ERROR });
        const group = [...groups][0];
        scope = rows.filter((row) => (row[scopeColumn] ?? null) === group);
      }

      const { renumbered, error: reorderError } = applyReorder(
        scope.map((row) => row.id),
        orders
      );
      if (reorderError) return res.status(400).json({ error: reorderError });

      for (const entry of renumbered) {
        // One UPDATE per row: non-atomic by design for this slice. A failure
        // midway leaves a partial ordering until the next complete reorder.
        const { error: updateError } = await supabase
          .from(table)
          .update({ [orderColumn]: entry.display_order })
          .eq("id", entry.id);
        if (updateError) {
          return res
            .status(500)
            .json({ error: updateError.message || `Failed to reorder ${label}.` });
        }
      }

      return res.json({ message: `${label} order updated successfully.` });
    } catch (thrown) {
      return res.status(500).json({ error: thrown.message || `Failed to reorder ${label}.` });
    }
  };
}

/** Public banner list; `?placement=` narrows it, `?includeInactive=1` needs an admin. */
async function listBanners(req, res) {
  const withInactive = await includesInactive(req, res);
  if (!withInactive && inactiveRefused(req, res)) return undefined;

  let query = supabase.from("promo_banners").select("*");
  if (typeof req.query.placement === "string" && req.query.placement !== "") {
    query = query.eq("placement", req.query.placement);
  }
  if (!withInactive) query = query.eq("is_active", true);

  try {
    const { data, error } = await query
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Supabase banners list error:", error.message);
      return res.status(500).json({ error: READ_ERROR });
    }
    return res.json({ banners: data ?? [] });
  } catch (thrown) {
    console.error("Supabase banners list exception:", thrown.message);
    return res.status(500).json({ error: READ_ERROR });
  }
}

/** Footer list: flat links plus each section's own nested links. */
async function listFooter(req, res) {
  const withInactive = await includesInactive(req, res);
  if (!withInactive && inactiveRefused(req, res)) return undefined;

  try {
    let sectionsQuery = supabase.from("footer_sections").select("*");
    if (!withInactive) sectionsQuery = sectionsQuery.eq("is_active", true);
    const sectionsResult = await sectionsQuery
      .order("display_order", { ascending: true })
      .order("column_index", { ascending: true });
    if (sectionsResult.error) {
      console.error("Supabase footer sections list error:", sectionsResult.error.message);
      return res.status(500).json({ error: READ_ERROR });
    }

    let linksQuery = supabase.from("footer_links").select("*");
    if (!withInactive) linksQuery = linksQuery.eq("is_active", true);
    const linksResult = await linksQuery.order("display_order", { ascending: true });
    if (linksResult.error) {
      console.error("Supabase footer links list error:", linksResult.error.message);
      return res.status(500).json({ error: READ_ERROR });
    }

    const sections = [...(sectionsResult.data ?? [])].sort(
      (a, b) => sortByOrder(a, b) || (a.column_index ?? 0) - (b.column_index ?? 0)
    );
    const links = [...(linksResult.data ?? [])].sort(sortByOrder);

    return res.json({
      sections: sections.map((section) => ({
        ...section,
        links: links.filter((link) => link.section_id === section.id),
      })),
      links,
    });
  } catch (thrown) {
    console.error("Supabase footer list exception:", thrown.message);
    return res.status(500).json({ error: READ_ERROR });
  }
}

const heroCrud = createCrudRouter({
  table: "hero_slides",
  fields: HERO_FIELDS,
  // hero_slides keeps order_index; the reorder body still speaks display_order.
  orderColumn: "order_index",
  validate: validateHeroSlide,
  resourceKey: "slide",
  listKey: "slides",
});

const bannerCrud = createCrudRouter({
  table: "promo_banners",
  fields: BANNER_FIELDS,
  orderColumn: "display_order",
  validate: validateBannerRow,
  resourceKey: "banner",
  listKey: "banners",
});

const sectionCrud = createCrudRouter({
  table: "footer_sections",
  fields: SECTION_FIELDS,
  orderColumn: "display_order",
  validate: validateFooterSectionRow,
  resourceKey: "section",
  listKey: "sections",
});

const linkCrud = createCrudRouter({
  table: "footer_links",
  fields: LINK_FIELDS,
  orderColumn: "display_order",
  validate: validateFooterLinkRow,
  resourceKey: "link",
  listKey: "links",
});

const contentRouter = express.Router();

// Before use("/hero"), or "reorder" is captured as an id.
contentRouter.patch(
  "/hero/reorder",
  ...adminOnly,
  makeReorderHandler({ table: "hero_slides", orderColumn: "order_index", label: "Hero slide" })
);
contentRouter.use("/hero", heroCrud);

// ---------------------------------------------------------------------------
// TEMPORARY category alias (removed in Task 15, when CategoriesTreeEditor
// replaces the old SiteCategoriesEditor). Until then the running storefront
// calls GET here and the old admin editor calls POST and DELETE here. All three
// read and write the new `categories` table; none of them touches the dropped
// `site_categories` table.
// ---------------------------------------------------------------------------

/** A Postgres unique-constraint violation, however the driver wraps it. */
function isUniqueViolation(error) {
  return (
    error?.code === "23505" ||
    (typeof error?.message === "string" &&
      error.message.includes("duplicate key value violates unique constraint"))
  );
}

const STORED_INCONSISTENT = "Stored category is inconsistent and cannot be saved.";
const DUPLICATE_SLUG = "A category with that slug already exists.";

/**
 * Coerce the columns an edit writes back from storage. A legacy row can hold a
 * null level, a stale order value or a non-string parent_id; answer a
 * validation error instead of handing Postgres a value that becomes a 500.
 */
function storedCategoryFields(row) {
  const level = Number(row.level);
  const parentId = row.parent_id ?? null;
  const displayOrder = row.display_order;

  const levelOk = Number.isInteger(level) && level >= 1 && level <= 3;
  const parentOk = parentId === null || typeof parentId === "string";
  const orderOk = typeof displayOrder === "number" && Number.isInteger(displayOrder);
  const activeOk = typeof row.is_active === "boolean";

  if (!levelOk || !parentOk || !orderOk || !activeOk) return null;
  return { level, parentId, displayOrder, isActive: row.is_active };
}

contentRouter.get("/categories", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("display_order");
    if (error) return res.status(500).json({ error: READ_ERROR });
    return res.json({ categories: data ?? [] });
  } catch (thrown) {
    console.error("Supabase category alias list exception:", thrown.message);
    return res.status(500).json({ error: READ_ERROR });
  }
});

contentRouter.post("/categories", ...adminOnly, async (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const isEdit = body.id !== undefined && body.id !== null;

  try {
    // The slug is the public URL segment and is independent of the display
    // name (spec §3.2), so an edit must reuse the stored slug, level, parent,
    // order and visibility instead of re-deriving them from the legacy payload.
    let existing = null;
    if (isEdit) {
      const { data, error } = await supabase
        .from("categories")
        .select("id, slug, level, parent_id, display_order, is_active")
        .eq("id", body.id)
        .maybeSingle();
      if (error) return res.status(500).json({ error: "Failed to load category." });
      if (!data) return res.status(404).json({ error: "category not found." });
      existing = data;
    }

    const stored = isEdit ? storedCategoryFields(existing) : null;
    if (isEdit && !stored) return res.status(400).json({ error: STORED_INCONSISTENT });

    const slug = isEdit ? existing.slug : (body.slug ?? slugify(body.name));

    // On an edit the stored level is authoritative, so the legacy payload's
    // level is neither written nor validated.
    const validationBody = { ...body, slug };
    if (isEdit) delete validationBody.level;
    const validationError = validateCategory(validationBody);
    if (validationError) return res.status(400).json({ error: validationError });

    // The old editor speaks `order_index`; the new table speaks `display_order`.
    // A spread row from GET already carries `display_order`, which wins so that a
    // visibility toggle does not reset the position to 0. An edit that omits both
    // keeps the stored order instead of resetting it to 0.
    const hasOrder = Object.hasOwn(body, "display_order") || Object.hasOwn(body, "order_index");
    const orderValue = Object.hasOwn(body, "display_order") ? body.display_order : body.order_index;
    if (hasOrder && !isValidOrderValue(orderValue)) {
      return res.status(400).json({ error: ORDER_INTEGER_MESSAGE });
    }

    const displayOrder = hasOrder ? Number(orderValue) : isEdit ? stored.displayOrder : 0;
    const isActive = body.is_active ?? (isEdit ? stored.isActive : true);

    const payload = {
      name: body.name,
      slug,
      image_url: body.image_url ?? null,
      is_active: isActive,
      display_order: displayOrder,
    };

    if (isEdit) {
      payload.id = body.id;
      payload.level = stored.level;
      payload.parent_id = stored.parentId;
    } else {
      payload.level = 1;
      payload.parent_id = null;
    }

    let result;
    try {
      result = await supabase.from("categories").upsert(payload).select();
    } catch (thrown) {
      // Some drivers throw constraint violations instead of returning them.
      if (isUniqueViolation(thrown)) return res.status(400).json({ error: DUPLICATE_SLUG });
      throw thrown;
    }

    const { data, error } = result;
    if (error) {
      if (isUniqueViolation(error)) return res.status(400).json({ error: DUPLICATE_SLUG });
      return res.status(500).json({ error: "Failed to save category." });
    }
    return res
      .status(201)
      .json({ message: "category saved successfully.", category: data?.[0] ?? null });
  } catch (thrown) {
    console.error("Supabase category alias save exception:", thrown.message);
    return res.status(500).json({ error: "Failed to save category." });
  }
});

contentRouter.delete("/categories/:id", ...adminOnly, async (req, res) => {
  try {
    // `parent_id` is ON DELETE CASCADE, and the legacy editor renders the whole
    // taxonomy flat, so refuse to delete a row that still has children.
    const { data: children, error: childrenError } = await supabase
      .from("categories")
      .select("id")
      .eq("parent_id", req.params.id);
    if (childrenError) return res.status(500).json({ error: "Failed to delete category." });
    if ((children ?? []).length > 0) {
      return res.status(400).json({ error: "Cannot delete a category that has subcategories." });
    }

    const { error } = await supabase.from("categories").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: "Failed to delete category." });
    return res.json({ message: "category deleted successfully." });
  } catch (thrown) {
    console.error("Supabase category alias delete exception:", thrown.message);
    return res.status(500).json({ error: "Failed to delete category." });
  }
});

export const bannerRoutes = express.Router();
bannerRoutes.get("/", listBanners);
bannerRoutes.patch(
  "/reorder",
  ...adminOnly,
  makeReorderHandler({
    table: "promo_banners",
    orderColumn: "display_order",
    label: "Banner",
    scopeColumn: "placement",
  })
);
bannerRoutes.use(bannerCrud);

export const footerRoutes = express.Router();
footerRoutes.get("/", listFooter);
footerRoutes.patch(
  "/sections/reorder",
  ...adminOnly,
  makeReorderHandler({ table: "footer_sections", orderColumn: "display_order", label: "Section" })
);
footerRoutes.patch(
  "/links/reorder",
  ...adminOnly,
  makeReorderHandler({
    table: "footer_links",
    orderColumn: "display_order",
    label: "Link",
    scopeColumn: "section_id",
  })
);
footerRoutes.use("/sections", sectionCrud);
footerRoutes.use("/links", linkCrud);

export default contentRouter;
