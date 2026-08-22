import React, { useState } from "react";
import { Star, ThumbsUp, CheckCircle } from "lucide-react";

function StarsFill({ rating }) {
  return (
    <span className="cr-stars">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} size={13} fill={s <= rating ? "#f59e0b" : "none"} color={s <= rating ? "#f59e0b" : "#d1d5db"} />
      ))}
    </span>
  );
}

function RatingAttrBar({ label, score }) {
  return (
    <div className="cr-attr-row">
      <span className="cr-attr-label">{label}</span>
      <div className="cr-attr-track">
        <div className="cr-attr-fill" style={{ width: `${(score / 5) * 100}%` }} />
      </div>
      <span className="cr-attr-score">{score}</span>
    </div>
  );
}

export default function CustomerReviews({ product }) {
  const [helpful, setHelpful] = useState({});
  if (!product) return null;

  const reviewSummary = product.reviewSummary || {
    overall: product.rating || 4.8,
    totalReviews: product.reviews || 128,
    breakdown: [
      { stars: 5, count: 92, percent: 72 },
      { stars: 4, count: 23, percent: 18 },
      { stars: 3, count: 8, percent: 6 },
      { stars: 2, count: 3, percent: 2 },
      { stars: 1, count: 2, percent: 2 }
    ],
    attributes: [
      { label: "Build Quality", score: 4.9 },
      { label: "Value for Money", score: 4.8 },
      { label: "Battery Life", score: 4.7 }
    ]
  };

  const topReviews = product.topReviews || [
    {
      id: "rev-default-1",
      author: "Verified Customer",
      verified: true,
      rating: 5,
      date: "Recent",
      title: "Excellent purchase!",
      body: "High quality materials, accurate description, and delivered quickly by Marvel seller.",
      helpful: 12
    }
  ];

  const markHelpful = (id) => {
    setHelpful(h => ({ ...h, [id]: !h[id] }));
  };

  return (
    <section className="cr-section" id="reviews">
      <div className="cr-header">
        <h2 className="cr-title">Customer Reviews</h2>
        <button className="cr-write-btn">✍️ Write a Review</button>
      </div>

      <div className="cr-summary-grid">
        {/* Overall Score */}
        <div className="cr-overall">
          <div className="cr-big-num">{reviewSummary.overall}</div>
          <div className="cr-big-stars">
            {[1, 2, 3, 4, 5].map(s => (
              <Star key={s} size={20} fill={s <= Math.round(reviewSummary.overall) ? "#f59e0b" : "none"} color={s <= Math.round(reviewSummary.overall) ? "#f59e0b" : "#d1d5db"} />
            ))}
          </div>
          <div className="cr-total-label">{(reviewSummary.totalReviews || 100).toLocaleString()} Reviews</div>
        </div>

        {/* Star Breakdown */}
        <div className="cr-breakdown">
          {[...(reviewSummary.breakdown || [])].reverse().map(b => (
            <div className="cr-bar-row" key={b.stars}>
              <span className="cr-bar-label">{b.stars} <Star size={11} fill="#f59e0b" color="#f59e0b" /></span>
              <div className="cr-bar-track">
                <div className="cr-bar-fill" style={{ width: `${b.percent}%` }} />
              </div>
              <span className="cr-bar-count">{(b.count || 0).toLocaleString()}</span>
            </div>
          ))}
        </div>

        {/* Attribute Ratings */}
        <div className="cr-attributes">
          <div className="cr-attr-title">Ratings by Feature</div>
          {(reviewSummary.attributes || []).map(a => (
            <RatingAttrBar key={a.label} label={a.label} score={a.score} />
          ))}
        </div>
      </div>

      {/* Review Cards */}
      <div className="cr-reviews-list">
        {topReviews.map(review => (
          <div className="cr-card" key={review.id} id={`review-${review.id}`}>
            <div className="cr-card-top">
              <div className="cr-avatar">{review.author.charAt(0)}</div>
              <div className="cr-author-info">
                <div className="cr-author-name">
                  {review.author}
                  {review.verified && (
                    <span className="cr-verified">
                      <CheckCircle size={13} /> Verified Purchase
                    </span>
                  )}
                </div>
                <div className="cr-date">{review.date}</div>
              </div>
              <div className="cr-card-rating">
                <StarsFill rating={review.rating} />
                <span className={`cr-rating-chip cr-r${review.rating}`}>{review.rating}.0</span>
              </div>
            </div>

            <div className="cr-review-title">{review.title}</div>
            <div className="cr-review-body">{review.body}</div>

            {review.images && review.images.length > 0 && (
              <div className="cr-review-imgs">
                {review.images.map((img, i) => (
                  <img key={i} src={img} alt="Review" className="cr-review-img" />
                ))}
              </div>
            )}

            <div className="cr-helpful-row">
              <span className="cr-helpful-label">Was this helpful?</span>
              <button
                className={`cr-helpful-btn ${helpful[review.id] ? "active" : ""}`}
                onClick={() => markHelpful(review.id)}
                id={`helpful-${review.id}`}
              >
                <ThumbsUp size={14} />
                Helpful ({(review.helpful || 0) + (helpful[review.id] ? 1 : 0)})
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
