import { Key } from "lucide-react";
import { Button, Input } from "../../ui";
import AdminInlinePanel from "../AdminInlinePanel";

/**
 * The reset-password form, shown inline in the Users tab.
 */
export default function ResetPasswordForm({
  user,
  onClose,
  newPassword,
  setNewPassword,
  onSubmit,
  loading,
}) {
  if (!user) return null;

  return (
    <AdminInlinePanel
      open
      title="Reset User Password"
      subtitle={`Set a new secure password for ${user.email}`}
      icon={<Key size={20} />}
      tone="amber"
      onClose={onClose}
      closeLabel="Close the reset password form"
    >
      <form onSubmit={onSubmit} className="admin-inline-form">
        <div className="form-group">
          <label className="form-label" htmlFor="user-reset-password">
            New Password *
          </label>
          <Input
            id="user-reset-password"
            type="password"
            required
            placeholder="Enter at least 6 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>

        <div className="admin-inline-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="submit-primary-btn amber">
            {loading ? "Resetting..." : "Confirm Password Reset"}
          </Button>
        </div>
      </form>
    </AdminInlinePanel>
  );
}
