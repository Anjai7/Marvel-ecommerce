import { useEffect, useRef } from "react";

/**
 * Generic delete-confirmation dialog.
 *
 * Reuses the admin console modal styles (`modal-backdrop-overlay` /
 * `modal-content-container`). Focus lands on the Delete button when opened.
 *
 * `destructive` gives the confirm button the danger styling, and `pending`
 * disables both buttons while the request it confirms is in flight.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  onCancel,
  onConfirm,
  destructive = false,
  pending = false,
  confirmLabel = "Delete",
}) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (open && confirmRef.current) {
      confirmRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !pending) onCancel?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel, pending]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop-overlay"
      role="presentation"
      onClick={pending ? undefined : onCancel}
    >
      <div
        className="modal-content-container animate-scale-up"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        aria-busy={pending || undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3 className="modal-title">{title}</h3>
            {message && <p className="modal-subtitle">{message}</p>}
          </div>
        </div>
        <div className="modal-actions-footer">
          <button type="button" className="chart-pill-btn" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
          <button
            type="button"
            ref={confirmRef}
            autoFocus
            className={destructive ? "chart-pill-btn chart-pill-btn-danger" : "chart-pill-btn"}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Deleting..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
