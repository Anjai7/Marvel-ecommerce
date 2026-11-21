import React, { useId, useState } from "react";
import { Star, ThumbsUp, CheckCircle, PenLine } from "lucide-react";
import { Button, Input, RequiredMark, useToast } from "../ui";
import { useSettings } from "../../context/SettingsContext";
import { apiCreateReview } from "../../api/productDetailsApi";
// Shared product-surface stylesheet (responsive rules, tap targets).

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
 * The stored list plus a just-saved row.
 *
 * The parent refetches after a submit, but that round trip is not instant: the
 * row the server returned shows straight away and disappears from here once
 * the refetched list carries the same id.
 */
function mergeReviews(stored, submitted) {
  if (submitted.length === 0) return stored;
  const storedIds = new Set(stored.map((row) => row.id).filter((id) => id != null));
  return [...submitted.filter((row) => row.id == null || !storedIds.has(row.id)), ...stored];
}

const EMPTY_FORM = { author_name: "", rating: "", title: "", body: "" };

/**
 * The inline review form.
 *
 * There is no login gate, so the name is typed here and the submitted review is
 * unverified. The fields are validated locally first and the server's message
 * is rendered in the form, so a rejection is never only a toast.
 */
function WriteReviewForm({ productId, onSubmitted, onCancel }) {
  const uid = useId();
  const { addToast } = useToast();
  const [values, setValues] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const setField = (field) => (event) => {
    const { value } = event.target;
    setValues((current) => ({ ...current, [field]: value }));
  };

  const validate = () => {
    const next = {};
    if (!values.author_name.trim()) next.author_name = "Please enter your name.";
    const rating = Number(values.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      next.rating = "Please choose a star rating.";
    }
    if (!values.body.trim()) next.body = "Please write a few words about the product.";
    return next;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setServerError(null);

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const review = await apiCreateReview(productId, {
        author_name: values.author_name.trim(),
        rating: Number(values.rating),
        title: values.title.trim(),
        body: values.body.trim(),
      });
      addToast({
        title: "Review submitted",
        message: "Thank you — your review is now on the page.",
        type: "success",
      });
      onSubmitted(review);
    } catch (error) {
      setServerError(
        error instanceof Error && error.message
          ? error.message
          : "We could not save your review. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      className="cr-form"
      onSubmit={handleSubmit}
      noValidate
      aria-describedby={serverError ? `${uid}-form-error` : undefined}
    >
      <h3 className="cr-form-title">Write a review</h3>

      {serverError && (
        <p className="cr-form-error" id={`${uid}-form-error`} role="alert">
          {serverError}
        </p>
      )}

      <div className="cr-field">
        <label className="cr-label" htmlFor={`${uid}-author`}>
          Your name <RequiredMark />
        </label>
        <Input
          id={`${uid}-author`}
          name="author_name"
          autoComplete="name"
          required
          value={values.author_name}
          onChange={setField("author_name")}
          error={Boolean(errors.author_name)}
          aria-invalid={errors.author_name ? "true" : undefined}
          aria-describedby={errors.author_name ? `${uid}-author-error` : undefined}
        />
        {errors.author_name && (
          <p className="cr-field-error" id={`${uid}-author-error`}>
            {errors.author_name}
          </p>
        )}
      </div>

      <fieldset
        className="cr-field cr-rating-field"
        aria-invalid={errors.rating ? "true" : undefined}
        aria-describedby={errors.rating ? `${uid}-rating-error` : undefined}
      >
        <legend className="cr-label">
          Your rating <RequiredMark />
        </legend>
        <div className="cr-rating-options">
          {[1, 2, 3, 4, 5].map((star) => {
            const selected = Number(values.rating) === star;
            return (
              <label
                key={star}
                className={`cr-rating-option${selected ? " is-selected" : ""}`}
                htmlFor={`${uid}-rating-${star}`}
              >
                <input
                  className="cr-rating-input"
                  type="radio"
                  id={`${uid}-rating-${star}`}
                  name={`${uid}-rating`}
                  value={star}
                  checked={selected}
                  onChange={setField("rating")}
                  required
                />
                <Star
                  size={15}
                  aria-hidden="true"
                  fill={selected ? "#f59e0b" : "none"}
                  color={selected ? "#f59e0b" : "#64748b"}
                />
                <span>
                  {star} star{star === 1 ? "" : "s"}
                </span>
              </label>
            );
          })}
        </div>
        {errors.rating && (
          <p className="cr-field-error" id={`${uid}-rating-error`}>
            {errors.rating}
          </p>
        )}
      </fieldset>

      <div className="cr-field">
        <label className="cr-label" htmlFor={`${uid}-title`}>
          Review title <span className="cr-optional">(optional)</span>
        </label>
        <Input id={`${uid}-title`} name="title" value={values.title} onChange={setField("title")} />
      </div>

      <div className="cr-field">
        <label className="cr-label" htmlFor={`${uid}-body`}>
          Your review <RequiredMark />
        </label>
        <textarea
          className="cr-textarea"
          id={`${uid}-body`}
          name="body"
          rows={4}
          required
          value={values.body}
          onChange={setField("body")}
          aria-invalid={errors.body ? "true" : undefined}
          aria-describedby={errors.body ? `${uid}-body-error` : undefined}
        />
        {errors.body && (
          <p className="cr-field-error" id={`${uid}-body-error`}>
            {errors.body}
          </p>
        )}
      </div>

      <div className="cr-form-actions">
        <Button type="submit" variant="primary" isLoading={submitting}>
          Submit review
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * Customer reviews for one product.
 *
 * Everything shown comes from `reviews` — the payload of
 * `GET /api/products/:id/details`. There is no local fallback summary, no
 * fallback rows and no invented "verified" badge: when the product has no
 * stored reviews the section says so.
 *
 * `onReviewAdded` lets the product page refetch the details after a submit, so
 * the summary and the list are recomputed from the stored rows.
 */
export default function CustomerReviews({ reviews, productId, onReviewAdded }) {
  const { settings } = useSettings();
  const [helpful, setHelpful] = useState({});
  const [formOpen, setFormOpen] = useState(false);
  const [submitted, setSubmitted] = useState([]);

  // The write setting is opt-out: a store that never configured `reviews`
  // still lets customers write one.
  const allowWrite = settings?.reviews?.allow_write !== false;
  const canWrite = allowWrite && Boolean(productId);

  const storedItems = Array.isArray(reviews?.items) ? reviews.items : [];
  const items = mergeReviews(storedItems, submitted);
  const total = Number(reviews?.total) || 0;
  const overall = typeof reviews?.overall === "number" ? reviews.overall : null;
  const rows = breakdownRows(reviews?.breakdown, total);

  const markHelpful = (id) => {
    setHelpful((state) => ({ ...state, [id]: !state[id] }));
  };

  const handleSubmitted = (review) => {
    if (review) setSubmitted((current) => [review, ...current]);
    setFormOpen(false);
    onReviewAdded?.(review);
  };

  return (
    <section className="cr-section" id="reviews">
      <div className="cr-header">
        <h2 className="cr-title">Customer Reviews</h2>
        {canWrite && !formOpen && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setFormOpen(true)}
            leftIcon={<PenLine size={15} aria-hidden="true" />}
          >
            Write a review
          </Button>
        )}
      </div>

      {canWrite && formOpen && (
        <WriteReviewForm
          productId={productId}
          onSubmitted={handleSubmitted}
          onCancel={() => setFormOpen(false)}
        />
      )}

      {total === 0 && items.length === 0 ? (
        <p className="cr-empty">No reviews have been published for this product yet.</p>
      ) : (
        <>
          {total > 0 && (
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
                      {/* Percentage is derived from stored counts, so the width is
                          set on the element itself — no inline style attr. */}
                      <div
                        className="cr-bar-fill"
                        ref={(el) => {
                          if (el) el.style.width = `${row.percent}%`;
                        }}
                      />
                    </div>
                    <span className="cr-bar-count">{row.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                        <img src={review.author_avatar} alt="" className="cr-avatar-img" />
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
