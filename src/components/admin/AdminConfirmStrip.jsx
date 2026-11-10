import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import "./admin-inline-panel.css";

/**
 * An inline confirmation strip for a destructive write.
 *
 * The strip sits in the page next to the list it acts on, so the admin can
 * see exactly which record is about to go while they confirm it. Focus lands
 * on the confirm button when the strip opens, and Escape cancels it.
 *
 * `destructive` gives the confirm button the danger styling, and `pending`
 * disables both buttons while the request it confirms is in flight.
 */
export default function AdminConfirmStrip({
  open,
  title,
  message,
  onCancel,
  onConfirm,
  destructive = false,
  pending = false,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
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
      className={`admin-confirm-strip${destructive ? " danger" : ""}`}
      role="alertdialog"
      aria-label={title}
      aria-busy={pending || undefined}
    >
      <span className="admin-confirm-strip-icon" aria-hidden="true">
        <AlertTriangle size={16} />
      </span>
      <div className="admin-confirm-strip-text">
        <p className="admin-confirm-strip-title">{title}</p>
        {message ? <p className="admin-confirm-strip-message">{message}</p> : null}
      </div>
      <div className="admin-confirm-strip-actions">
        <button type="button" className="chart-pill-btn" onClick={onCancel} disabled={pending}>
          {cancelLabel}
        </button>
        <button
          type="button"
          ref={confirmRef}
          className={destructive ? "chart-pill-btn chart-pill-btn-danger" : "chart-pill-btn"}
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? "Deleting..." : confirmLabel}
        </button>
      </div>
    </div>
  );
}
