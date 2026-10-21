import { Key, X } from "lucide-react";
import { Button, Input } from "../../ui";

/**
 * Modal dialog for resetting a user's password in the Unified Admin Console.
 */
export default function ResetPasswordModal({
  user,
  onClose,
  newPassword,
  setNewPassword,
  onSubmit,
  loading,
}) {
  if (!user) return null;

  return (
    <div className="modal-backdrop-overlay">
      <div className="modal-content-container animate-scale-up">
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <div className="modal-icon-bubble amber">
              <Key size={20} />
            </div>
            <div>
              <h3 className="modal-title">Reset User Password</h3>
              <p className="modal-subtitle">Set a new secure password for {user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="modal-close-btn">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">New Password *</label>
            <Input
              type="password"
              required
              placeholder="Enter at least 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div className="modal-actions-footer">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="submit-primary-btn amber">
              {loading ? "Resetting..." : "Confirm Password Reset"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
