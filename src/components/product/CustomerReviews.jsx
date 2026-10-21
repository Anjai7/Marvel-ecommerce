import React, { useState } from "react";
import { Star, ThumbsUp, CheckCircle } from "lucide-react";

function StarsFill({ rating }) {
  return (
    <span className="cr-stars">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={13}
          fill={s <= rating ? "#f59e0b" : "none"}
          color={s <= rating ? "#f59e0b" : "#d1d5db"}
        />
      ))}
    </span>
  );
}

/** Stored `created_at` → a readable date, or null when it cannot be read. */
function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Breakdown rows from `reviews.breakdown`, which the API returns keyed by star
 * ("5"…"1") and only for the stars that occur. The percentage is arithmetic on
 * the stored counts, not a stored value.
 */
function breakdownRows(breakdown, total) {
  if (!breakdown || typeof breakdown !== "object") return [];
  return Object.entries(breakdown)
    .map(([stars, count]) => {
      const numericStars = Number(stars);
      const numericCount = Number(count) || 0;
      return {
        stars: numericStars,
        count: numericCount,
        percent: total > 0 ? Math.round((numericCount / total) * 100) : 0,
      };
    })
    .filter((row) => Number.isInteger(row.stars) && row.stars >= 1 && row.stars <= 5)
    .sort((a, b) => b.stars - a.stars);
}

/**
 * Customer reviews for one product.
 *
 * Everything shown comes from `reviews` — the payload of
 * `GET /api/products/:id/details`. There is no local fallback summary, no
 * fallback rows and no invented "verified" badge: when the product has no
 * stored reviews the section says so.
 */
export default function CustomerReviews({ reviews }) {
  const [helpful, setHelpful] = useState({});

  const items = Array.isArray(reviews?.items) ? reviews.items : [];
  const total = Number(reviews?.total) || 0;
  const overall = typeof reviews?.overall === "number" ? reviews.overall : null;
  const rows = breakdownRows(reviews?.breakdown, total);

  const markHelpful = (id) => {
    setHelpful((state) => ({ ...state, [id]: !state[id] }));
  };

  return (
    <section className="cr-section" id="reviews">
      <div className="cr-header">
        <h2 className="cr-title">Customer Reviews</h2>
      </div>

      {total === 0 ? (
        <p style={{ fontSize: 14, color: "#64748b", padding: "16px 0" }}>
          No reviews have been published for this product yet.
        </p>
      ) : (
        <>
          <div className="cr-summary-grid">
            {/* Overall Score */}
            <div className="cr-overall">
              <div className="cr-big-num">{overall !== null ? overall : "—"}</div>
              <div className="cr-big-stars">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    size={20}
                    fill={overall !== null && s <= Math.round(overall) ? "#f59e0b" : "none"}
                    color={overall !== null && s <= Math.round(overall) ? "#f59e0b" : "#d1d5db"}
                  />
                ))}
              </div>
              <div className="cr-total-label">{total.toLocaleString()} Reviews</div>
            </div>

            {/* Star Breakdown from the API */}
            <div className="cr-breakdown">
              {rows.map((row) => (
                <div className="cr-bar-row" key={row.stars}>
                  <span className="cr-bar-label">
                    {row.stars} <Star size={11} fill="#f59e0b" color="#f59e0b" />
                  </span>
                  <div className="cr-bar-track">
                    <div className="cr-bar-fill" style={{ width: `${row.percent}%` }} />
                  </div>
                  <span className="cr-bar-count">{row.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stored review rows */}
          <div className="cr-reviews-list">
            {items.map((review, index) => {
              const author = review.author_name || "Anonymous";
              const date = formatDate(review.created_at);
              const key = review.id ?? `review-${index}`;
              return (
                <div className="cr-card" key={key} id={`review-${key}`}>
                  <div className="cr-card-top">
                    <div className="cr-avatar">
                      {review.author_avatar ? (
                        <img
                          src={review.author_avatar}
                          alt=""
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            borderRadius: "50%",
                          }}
                        />
                      ) : (
                        author.charAt(0)
                      )}
                    </div>
                    <div className="cr-author-info">
                      <div className="cr-author-name">
                        {author}
                        {review.is_verified && (
                          <span className="cr-verified">
                            <CheckCircle size={13} /> Verified Purchase
                          </span>
                        )}
                      </div>
                      {date && <div className="cr-date">{date}</div>}
                    </div>
                    <div className="cr-card-rating">
                      <StarsFill rating={Number(review.rating) || 0} />
                      <span className={`cr-rating-chip cr-r${review.rating}`}>
                        {review.rating}.0
                      </span>
                    </div>
                  </div>

                  {review.title && <div className="cr-review-title">{review.title}</div>}
                  {review.body && <div className="cr-review-body">{review.body}</div>}

                  <div className="cr-helpful-row">
                    <span className="cr-helpful-label">Was this helpful?</span>
                    <button
                      className={`cr-helpful-btn ${helpful[key] ? "active" : ""}`}
                      onClick={() => markHelpful(key)}
                      id={`helpful-${key}`}
                    >
                      <ThumbsUp size={14} /> Helpful
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
