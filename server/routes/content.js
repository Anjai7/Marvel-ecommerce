import express from "express";
import { supabase } from "../db.js";
import { createCrudRouter, applyReorder } from "../lib/crudRouter.js";
import { verifyToken, requireRole } from "../middleware/auth.js";
import {
  validateHeroSlide,
  validateBanner,
  validateFooterSection,
  validateFooterLink,
} from "../lib/validation.js";

const ADMIN_ROLES = ["admin", "super_admin"];
const adminOnly = [verifyToken, requireRole(ADMIN_ROLES)];

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

/** Run verifyToken then requireRole; a guard that answers parks the chain. */
function adminChain(req, res, next) {
  verifyToken(req, res, (error) => {
    if (error) return next(error);
    return requireRole(ADMIN_ROLES)(req, res, next);
  });
}

/** True when the request asks for inactive rows and carries an admin token. */
function includesInactive(req, res) {
  if (!Object.hasOwn(req.query, "includeInactive")) return false;
  if (["0", "false", "off"].includes(String(req.query.includeInactive).toLowerCase())) {
    return false;
  }

  let allowed = false;
  adminChain(req, res, () => {
    allowed = true;
  });
  // A guard that answered instead of calling next() has already sent the
  // 401/403; `allowed` stays false and the caller skips the query.
  return allowed && !res.headersSent;
}

/** True when the request asked for inactive rows but the guard refused it. */
function inactiveRefused(req, res) {
  return Object.hasOwn(req.query, "includeInactive") && res.headersSent;
}

const isHttpsImage = (value) => typeof value === "string" && value.trim().startsWith("https://");

/** Banner validation plus the `gallery` array the shared validator leaves alone. */
function validateBannerRow(body = {}, opts = {}) {
  const error = validateBanner(body, opts);
  if (error) return error;

  if (body.gallery !== undefined) {
    if (!Array.isArray(body.gallery) || !body.gallery.every(isHttpsImage)) {
      return GALLERY_ERROR;
    }
  }
  return null;
}

/** Footer section validation plus the DB CHECK the shared validator omits. */
function validateFooterSectionRow(body = {}, opts = {}) {
  const error = validateFooterSection(body, opts);
  if (error) return error;

  if (body.section_type !== undefined && !SECTION_TYPES.includes(body.section_type)) {
    return SECTION_TYPE_ERROR;
  }
  return null;
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
  return null;
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
  const withInactive = includesInactive(req, res);
  if (inactiveRefused(req, res) && !withInactive) return undefined;

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
  const withInactive = includesInactive(req, res);
  if (inactiveRefused(req, res) && !withInactive) return undefined;

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

// TEMPORARY (removed in Task 13): the storefront still calls the old path.
contentRouter.get("/categories", async (req, res) => {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("display_order");
  if (error) return res.status(500).json({ error: error.message });
  res.json({ categories: data ?? [] });
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
