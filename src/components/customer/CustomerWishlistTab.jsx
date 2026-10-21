import { Heart, ShoppingBag } from "lucide-react";
import { Button } from "../ui";
import { formatCurrency } from "../../lib/currency";

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
    return (
      <div
        style={{
          background: "#ffffff",
          borderRadius: 16,
          padding: 32,
          border: "1px solid #e2e8f0",
          textAlign: "center",
          color: "#64748b",
          fontSize: 14,
        }}
      >
        Loading your wishlist…
      </div>
    );
  }

  if (wishlistError) {
    return (
      <div
        style={{
          background: "#ffffff",
          borderRadius: 16,
          padding: 32,
          border: "1px solid #e2e8f0",
          textAlign: "center",
          color: "#64748b",
          fontSize: 14,
        }}
      >
        Wishlist is temporarily unavailable.
      </div>
    );
  }

  if (savedWishlist.length === 0) {
    return (
      <div
        style={{
          background: "#ffffff",
          borderRadius: 16,
          padding: 40,
          border: "1px solid #e2e8f0",
          textAlign: "center",
        }}
      >
        <Heart size={40} color="#cbd5e1" />
        <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", margin: "12px 0 6px" }}>
          Your wishlist is empty
        </h3>
        <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 18px" }}>
          Products you save will appear here.
        </p>
        {onNavigateHome && (
          <Button variant="primary" size="sm" onClick={onNavigateHome}>
            Browse the store
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
        gap: 20,
      }}
    >
      {savedWishlist.map((entry) => {
        const product = entry?.product;
        if (!product) return null;

        const title = product.title || product.name || "";
        const image = product.image_url || product.image || "";
        const hasPrice = product.price != null && Number.isFinite(Number(product.price));
        const hasOriginal =
          product.original_price != null && Number(product.original_price) > Number(product.price);

        return (
          <div
            key={entry.id ?? entry.product_id}
            style={{
              background: "#ffffff",
              borderRadius: 16,
              padding: 18,
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
            }}
          >
            {image && (
              <img
                src={image}
                alt={title}
                style={{
                  width: "100%",
                  height: 180,
                  objectFit: "cover",
                  borderRadius: 12,
                  marginBottom: 12,
                }}
              />
            )}
            {product.category && (
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#2563eb",
                  textTransform: "uppercase",
                }}
              >
                {product.category}
              </div>
            )}
            <h4
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#0f172a",
                margin: "4px 0 8px 0",
              }}
            >
              {title}
            </h4>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
                {hasPrice ? formatCurrency(product.price) : "—"}
              </span>
              {hasOriginal && (
                <span
                  style={{
                    fontSize: 13,
                    color: "#94a3b8",
                    textDecoration: "line-through",
                  }}
                >
                  {formatCurrency(product.original_price)}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                variant="primary"
                size="sm"
                style={{ flex: 1 }}
                onClick={() => onAddToCart(product, title)}
              >
                <ShoppingBag size={14} style={{ marginRight: 6 }} /> Move to Cart
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
