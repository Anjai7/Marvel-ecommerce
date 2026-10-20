import { useEffect, useState } from "react";
import { AlertCircle, ChevronRight, Home, Loader2 } from "lucide-react";
import ProductCard from "../ProductCard";
import { useContent } from "../../context/ContentContext";
import { apiFetchCategoryByPath } from "../../api/contentApi";
import { apiFetchProducts } from "../../api/backendApi";

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
  const { categoryTree, loading: contentLoading } = useContent();
  const [resolution, setResolution] = useState({ status: "loading" });
  const [products, setProducts] = useState({ loading: true, error: null, items: [] });

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

  // The server resolves the path exactly and expands to every descendant.
  useEffect(() => {
    let cancelled = false;
    setProducts({ loading: true, error: null, items: [] });

    apiFetchProducts({ categoryPath: path })
      .then((items) => {
        if (cancelled) return;
        setProducts({ loading: false, error: null, items: Array.isArray(items) ? items : [] });
      })
      .catch((error) => {
        if (cancelled) return;
        setProducts({
          loading: false,
          error: messageOf(error, "Could not load products."),
          items: [],
        });
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

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
    <div className="category-page" id="category-page">
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
                className="category-chip"
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
        {products.loading ? (
          <p style={{ fontSize: 14, color: "#64748b" }}>Loading products…</p>
        ) : products.error ? (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
              Could not load products.
            </h2>
            <p style={{ fontSize: 14, color: "#64748b" }}>{products.error}</p>
          </div>
        ) : products.items.length === 0 ? (
          <p style={{ fontSize: 14, color: "#64748b" }}>No products in this category yet.</p>
        ) : (
          <div className="product-grid">
            {products.items.map((product) => (
              <ProductCard key={product.id} product={product} onNavigate={onSelectProduct} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
