import React from "react";
import "./ui-primitives.css";

export function ProductCardSkeleton() {
  return (
    <div className="skeleton-card">
      {/* Image Skeleton */}
      <div className="skeleton-card-media" />

      {/* Category / Badge Line */}
      <div className="skeleton-block skeleton-block--badge" />

      {/* Title Line 1 */}
      <div className="skeleton-block skeleton-block--text skeleton-block--title" />

      {/* Title Line 2 */}
      <div className="skeleton-block skeleton-block--subtitle" />

      {/* Rating & Price Row */}
      <div className="skeleton-card-row">
        <div className="skeleton-block skeleton-block--text skeleton-block--meta" />
        <div className="skeleton-block skeleton-block--price" />
      </div>

      {/* Button Skeleton */}
      <div className="skeleton-block skeleton-block--button" />
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
    <div className="skeleton-carousel">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-carousel-item">
          <ProductCardSkeleton />
        </div>
      ))}
    </div>
  );
}
