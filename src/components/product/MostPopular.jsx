import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { apiFetchProducts } from "../../api/backendApi";
import ProductCard from "../ProductCard";
import { navigateToPath } from "../../lib/routes";

/**
 * The best-rated products in the catalogue.
 *
 * There is no sales feed, so this does not claim "best selling". It takes a
 * page of products and ranks them by review count and then rating — the
 * basis is written in the heading so the list does not read as an ad.
 */
export default function MostPopular({ currentId }) {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    apiFetchProducts({ limit: 24 })
      .then((rows) => {
        if (cancelled || !Array.isArray(rows)) return;
        const ranked = rows
          .filter((row) => row && String(row.id) !== String(currentId))
          .slice()
          .sort((a, b) => {
            const reviews = (Number(b.reviews_count) || 0) - (Number(a.reviews_count) || 0);
            if (reviews !== 0) return reviews;
            return (Number(b.rating) || 0) - (Number(a.rating) || 0);
          })
          .slice(0, 6);
        setProducts(ranked);
      })
      .catch(() => !cancelled && setProducts([]));
    return () => {
      cancelled = true;
    };
  }, [currentId]);

  if (products.length === 0) return null;

  return (
    <section className="most-popular" aria-labelledby="most-popular-title">
      <div className="container">
        <div className="most-popular-head">
          <h2 id="most-popular-title">
            <Flame size={18} aria-hidden="true" /> Most popular
          </h2>
          <p>Highest rated by customer reviews</p>
        </div>
        <div className="most-popular-grid">
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
