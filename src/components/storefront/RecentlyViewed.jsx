import { useEffect, useState } from "react";
import { Eye, X } from "lucide-react";
import { apiFetchProductById } from "../../api/backendApi";
import ProductCard from "../ProductCard";
import { navigateToPath } from "../../lib/routes";

/**
 * The products this browser has actually opened, newest first.
 *
 * The old rail showed featured products and called them visited. This one
 * records the product id when the page opens and looks the products up again,
 * so a returning visitor sees the things they looked at. The history belongs
 * to the browser, and the customer can clear all of it or one entry.
 */
const STORAGE_KEY = "marvel_recently_viewed";
const LIMIT = 8;

function readIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === "string").slice(0, LIMIT)
      : [];
  } catch {
    return [];
  }
}

function writeIds(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // private browsing — the rail simply stays empty
  }
}

/** Records a view. Called by the product page when its id changes. */
export function recordProductView(productId) {
  if (!productId) return;
  writeIds([productId, ...readIds().filter((id) => id !== productId)].slice(0, LIMIT));
}

export function clearRecentViews() {
  writeIds([]);
}

export function forgetRecentView(productId) {
  writeIds(readIds().filter((id) => id !== productId));
}

export default function RecentlyViewed({ currentId }) {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const next = readIds().filter((id) => id !== currentId);
    if (next.length === 0) {
      setProducts([]);
      return undefined;
    }
    let cancelled = false;
    Promise.all(next.map((id) => apiFetchProductById(id).catch(() => null))).then((rows) => {
      if (!cancelled) setProducts(rows.filter(Boolean));
    });
    return () => {
      cancelled = true;
    };
  }, [currentId]);

  if (products.length === 0) return null;

  const clearAll = () => {
    clearRecentViews();
    setProducts([]);
  };

  const removeOne = (id) => {
    forgetRecentView(id);
    setProducts((current) => current.filter((product) => String(product.id) !== String(id)));
  };

  return (
    <section className="recently-viewed" aria-labelledby="recently-viewed-title">
      <div className="container">
        <div className="recently-viewed-head">
          <h2 id="recently-viewed-title">
            <Eye size={18} aria-hidden="true" /> Recently viewed
          </h2>
          <button type="button" onClick={clearAll}>
            Clear history
          </button>
        </div>
        <div className="recently-viewed-track">
          {products.map((product) => (
            <div className="recently-viewed-item" key={product.id}>
              <button
                type="button"
                className="recently-viewed-remove"
                onClick={() => removeOne(product.id)}
                aria-label={`Remove ${product.title} from recently viewed`}
              >
                <X size={13} aria-hidden="true" />
              </button>
              <ProductCard
                product={product}
                onNavigate={() => navigateToPath(`/product/${product.id}`)}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
