import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronRight, Home, Loader2 } from "lucide-react";
import { useContent } from "../../context/ContentContext";
import { apiFetchCategoryByPath } from "../../api/contentApi";
import { apiFetchProducts } from "../../api/backendApi";
import { apiFetchCategoryPage, normalisePagePayload } from "../../api/pagesApi";
import { SectionRenderer } from "../../content/SectionRenderer";
import CategoryListing from "./CategoryListing";
import SeoHead from "../pages/SeoHead";

/**
 * The category page: the category's own content, the custom page an editor
 * may have built for it and — always — a working product listing.
 *
 * Three rules hold everywhere:
 *
 *   1. **The custom page is optional.** A category without one is the normal
 *      case, and a page request that fails must not break the category: both
 *      fall back to the default content.
 *   2. **The listing always exists.** A `category_listing` section of the
 *      custom page renders the listing instead of the default one; without
 *      such a section the default listing renders.
 *   3. **Nothing is invented.** A missing SEO field falls back to the
 *      category's own name or description, and a missing listing setting
 *      falls back to the documented default.
 */

/** The sections that render products, and so need the catalogue of the category. */
const SECTIONS_WITH_PRODUCTS = new Set(["product_grid", "category_listing"]);

/** An empty, stable section list — the identity must not change between renders. */
const EMPTY_SECTIONS = [];

/** An empty, stable product list — the identity must not change between renders. */
const EMPTY_PRODUCTS = [];

/** The state of a category that has no custom page (yet). */
const EMPTY_CUSTOM = {
  categoryId: null,
  status: "loading",
  page: null,
  sections: EMPTY_SECTIONS,
  products: EMPTY_PRODUCTS,
};

/**
 * Find a category by its full ancestor path. The path is the identity: slugs
 * are unique only per parent, so a bare-slug lookup could return a different
 * category than the visitor clicked.
 */
function findInTree(tree, path) {
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const ancestors = [];
  let nodes = Array.isArray(tree) ? tree : [];
  let category = null;

  for (const segment of segments) {
    category = nodes.find((node) => node && node.slug === segment) ?? null;
    if (!category) return null;
    if (ancestors.length < segments.length - 1) ancestors.push(category);
    nodes = Array.isArray(category.children) ? category.children : [];
  }

  return { category, ancestors, children: category.children ?? [] };
}

function messageOf(error, fallback) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

/** A trimmed string, or an empty string. A blank value carries nothing. */
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The listing configuration of a category, read from the category's own
 * columns. A `pageSize` of `0` means "show every product", which is what a
 * category without a listing configuration does today.
 */
function listingConfigOf(category) {
  return {
    layout: category?.listing_layout ?? "grid",
    sort: category?.listing_sort ?? "newest",
    pageSize: category?.listing_page_size ?? 0,
  };
}

/**
 * The SEO of a category without a custom page.
 *
 * A null `meta_title` falls back to the category's name and a null
 * `meta_description` to the category's description — the two values the
 * category really carries. Nothing else is invented.
 */
function categorySeo(category) {
  return {
    title: text(category?.meta_title) || text(category?.name),
    description: text(category?.meta_description) || text(category?.description),
    seo: { canonical: text(category?.canonical_url) },
  };
}

function StateBlock({ icon, title, children, action }) {
  return (
    <div className="container" style={{ padding: "48px 16px", textAlign: "center" }}>
      {icon}
      <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "8px 0" }}>{title}</h2>
      {children}
      {action}
    </div>
  );
}

export default function CategoryPage({ path = "", onNavigate, onSelectProduct }) {
  const { categories, categoryTree, loading: contentLoading } = useContent();
  const [resolution, setResolution] = useState({ status: "loading" });
  // The custom page of the category and the products its sections may show.
  // `status` is "loading" until the request settles; a category without a
  // custom page is "none", not an error.
  const [custom, setCustom] = useState(EMPTY_CUSTOM);

  // Resolve locally first; the API is a fallback for a stale tree, never the
  // default. A 404 becomes the unknown-category state, not a bounce home.
  useEffect(() => {
    if (contentLoading) {
      setResolution({ status: "loading" });
      return undefined;
    }

    const local = findInTree(categoryTree, path);
    if (local) {
      setResolution({ status: "ready", ...local });
      return undefined;
    }

    let cancelled = false;
    setResolution({ status: "loading" });

    apiFetchCategoryByPath(path)
      .then((data) => {
        if (cancelled) return;
        const category = data?.category;
        if (!category) {
          setResolution({ status: "missing" });
          return;
        }
        setResolution({
          status: "ready",
          category,
          ancestors: Array.isArray(data.ancestors) ? data.ancestors : [],
          children: (Array.isArray(data.descendants) ? data.descendants : []).filter(
            (node) => node.level === category.level + 1
          ),
        });
      })
      .catch((error) => {
        if (cancelled) return;
        if (error?.status === 404) setResolution({ status: "missing" });
        else {
          setResolution({
            status: "error",
            message: messageOf(error, "Could not load this category."),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [path, categoryTree, contentLoading]);

  const categoryId = resolution.status === "ready" ? (resolution.category?.id ?? null) : null;

  // The custom page of the category. A category without one is a normal case,
  // and a failed request falls back to the default content — neither breaks
  // the page.
  useEffect(() => {
    if (!categoryId) return undefined;

    let cancelled = false;

    apiFetchCategoryPage(categoryId)
      .then((payload) => {
        if (cancelled) return;
        if (!payload) {
          setCustom({ ...EMPTY_CUSTOM, categoryId, status: "none" });
          return;
        }
        const { page, sections } = normalisePagePayload(payload);
        setCustom({ categoryId, status: "ready", page, sections, products: EMPTY_PRODUCTS });
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn("[category] the custom page could not be loaded:", error);
        setCustom({ ...EMPTY_CUSTOM, categoryId, status: "none" });
      });

    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  // The page of the category that is on screen: a page that belongs to
  // another category never leaks into this one.
  const current = custom.categoryId === categoryId ? custom : EMPTY_CUSTOM;

  // The products the sections may show are fetched only when a section needs
  // them, so a category page without custom content costs one request.
  useEffect(() => {
    const needsProducts = current.sections.some((section) =>
      SECTIONS_WITH_PRODUCTS.has(section?.type)
    );
    if (!needsProducts) return undefined;

    let cancelled = false;

    apiFetchProducts({ categoryPath: path })
      .then((items) => {
        if (cancelled) return;
        setCustom((previous) =>
          previous.categoryId === categoryId
            ? { ...previous, products: Array.isArray(items) ? items : EMPTY_PRODUCTS }
            : previous
        );
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn("[category] the products of the sections could not be loaded:", error);
        setCustom((previous) =>
          previous.categoryId === categoryId ? { ...previous, products: EMPTY_PRODUCTS } : previous
        );
      });

    return () => {
      cancelled = true;
    };
  }, [current.sections, path, categoryId]);

  // A listing section of the custom page renders the listing; without one the
  // default listing renders, so a category always has a product listing.
  const hasListingSection = current.sections.some(
    (section) => section?.type === "category_listing"
  );

  // The listing configuration comes from the category's own columns.
  const listingConfig = useMemo(() => listingConfigOf(resolution.category), [resolution.category]);

  // The custom page's own SEO wins; without a custom page the category's own
  // SEO fields drive the head.
  const seoPage = useMemo(
    () => (current.page ? current.page : categorySeo(resolution.category)),
    [current.page, resolution.category]
  );

  const goHome = () => {
    if (onNavigate) onNavigate("");
    else window.location.hash = "#/";
  };

  const openChild = (child) => {
    const childPath = `${path}/${child.slug}`.replace(/^\/+/, "");
    if (onNavigate) onNavigate(`/category/${childPath}`);
    else window.location.hash = `#/category/${childPath}`;
  };

  if (resolution.status === "loading") {
    return (
      <StateBlock
        icon={<Loader2 size={32} className="animate-spin" color="#2563eb" />}
        title="Loading category…"
      />
    );
  }

  if (resolution.status === "missing") {
    return (
      <StateBlock
        icon={<AlertCircle size={32} color="#f59e0b" />}
        title="Category not found."
        action={
          <button
            type="button"
            onClick={goHome}
            style={{
              marginTop: 12,
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Back to home
          </button>
        }
      >
        <p style={{ fontSize: 14, color: "#64748b" }}>
          No category matches the address <code>{path}</code>.
        </p>
      </StateBlock>
    );
  }

  if (resolution.status === "error") {
    return (
      <StateBlock
        icon={<AlertCircle size={32} color="#ef4444" />}
        title="Could not load this category."
      >
        <p style={{ fontSize: 14, color: "#64748b" }}>{resolution.message}</p>
      </StateBlock>
    );
  }

  const { category, ancestors, children } = resolution;

  return (
    <div id="category-page">
      <SeoHead page={seoPage} />

      <div className="pvp-breadcrumb-wrap">
        <div className="container">
          <nav className="pvp-breadcrumb" aria-label="Breadcrumb">
            <button type="button" className="pvp-bc-link" onClick={goHome}>
              <Home size={13} /> Home
            </button>
            {[...(ancestors ?? []), category].map((node) => (
              <span
                key={node.id ?? node.slug}
                style={{ display: "inline-flex", alignItems: "center" }}
              >
                <span className="pvp-bc-sep" aria-hidden="true">
                  /
                </span>
                <span className="pvp-bc-link">{node.name}</span>
              </span>
            ))}
          </nav>
        </div>
      </div>

      {/* The custom page of the category: its sections sit above the default
          content of the category. */}
      {current.sections.map((section) => (
        <SectionRenderer
          key={section.id ?? section.type}
          section={section}
          products={current.products}
          categories={categories}
        />
      ))}

      <div className="container" style={{ padding: "28px 16px 0" }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
          {category.name}
        </h1>
        {category.description && (
          <p style={{ fontSize: 15, color: "#475569", maxWidth: 720 }}>{category.description}</p>
        )}

        {children.length > 0 && (
          <nav
            aria-label="Subcategories"
            style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18 }}
          >
            {children.map((child) => (
              <button
                key={child.id ?? child.slug}
                type="button"
                onClick={() => openChild(child)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  color: "#0f172a",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {child.name}
                <ChevronRight size={13} style={{ verticalAlign: "middle" }} />
              </button>
            ))}
          </nav>
        )}
      </div>

      <div className="container" style={{ padding: "24px 16px 48px" }}>
        {!hasListingSection && (
          <CategoryListing path={path} config={listingConfig} onSelectProduct={onSelectProduct} />
        )}
      </div>
    </div>
  );
}
