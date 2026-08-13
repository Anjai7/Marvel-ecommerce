import React from "react";
import { Badge } from "./Badge";
import { clsx } from "clsx";

export function ProductPrice({
  price,
  originalPrice,
  discount,
  size = "md", // sm | md | lg
  className,
}) {
  return (
    <div className={clsx("ui-product-price", `ui-price-${size}`, className)}>
      <span className="price-now">₹{price?.toLocaleString()}</span>
      {originalPrice && originalPrice > price && (
        <span className="price-was">₹{originalPrice?.toLocaleString()}</span>
      )}
      {discount && discount > 0 && (
        <Badge variant="success" size={size === "lg" ? "md" : "sm"} className="price-off">
          {discount}% OFF
        </Badge>
      )}
    </div>
  );
}
