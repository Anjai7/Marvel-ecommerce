// ====================================================
// SEED THE CONTENT TABLES FROM THE EXISTING REPO CONTENT
//
//   npm run seed:content
//
// Idempotent and non-destructive:
//   * every row carries a deterministic literal UUID, so the upsert key
//     (`onConflict: "id"`) targets the same row on every run;
//   * nothing is deleted, truncated or re-keyed;
//   * a second run produces exactly the same payload as the first.
//
// Sources (verbatim copy, no invented marketing copy):
//   * categories  — the live `menu_items` mega-menu tree. The category id IS
//                   the menu item id, so this is a no-op on a database seeded
//                   by migration 20261020000008 and a repair path if a
//                   category is missing.
//   * banners     — bannerLayoutData, promoCarouselSlides and
//                   promoBannersData from src/data.js.
//   * footer      — COLS and SEARCH_TAGS from src/components/Footer.jsx.
//
// `categories.show_in_homepage` is deliberately NOT written here: the
// migration owns that column, and a seed must not clear an admin's choice.
// The same applies to description, icon, image_url and banner_image_url.
// ====================================================

import { pathToFileURL } from "node:url";
import { supabase } from "./db.js";

/** Prefixes of the fixed menu ids the 3-level mega-menu seed uses. */
const MEGA_MENU_PREFIXES = ["d1c", "d2c", "d3c"];

const BANNER_ID_PREFIX = "b1";
const SECTION_ID_PREFIX = "f1";
const LINK_ID_PREFIX = "f2";

/**
 * A stable row id. `seedId("b1", 1)` -> b1000000-0000-4000-8000-000000000001,
 * so a reviewer can recognise a seeded row and a re-run targets the same one.
 */
export function seedId(prefix, index) {
  return `${prefix}000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

/** The last path segment as a slug; mirrors the SQL regexp in migration 8. */
export function slugFromPath(path) {
  if (typeof path !== "string" || path === "") return "";
  return path
    .replace(/^.*\//, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");
}

function isMegaMenuRow(row) {
  return (
    row &&
    typeof row.id === "string" &&
    MEGA_MENU_PREFIXES.some((prefix) => row.id.startsWith(prefix))
  );
}

function toInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

/**
 * Map the live menu rows to category rows. Only the fixed-id mega-menu rows are
 * taxonomy: the six legacy flat navigation rows keep `category_id IS NULL` and
 * must never be copied in. Level is preserved and the rows are returned in
 * level order so the caller can upsert level by level.
 */
export function buildCategorySeeds(menuRows = []) {
  return menuRows
    .filter(isMegaMenuRow)
    .map((row) => ({
      id: row.id,
      name: row.title,
      slug: slugFromPath(row.path),
      parent_id: row.parent_id ?? null,
      level: toInteger(row.level, 1),
      display_order: toInteger(row.order_index, 0),
      is_active: row.is_active ?? true,
      show_in_nav: true,
    }))
    .sort(
      (left, right) =>
        left.level - right.level ||
        left.display_order - right.display_order ||
        left.id.localeCompare(right.id)
    );
}

/**
 * The homepage banner layout (1 large + 2 small slots). Copy and images come
 * from `bannerLayoutData`; `btn` becomes `cta_text` and the target is the
 * category root the button has always pointed at.
 */
const BANNER_LAYOUT_SEEDS = [
  {
    variant: "large",
    title: "Make Your Home Beautiful",
    subtitle: "Up to 40% Off on Home Essentials",
    cta_text: "Shop Home",
    cta_path: "/category/home-and-kitchen",
    image_url:
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=750&h=520&fit=crop&q=85",
  },
  {
    variant: "small",
    title: "Style That Speaks",
    subtitle: "Up to 60% Off on Fashion",
    cta_text: "Shop Fashion",
    cta_path: "/category/fashion",
    image_url:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&h=252&fit=crop&q=85",
  },
  {
    variant: "small",
    title: "Beauty for You",
    subtitle: "Up to 50% Off on Beauty",
    cta_text: "Shop Beauty",
    cta_path: "/category/beauty",
    image_url:
      "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500&h=252&fit=crop&q=85",
  },
];

/** The promo carousel, copied from `promoCarouselSlides`. */
const PROMO_CAROUSEL_SEEDS = [
  {
    badge: "🔥 Limited Time Offer",
    title: "End of Season Sale",
    highlight: "Up to 70% Off",
    description: "Grab the best deals across all categories before they're gone!",
    cta_text: "Shop Now",
    gallery: [
      "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=220&h=220&fit=crop",
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=220&h=220&fit=crop",
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=220&h=220&fit=crop",
    ],
  },
  {
    badge: "⚡ Flash Sale",
    title: "Electronics Mega Sale",
    highlight: "Up to 65% Off",
    description: "Best prices on top electronics brands — today only!",
    cta_text: "Shop Electronics",
    gallery: [
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=220&h=220&fit=crop",
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=220&h=220&fit=crop",
      "https://images.unsplash.com/photo-1593784991095-a205069470b6?w=220&h=220&fit=crop",
    ],
  },
  {
    badge: "👗 Fashion Week",
    title: "Style Redefined",
    highlight: "Up to 80% Off on Fashion",
    description: "New season styles from top brands at unbeatable prices.",
    cta_text: "Shop Fashion",
    gallery: [
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=220&h=220&fit=crop",
      "https://images.unsplash.com/photo-1562157873-818bc0726f68?w=220&h=220&fit=crop",
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=220&h=220&fit=crop",
    ],
  },
];

/** The promo strip, copied from `promoBannersData`. */
const PROMO_STRIP_SEEDS = [
  {
    title: "Big Savings Days",
    subtitle: "Up to 70% Off",
    bg_color: "#fff7ed",
    accent: "#f97316",
    emoji: "🛍️",
    code: null,
    cta_text: "Shop Now",
  },
  {
    title: "Extra 10% Off",
    subtitle: "On Prepaid Orders",
    bg_color: "#f0fdf4",
    accent: "#16a34a",
    emoji: "💳",
    code: "PREPAID10",
    cta_text: "Avail Offer",
  },
  {
    title: "No Cost EMI",
    subtitle: "Up to 12 Months",
    bg_color: "#eff6ff",
    accent: "#2563eb",
    emoji: "📅",
    code: null,
    cta_text: "Know More",
  },
];

const BANNER_COMMON = { is_active: true };

/**
 * The nine banners: 1 large + 2 small `home_banner_layout` rows, 3
 * `home_promo_carousel` rows and 3 `promo_strip` rows, in display order within
 * their placement. Field names are the `promo_banners` columns, not the
 * client-side names from src/data.js.
 */
export function buildBannerSeeds() {
  const rows = [];

  BANNER_LAYOUT_SEEDS.forEach((banner, index) => {
    rows.push({
      id: seedId(BANNER_ID_PREFIX, index + 1),
      placement: "home_banner_layout",
      ...BANNER_COMMON,
      ...banner,
      display_order: index,
    });
  });

  PROMO_CAROUSEL_SEEDS.forEach((banner, index) => {
    rows.push({
      id: seedId(BANNER_ID_PREFIX, BANNER_LAYOUT_SEEDS.length + index + 1),
      placement: "home_promo_carousel",
      variant: "standard",
      ...BANNER_COMMON,
      ...banner,
      display_order: index,
    });
  });

  PROMO_STRIP_SEEDS.forEach((banner, index) => {
    rows.push({
      id: seedId(
        BANNER_ID_PREFIX,
        BANNER_LAYOUT_SEEDS.length + PROMO_CAROUSEL_SEEDS.length + index + 1
      ),
      placement: "promo_strip",
      variant: "standard",
      ...BANNER_COMMON,
      ...banner,
      display_order: index,
    });
  });

  return rows;
}

/**
 * Footer columns copied from `Footer.jsx` COLS. The component rendered every
 * anchor with `href="#"`; a `#` is not a valid href per the API contract
 * (https URL or site-relative path), so each label keeps its verbatim text and
 * gets the site-relative destination it has always meant.
 */
const FOOTER_COLUMNS = [
  {
    heading: "Customer Support",
    links: [
      ["Help Center", "/help"],
      ["Contact Us", "/contact"],
      ["Returns & Refunds", "/returns"],
      ["Shipping Information", "/shipping"],
      ["Track Order", "/track-order"],
      ["Support Chat", "/support"],
    ],
  },
  {
    heading: "Policy & Legal",
    links: [
      ["Privacy Policy", "/privacy"],
      ["Terms of Service", "/terms"],
      ["Return Policy", "/returns-policy"],
      ["Cancellation Policy", "/cancellation-policy"],
      ["E-Waste Policy", "/ewaste-policy"],
      ["Security", "/security"],
    ],
  },
  {
    heading: "My Account",
    links: [
      ["My Profile", "/account"],
      ["Orders & History", "/orders"],
      ["Saved Wishlist", "/wishlist"],
      ["Manage Addresses", "/account/addresses"],
      ["Marvel Club Points", "/account/rewards"],
      ["Notifications", "/account/notifications"],
    ],
  },
  {
    heading: "Popular Categories",
    links: [
      ["Mobiles & Tablets", "/category/electronics/mobiles"],
      ["Laptops & PCs", "/category/electronics/computers"],
      ["Smartwatches", "/category/accessories/watches/smartwatches"],
      ["Audio & Headphones", "/category/electronics/audio"],
      ["Men's & Women's Fashion", "/category/fashion"],
      ["Home & Kitchen", "/category/home-and-kitchen"],
    ],
  },
];

/** SEARCH_TAGS from Footer.jsx, verbatim. */
const SEARCH_TAGS = [
  "iPhone 15",
  "Smart TVs",
  "Wireless Earbuds",
  "Running Shoes",
  "Gaming Laptops",
  "Air Fryers",
  "Bluetooth Speakers",
  "Power Banks",
  "Smartwatches",
  "Backpacks",
];

/** `Men's Fashion` -> men-s-fashion; `iPhone 15` -> iphone-15. */
export function searchSlug(tag) {
  return String(tag)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The five footer sections with their nested links: four `links` columns of 6
 * and the `tags` block of 10, 34 links in total. Section and link ids are
 * deterministic, so each link is updated in place instead of duplicated.
 */
export function buildFooterSeeds() {
  const sections = [];
  const links = [];
  let linkIndex = 0;

  FOOTER_COLUMNS.forEach((column, columnIndex) => {
    const sectionId = seedId(SECTION_ID_PREFIX, columnIndex + 1);
    sections.push({
      id: sectionId,
      heading: column.heading,
      section_type: "links",
      column_index: columnIndex,
      display_order: columnIndex,
      is_active: true,
    });

    column.links.forEach(([label, href], order) => {
      linkIndex += 1;
      links.push({
        id: seedId(LINK_ID_PREFIX, linkIndex),
        section_id: sectionId,
        label,
        href,
        display_order: order,
        is_active: true,
      });
    });
  });

  const tagsIndex = FOOTER_COLUMNS.length;
  const tagsSectionId = seedId(SECTION_ID_PREFIX, tagsIndex + 1);
  sections.push({
    id: tagsSectionId,
    heading: "Popular Searches",
    section_type: "tags",
    column_index: 0,
    display_order: tagsIndex,
    is_active: true,
  });

  SEARCH_TAGS.forEach((tag, order) => {
    linkIndex += 1;
    links.push({
      id: seedId(LINK_ID_PREFIX, linkIndex),
      section_id: tagsSectionId,
      label: tag,
      href: `/search?q=${searchSlug(tag)}`,
      display_order: order,
      is_active: true,
    });
  });

  return sections.map((section) => ({
    ...section,
    links: links.filter((link) => link.section_id === section.id),
  }));
}

/**
 * Resolve one display label to exactly ONE category id, or null.
 * Order: lowest level, then lowest display_order, then id. That is what makes
 * `Accessories` (a root plus a child under Electronics and under Fashion)
 * deterministic, and it is the same rule the migration uses for the
 * products.category_id backfill. Never returns more than one id.
 */
export function resolveProductCategory(categoryName, categories = []) {
  if (typeof categoryName !== "string" || categoryName.trim() === "") return null;
  const needle = categoryName.trim().toLowerCase();

  const matches = categories.filter(
    (category) =>
      category && typeof category.name === "string" && category.name.trim().toLowerCase() === needle
  );
  if (matches.length === 0) return null;

  matches.sort(
    (left, right) =>
      toInteger(left.level, 1) - toInteger(right.level, 1) ||
      toInteger(left.display_order, 0) - toInteger(right.display_order, 0) ||
      String(left.id).localeCompare(String(right.id))
  );
  return matches[0].id;
}

async function readMenuRows() {
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, title, path, parent_id, level, order_index, is_active")
    .order("order_index", { ascending: true });

  if (error) throw new Error(`Could not read menu_items: ${error.message}`);
  return data ?? [];
}

async function upsertRows(table, rows) {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`Could not upsert ${table}: ${error.message}`);
}

/**
 * Upsert every content row. Categories are written level by level so a
 * level-2 row never reaches the immediate self-referencing FK before its
 * level-1 parent exists.
 */
export async function seedContent() {
  const menuRows = await readMenuRows();
  const categorySeeds = buildCategorySeeds(menuRows);

  for (const level of [1, 2, 3]) {
    await upsertRows(
      "categories",
      categorySeeds.filter((row) => row.level === level)
    );
  }

  const bannerSeeds = buildBannerSeeds();
  await upsertRows("promo_banners", bannerSeeds);

  const footerSections = buildFooterSeeds();
  const footerLinks = footerSections.flatMap((section) => section.links);
  const sectionRows = footerSections.map((section) => ({
    id: section.id,
    heading: section.heading,
    section_type: section.section_type,
    column_index: section.column_index,
    display_order: section.display_order,
    is_active: section.is_active,
  }));
  await upsertRows("footer_sections", sectionRows);
  await upsertRows("footer_links", footerLinks);

  return {
    categories: categorySeeds.length,
    banners: bannerSeeds.length,
    sections: footerSections.length,
    links: footerLinks.length,
  };
}

const isDirectRun =
  typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  seedContent()
    .then((counts) => {
      console.log("🌱 Content seeded:", counts);
    })
    .catch((error) => {
      console.error(`❌ seed:content failed: ${error.message}`);
      process.exitCode = 1;
    });
}
