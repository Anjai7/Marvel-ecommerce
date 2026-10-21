import React from "react";
import { Badge } from "./Badge";
import { clsx } from "clsx";
import { formatCurrency } from "../../lib/currency";

export function ProductPrice({
  price,
  originalPrice,
  discount,
  size = "md", // sm | md | lg
  className,
}) {
  return (
    <div className={clsx("ui-product-price", `ui-price-${size}`, className)}>
      <span className="price-now">{formatCurrency(price)}</span>
      {originalPrice && originalPrice > price && (
        <span className="price-was">{formatCurrency(originalPrice)}</span>
      )}
      {discount && discount > 0 && (
        <Badge variant="success" size={size === "lg" ? "md" : "sm"} className="price-off">
          {discount}% OFF
        </Badge>
      )}
    </div>
  );
}
