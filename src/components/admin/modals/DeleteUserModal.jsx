import { AlertTriangle, X } from "lucide-react";
import { Button } from "../../ui";

/**
 * Confirmation dialog for permanently deleting a user account.
 */
export default function DeleteUserModal({ user, onClose, onConfirm, loading }) {
  if (!user) return null;

  return (
    <div className="modal-backdrop-overlay">
      <div className="modal-content-container animate-scale-up">
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <div className="modal-icon-bubble red">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="modal-title">Delete User Account</h3>
              <p className="modal-subtitle">This action is irreversible and deletes DB records</p>
            </div>
          </div>
          <button onClick={onClose} className="modal-close-btn">
            <X size={18} />
          </button>
        </div>

        <div className="delete-modal-body">
          <p>
            Are you sure you want to permanently delete the account for{" "}
            <strong>{user.full_name || user.email}</strong>?
          </p>
          <div className="delete-warning-box">
            <AlertTriangle size={16} />
            <span>The user will immediately lose access to Marvel platform services.</span>
          </div>
        </div>

        <div className="modal-actions-footer">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={loading} className="submit-primary-btn red">
            {loading ? "Deleting..." : "Permanently Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}
