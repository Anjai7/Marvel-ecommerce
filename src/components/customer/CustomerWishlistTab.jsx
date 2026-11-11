import { Heart, ShoppingBag } from "lucide-react";
import { Button } from "../ui";
import { formatCurrency } from "../../lib/currency";
import "./customer-portal.css";

/**
 * Customer wishlist view tab.
 */
export default function CustomerWishlistTab({
  wishlistLoading,
  wishlistError,
  savedWishlist,
  onNavigateHome,
  onAddToCart,
  onRemoveWishlist,
}) {
  if (wishlistLoading) {
    return <div className="customer-state">Loading your wishlist…</div>;
  }

  if (wishlistError) {
    return <div className="customer-state">Wishlist is temporarily unavailable.</div>;
  }

  if (savedWishlist.length === 0) {
    return (
      <div className="customer-empty">
        <Heart size={40} className="customer-empty__icon" />
        <h3 className="customer-empty__title">Your wishlist is empty</h3>
        <p className="customer-empty__text">Products you save will appear here.</p>
        {onNavigateHome && (
          <Button variant="primary" size="sm" onClick={onNavigateHome}>
            Browse the store
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="customer-wishlist-grid">
      {savedWishlist.map((entry) => {
        const product = entry?.product;
        if (!product) return null;

        const title = product.title || product.name || "";
        const image = product.image_url || product.image || "";
        const hasPrice = product.price != null && Number.isFinite(Number(product.price));
        const hasOriginal =
          product.original_price != null && Number(product.original_price) > Number(product.price);

        return (
          <div key={entry.id ?? entry.product_id} className="customer-wishlist-card">
            {image && <img src={image} alt={title} className="customer-wishlist-card__image" />}
            {product.category && (
              <div className="customer-wishlist-card__category">{product.category}</div>
            )}
            <h4 className="customer-wishlist-card__title">{title}</h4>
            <div className="customer-wishlist-card__price">
              <span className="customer-wishlist-card__price-current">
                {hasPrice ? formatCurrency(product.price) : "—"}
              </span>
              {hasOriginal && (
                <span className="customer-wishlist-card__price-original">
                  {formatCurrency(product.original_price)}
                </span>
              )}
            </div>
            <div className="customer-wishlist-card__actions">
              <Button
                variant="primary"
                size="sm"
                className="customer-wishlist-card__action"
                onClick={() => onAddToCart(product, title)}
              >
                <ShoppingBag size={14} className="customer-button__icon" /> Move to Cart
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onRemoveWishlist(entry.product_id, title)}
              >
                Remove
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
