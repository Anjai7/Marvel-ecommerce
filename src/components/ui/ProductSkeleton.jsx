import React from "react";

export function ProductCardSkeleton() {
  return (
    <div style={{
      background: "#ffffff",
      borderRadius: 14,
      border: "1px solid #e2e8f0",
      padding: 14,
      display: "flex",
      flexDirection: "column",
      gap: 12,
      overflow: "hidden",
      position: "relative"
    }}>
      {/* Image Skeleton */}
      <div style={{
        width: "100%",
        height: 180,
        borderRadius: 10,
        background: "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite"
      }} />

      {/* Category / Badge Line */}
      <div style={{
        width: "35%",
        height: 12,
        borderRadius: 6,
        background: "#f1f5f9"
      }} />

      {/* Title Line 1 */}
      <div style={{
        width: "90%",
        height: 16,
        borderRadius: 6,
        background: "#e2e8f0"
      }} />

      {/* Title Line 2 */}
      <div style={{
        width: "65%",
        height: 14,
        borderRadius: 6,
        background: "#f1f5f9"
      }} />

      {/* Rating & Price Row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
        <div style={{ width: "40%", height: 20, borderRadius: 6, background: "#e2e8f0" }} />
        <div style={{ width: "25%", height: 14, borderRadius: 6, background: "#f1f5f9" }} />
      </div>

      {/* Button Skeleton */}
      <div style={{
        width: "100%",
        height: 36,
        borderRadius: 8,
        background: "#f1f5f9",
        marginTop: 6
      }} />
    </div>
  );
}

export function ProductGridSkeleton({ count = 12 }) {
  return (
    <div className="product-grid-4x3">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ProductCarouselSkeleton({ count = 4 }) {
  return (
    <div style={{
      display: "flex",
      gap: 20,
      overflow: "hidden",
      width: "100%",
      padding: "8px 0"
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ flex: "0 0 calc(25% - 15px)", minWidth: 240 }}>
          <ProductCardSkeleton />
        </div>
      ))}
    </div>
  );
}
