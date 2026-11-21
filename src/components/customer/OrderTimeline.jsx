import { CheckCircle2 } from "lucide-react";

/**
 * The lifecycle of an order: Placed → Packed → Shipped → Delivered.
 *
 * The current step comes from the order's status. The "Placed" step shows the
 * order's created date; the other steps are honest — a tick where reached,
 * nothing invented where it is not. A cancelled order shows a cancelled state
 * instead of the steps.
 */

/** Placed(0) → Packed(1) → Shipped(2) → Delivered(3). */
function statusToStep(status) {
  switch (status) {
    case "processing":
      return 1;
    case "shipped":
      return 2;
    case "delivered":
      return 3;
    default:
      // "pending", unknown and missing statuses have only been placed.
      return 0;
  }
}

const STEPS = ["Placed", "Packed", "Shipped", "Delivered"];

/** The date shown on the Placed step: the order's created_at, nothing else. */
function placedDateText(order) {
  const createdAt = order?.created_at;
  if (!createdAt) return "";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function OrderTimeline({ order }) {
  const status = typeof order?.status === "string" ? order.status : "";

  // A cancelled order shows a cancelled state instead of the steps: there is
  // no further step to walk and nothing here is invented.
  if (status === "cancelled") {
    return (
      <ol className="customer-timeline customer-timeline--cancelled" aria-label="Order status">
        <li
          className="customer-timeline__step customer-timeline__step--cancelled"
          aria-current="step"
        >
          Cancelled
        </li>
      </ol>
    );
  }

  const current = statusToStep(status);
  const placedDate = placedDateText(order);

  return (
    <ol className="customer-timeline" aria-label="Order status">
      {STEPS.map((label, index) => {
        const reached = index <= current;
        const isCurrent = index === current;
        const detailParts = [order?.carrier, order?.tracking_number].filter(Boolean);
        // The Placed step is the only one with a date: created_at, when there is one.
        const showPlacedDate = index === 0 && Boolean(placedDate);
        // The Shipped step carries the carrier and tracking number when reached.
        const showShippedDetail = index === 2 && reached && detailParts.length > 0;
        return (
          <li
            key={label}
            className={`customer-timeline__step${reached ? " customer-timeline__step--done" : ""}${isCurrent ? " customer-timeline__step--current" : ""}`}
            {...(isCurrent ? { "aria-current": "step" } : {})}
          >
            <span className="customer-timeline__step-mark">
              {reached ? (
                <CheckCircle2 size={16} />
              ) : (
                <span className="customer-timeline__step-num">{index + 1}</span>
              )}
            </span>
            <span className="customer-timeline__step-name">{label}</span>
            {showPlacedDate && <span className="customer-timeline__step-date">{placedDate}</span>}
            {showShippedDetail && (
              <span className="customer-timeline__step-detail">{detailParts.join(" · ")}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
