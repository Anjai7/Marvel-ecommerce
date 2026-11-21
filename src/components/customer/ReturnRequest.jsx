import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "../ui";
import { apiRequestReturn } from "../../api/backendApi";

/** The reasons the customer can pick, in order, each with its label. */
const RETURN_REASONS = [
  { value: "damaged", label: "Damaged" },
  { value: "wrong_item", label: "Wrong item" },
  { value: "changed_mind", label: "Changed mind" },
  { value: "other", label: "Other" },
];

/** The human label of a stored reason slug. */
function returnReasonLabel(value) {
  const found = RETURN_REASONS.find((reason) => reason.value === value);
  return found ? found.label : value;
}

function formatTimestamp(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The "Request a return" control — inline, not a modal. On a delivered order
 * it opens a short form (reason + optional notes) and POSTs it to
 * `POST /api/orders/:id/return`; on success it shows the request as recorded,
 * with the reason and the time it was made.
 */
export default function ReturnRequest({ order }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(RETURN_REASONS[0].value);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requested, setRequested] = useState(null);
  const [error, setError] = useState("");

  // A return is requested for a delivered order — nothing else offers it.
  if (order?.status !== "delivered") return null;

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await apiRequestReturn(order.id, { reason, notes: notes.trim() });
      setRequested({
        reason,
        created_at: result?.created_at || new Date().toISOString(),
      });
      setOpen(false);
    } catch {
      setError("The return request could not be saved. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (requested) {
    return (
      <div className="customer-return__confirmed">
        <CheckCircle2 size={16} />
        <span className="customer-return__status">Return requested</span>
        <span className="customer-return__detail">
          Reason: {returnReasonLabel(requested.reason)} · {formatTimestamp(requested.created_at)}
        </span>
      </div>
    );
  }

  return (
    <div className="customer-return">
      {!open ? (
        <Button variant="secondary" disabled={submitting} onClick={() => setOpen(true)}>
          Request a return
        </Button>
      ) : (
        <form
          className="customer-return__form"
          onSubmit={handleSubmit}
          aria-label="Request a return"
        >
          <label className="customer-return__field">
            <span className="customer-return__field-label">Return reason</span>
            <select
              className="customer-return__select"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={submitting}
            >
              {RETURN_REASONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="customer-return__field">
            <span className="customer-return__field-label">Notes (optional)</span>
            <textarea
              className="customer-return__notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              disabled={submitting}
            />
          </label>
          {error && (
            <p className="customer-return__error" role="alert">
              {error}
            </p>
          )}
          <div className="customer-return__actions">
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Saving..." : "Submit request"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={submitting}
              onClick={() => {
                setOpen(false);
                setError("");
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
