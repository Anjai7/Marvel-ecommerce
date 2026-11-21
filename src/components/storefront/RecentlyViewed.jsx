import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { apiFetchProductById } from "../../api/backendApi";
import ProductCard from "../ProductCard";
import { navigateToPath } from "../../lib/routes";

/**
 * The products this browser has actually opened, newest first.
 *
 * The old "Frequently visited" rail showed featured products and called them
 * visited. This one records the product id when the page opens and looks the
 * products up again, so a returning visitor sees the things they looked at.
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

/** Records a view. Called by the product page when its id changes. */
export function recordProductView(productId) {
  if (!productId) return;
  const next = [productId, ...readIds().filter((id) => id !== productId)].slice(0, LIMIT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // private browsing — the rail simply stays empty
  }
}

export default function RecentlyViewed({ currentId }) {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const ids = readIds().filter((id) => id !== currentId);
    if (ids.length === 0) {
      setProducts([]);
      return undefined;
    }
    let cancelled = false;
    Promise.all(ids.map((id) => apiFetchProductById(id).catch(() => null))).then((rows) => {
      if (!cancelled) setProducts(rows.filter(Boolean));
    });
    return () => {
      cancelled = true;
    };
  }, [currentId]);

  if (products.length === 0) return null;

  return (
    <section className="recently-viewed" aria-labelledby="recently-viewed-title">
      <div className="container">
        <div className="recently-viewed-head">
          <h2 id="recently-viewed-title">
            <Eye size={18} aria-hidden="true" /> Recently viewed
          </h2>
          <button type="button" onClick={() => navigateToPath("/account")}>
            Your account
          </button>
        </div>
        <div className="recently-viewed-track">
          {products.map((product) => (
            <div className="recently-viewed-item" key={product.id}>
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
