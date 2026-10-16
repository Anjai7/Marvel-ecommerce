import { useEffect, useRef } from "react";

/**
 * Generic delete-confirmation dialog.
 *
 * Reuses the admin console modal styles (`modal-backdrop-overlay` /
 * `modal-content-container`). Focus lands on the Delete button when opened.
 */
export default function ConfirmDialog({ open, title, message, onCancel, onConfirm }) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (open && confirmRef.current) {
      confirmRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onCancel?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="modal-backdrop-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal-content-container animate-scale-up"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3 className="modal-title">{title}</h3>
            {message && <p className="modal-subtitle">{message}</p>}
          </div>
        </div>
        <div className="modal-actions-footer">
          <button type="button" className="chart-pill-btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            ref={confirmRef}
            autoFocus
            className="chart-pill-btn"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
