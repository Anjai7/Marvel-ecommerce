import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import "./admin-inline-panel.css";

/**
 * An in-page panel that hosts an admin form.
 *
 * The panel sits in the normal flow of the page — no backdrop, no fixed
 * positioning — so the list behind it stays visible, the admin never loses
 * their place, and closing the form does not need a second click on the
 * page background.
 *
 * When the panel opens the focus moves to it, so a keyboard user lands in
 * the form instead of at the top of the document.
 *
 * `tone` picks the colour of the icon bubble in the header; it matches the
 * `modal-icon-bubble` palette the console already uses.
 */
export default function AdminInlinePanel({
  open = true,
  title,
  subtitle,
  icon,
  tone = "blue",
  onClose,
  closeLabel = "Close panel",
  children,
  className = "",
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    panel.focus({ preventScroll: true });
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [open]);

  if (!open) return null;

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      className={`admin-inline-panel admin-inline-panel-${tone} ${className}`.trim()}
      aria-label={title}
    >
      <header className="admin-inline-panel-header">
        <div className="admin-inline-panel-heading">
          {icon ? <span className={`modal-icon-bubble ${tone}`}>{icon}</span> : null}
          <div className="admin-inline-panel-heading-text">
            <h3 className="admin-inline-panel-title">{title}</h3>
            {subtitle ? <p className="admin-inline-panel-subtitle">{subtitle}</p> : null}
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="modal-close-btn"
            aria-label={closeLabel}
          >
            <X size={18} />
          </button>
        ) : null}
      </header>
      <div className="admin-inline-panel-body">{children}</div>
    </section>
  );
}
