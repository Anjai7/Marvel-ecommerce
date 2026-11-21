import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { apiFetchAdminAudit } from "../../api/backendApi";
import { Button } from "../ui";
import { displayValue, formatAdminDate } from "./adminConstants";

function actionLabel(action) {
  const text = String(action ?? "");
  const spaced = text
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * The console's audit log: the latest admin writes, newest first.
 *
 * It reads `GET /api/admin/audit` itself and renders time, action, entity and
 * the operator when the log knows them. A failed read shows the error instead
 * of an empty list — an undelivered audit line is a problem worth seeing.
 */
export default function AuditLog({ limit = 50 }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const payload = await apiFetchAdminAudit(limit);
      const list = Array.isArray(payload) ? payload : (payload?.entries ?? []);
      setEntries(list);
    } catch (err) {
      setError(err?.message || "Could not load the audit log.");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="admin-audit-log" aria-label="Audit log">
      <div className="admin-audit-header">
        <div>
          <h2 className="admin-audit-title">
            <ShieldCheck size={18} /> Audit Log
          </h2>
          <p className="admin-audit-subtitle">
            The admin writes that matter, newest first. A missing log table means no entries yet —
            it never blocks a save.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <RefreshCw size={14} className="spin-animation" /> : <RefreshCw size={14} />}
          Refresh
        </Button>
      </div>

      {error ? (
        <p role="alert" className="admin-audit-error">
          {error}
        </p>
      ) : loading ? (
        <p className="admin-audit-loading">Loading audit entries...</p>
      ) : entries.length === 0 ? (
        <p className="report-empty">No admin writes recorded yet.</p>
      ) : (
        <ul className="admin-audit-list">
          {entries.map((entry) => (
            <li
              key={entry.id ?? `${entry.entity}-${entry.entity_id}-${entry.created_at}`}
              className="admin-audit-row"
            >
              <div className="admin-audit-row-main">
                <span className="admin-audit-action">{actionLabel(entry.action)}</span>
                <span className="admin-audit-entity">{displayValue(entry.entity)}</span>
              </div>
              <div className="admin-audit-row-meta">
                <span>by {entry.actor_email || entry.actor_id || "System"}</span>
                <span>{formatAdminDate(entry.created_at)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
