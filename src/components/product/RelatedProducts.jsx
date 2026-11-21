import { useEffect, useState } from "react";
import { apiFetchProducts } from "../../api/backendApi";
import ProductCard from "../ProductCard";
import { navigateToPath } from "../../lib/routes";

/**
 * More products in the same category as the one being viewed.
 *
 * There is no purchase graph yet, so this does not claim "customers also
 * bought". It asks the catalogue for the same category label and leaves the
 * current product out — an honest, useful next thing to look at.
 */
export default function RelatedProducts({ category, currentId }) {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    if (!category) {
      setProducts([]);
      return undefined;
    }
    let cancelled = false;
    apiFetchProducts({ category, limit: 12 })
      .then((rows) => {
        if (cancelled || !Array.isArray(rows)) return;
        setProducts(rows.filter((row) => row && String(row.id) !== String(currentId)).slice(0, 6));
      })
      .catch(() => !cancelled && setProducts([]));
    return () => {
      cancelled = true;
    };
  }, [category, currentId]);

  if (products.length === 0) return null;

  return (
    <section className="related-products" aria-labelledby="related-products-title">
      <div className="container">
        <h2 id="related-products-title">More in {category}</h2>
        <div className="related-products-grid">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onNavigate={() => navigateToPath(`/product/${product.id}`)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
