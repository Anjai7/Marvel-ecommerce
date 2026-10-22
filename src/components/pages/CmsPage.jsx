import React, { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { SectionRenderer } from "../../content/SectionRenderer";
import Footer from "../Footer";
import { apiFetchPageBySlug, normalisePagePayload } from "../../api/pagesApi";
import { apiFetchProducts } from "../../api/backendApi";
import { apiFetchCategoryTree } from "../../api/contentApi";
import SeoHead from "./SeoHead";

/**
 * The public CMS page: one slug, one page, its sections and the footer.
 *
 * The page is stored data, so the component is defensive throughout: a
 * missing page is a state, a failed request is a state, and a section that
 * cannot be rendered is handled by `SectionRenderer`.
 *
 * Two things are worth knowing:
 *
 *   1. **The footer is rendered here.** `<Footer />` lives in the storefront
 *      home, not in the app shell, so a page that forgets it silently loses
 *      the footer.
 *   2. **The references are resolved in one batch.** Every id of every section
 *      is collected first and the two catalogues are fetched once, so twelve
 *      sections cost two requests and not twenty-four.
 */

/** A trimmed string, or an empty string. */
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** The message of a failure, with the house fallback. */
function messageOf(error, fallback) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

/**
 * True when the page is being previewed.
 *
 * The admin opens `#/pages/<slug>?preview=1`. The query lives in the hash, so
 * the router drops it — the page reads it back from the address itself.
 */
function isPreviewRequest() {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash || "";
  const search = window.location.search || "";
  return /[?&]preview=1\b/.test(hash) || /[?&]preview=1\b/.test(search);
}

/**
 * Flatten the category tree and give every node its full path.
 *
 * A slug is unique only per parent, so a tile has to link at the whole
 * ancestor path. The tree knows the ancestors, so the path is built here.
 */
function flattenCategories(nodes, prefix = []) {
  const flat = [];

  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (!node || typeof node !== "object") continue;

    const slug = text(node.slug);
    const ancestors = slug ? [...prefix, slug] : prefix;
    const path = text(node.path) || ancestors.join("/");
    const { children, ...rest } = node;

    flat.push({ ...rest, path });
    if (Array.isArray(children)) flat.push(...flattenCategories(children, ancestors));
  }

  return flat;
}

/**
 * Every product and category id the page's sections refer to.
 *
 * The scan is by field rather than by section type, so a new section type
 * that names products is covered without touching this file.
 */
function collectReferences(sections) {
  const productIds = new Set();
  const categoryIds = new Set();
  const sourceCategoryIds = new Set();
  const sourceParentIds = new Set();

  let needsProducts = false;
  let needsCategories = false;
  let wantsEveryProduct = false;
  let wantsEveryCategory = false;

  for (const section of sections) {
    const data =
      section?.data && typeof section.data === "object" && !Array.isArray(section.data)
        ? section.data
        : {};
    const type = text(section?.type);

    const productIdList = Array.isArray(data.product_ids) ? data.product_ids : [];
    const categoryIdList = Array.isArray(data.category_ids) ? data.category_ids : [];
    const sourceCategory = text(data.source_category_id);
    const sourceParent = text(data.source_parent_id);

    for (const id of productIdList) {
      const value = text(id);
      if (value) productIds.add(value);
    }
    for (const id of categoryIdList) {
      const value = text(id);
      if (value) categoryIds.add(value);
    }
    if (sourceCategory) sourceCategoryIds.add(sourceCategory);
    if (sourceParent) sourceParentIds.add(sourceParent);

    if (type === "product_grid" || productIdList.length || sourceCategory) {
      needsProducts = true;
      // A section that names neither shows the newest arrivals, so it needs
      // the whole catalogue.
      if (!productIdList.length && !sourceCategory) wantsEveryProduct = true;
    }
    if (type === "category_grid" || categoryIdList.length || sourceParent) {
      needsCategories = true;
      if (!categoryIdList.length && !sourceParent) wantsEveryCategory = true;
    }
  }

  return {
    productIds,
    categoryIds,
    sourceCategoryIds,
    sourceParentIds,
    needsProducts,
    needsCategories,
    wantsEveryProduct,
    wantsEveryCategory,
  };
}

/** The products the page's sections may show. */
function selectProducts(allProducts, refs) {
  if (refs.wantsEveryProduct) return allProducts;

  return allProducts.filter((product) => {
    const id = text(product?.id);
    if (id && refs.productIds.has(id)) return true;

    if (!refs.sourceCategoryIds.size) return false;
    const categoryId = product?.category_id ?? product?.source_category_id ?? null;
    if (categoryId === null || categoryId === undefined) return false;
    return refs.sourceCategoryIds.has(String(categoryId));
  });
}

/** The categories the page's sections may show. */
function selectCategories(allCategories, refs) {
  if (refs.wantsEveryCategory) return allCategories;

  return allCategories.filter((category) => {
    const id = text(category?.id);
    if (id && refs.categoryIds.has(id)) return true;

    if (!refs.sourceParentIds.size) return false;
    const parentId = category?.parent_id ?? null;
    if (parentId === null || parentId === undefined) return false;
    return refs.sourceParentIds.has(String(parentId));
  });
}

/**
 * Resolve the products and the categories the sections refer to.
 *
 * The two catalogues are fetched once each, in parallel, and the ids are
 * filtered afterwards — the section decides what to show, this decides what
 * it is allowed to show.
 */
async function resolveReferences(sections) {
  const refs = collectReferences(sections);

  const [products, categoryTree] = await Promise.all([
    refs.needsProducts ? apiFetchProducts() : Promise.resolve([]),
    refs.needsCategories ? apiFetchCategoryTree() : Promise.resolve(null),
  ]);

  const allProducts = Array.isArray(products) ? products : [];
  const allCategories = flattenCategories(categoryTree?.categories);

  return {
    products: selectProducts(allProducts, refs),
    categories: selectCategories(allCategories, refs),
  };
}

/** The house state block: an icon, a title, a line of copy and an action. */
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

export default function CmsPage({ slug, onNavigate }) {
  // The loaded state belongs to the slug it was loaded for, so a new slug
  // shows the loading state again without the effect having to reset it.
  const [loaded, setLoaded] = useState({ key: null, status: "loading" });

  const goHome = () => {
    if (onNavigate) onNavigate("");
    else if (typeof window !== "undefined") window.location.hash = "#/";
  };

  useEffect(() => {
    let cancelled = false;
    const preview = isPreviewRequest();

    if (!slug) return undefined;

    apiFetchPageBySlug(slug, { preview })
      .then(async (payload) => {
        const { page, sections } = normalisePagePayload(payload);

        // The page is worth showing even when the catalogues are unreachable:
        // a section that has no products simply renders nothing.
        let references = { products: [], categories: [] };
        try {
          references = await resolveReferences(sections);
        } catch (error) {
          console.warn("[content] could not resolve the page references:", error);
        }

        if (cancelled) return;
        setLoaded({ key: slug, status: "ready", page, sections, preview, ...references });
      })
      .catch((error) => {
        if (cancelled) return;
        if (error?.status === 404) {
          setLoaded({ key: slug, status: "missing" });
          return;
        }
        setLoaded({
          key: slug,
          status: "error",
          message: messageOf(error, "Could not load this page."),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const state =
    loaded.key === (slug || "")
      ? loaded
      : { key: slug || "", status: slug ? "loading" : "missing" };

  if (state.status === "loading") {
    return (
      <StateBlock
        icon={<Loader2 size={32} className="animate-spin" color="#2563eb" />}
        title="Loading page…"
      />
    );
  }

  if (state.status === "missing") {
    return (
      <>
        <StateBlock
          icon={<AlertCircle size={32} color="#f59e0b" />}
          title="Page not found."
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
            No page matches the address <code>{slug}</code>.
          </p>
        </StateBlock>
        <Footer />
      </>
    );
  }

  if (state.status === "error") {
    return (
      <>
        <StateBlock
          icon={<AlertCircle size={32} color="#ef4444" />}
          title="Could not load this page."
        >
          <p style={{ fontSize: 14, color: "#64748b" }}>{state.message}</p>
        </StateBlock>
        <Footer />
      </>
    );
  }

  const { page, sections, products, categories } = state;

  return (
    <div id="cms-page">
      <SeoHead page={page} preview={state.preview === true} />

      {sections.map((section) => (
        <SectionRenderer
          key={section.id ?? section.type}
          section={section}
          products={products}
          categories={categories}
          onNavigate={onNavigate}
        />
      ))}

      <Footer />
    </div>
  );
}
