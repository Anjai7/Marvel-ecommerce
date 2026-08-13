import React from "react";
import { Star } from "lucide-react";
import { clsx } from "clsx";

export function Rating({
  rating = 0,
  maxStars = 5,
  size = 14,
  showValue = true,
  count,
  className,
}) {
  return (
    <div className={clsx("ui-rating", className)}>
      <div className="ui-rating-stars">
        {Array.from({ length: maxStars }).map((_, i) => {
          const starValue = i + 1;
          const isFull = rating >= starValue;
          const isHalf = !isFull && rating >= starValue - 0.5;

          return (
            <Star
              key={i}
              size={size}
              className={clsx(
                "ui-rating-star",
                isFull && "is-full",
                isHalf && "is-half",
                !isFull && !isHalf && "is-empty"
              )}
              fill={isFull || isHalf ? "currentColor" : "none"}
            />
          );
        })}
      </div>
      {showValue && <span className="ui-rating-val">{rating.toFixed(1)}</span>}
      {count !== undefined && (
        <span className="ui-rating-count">({count.toLocaleString()})</span>
      )}
    </div>
  );
}
