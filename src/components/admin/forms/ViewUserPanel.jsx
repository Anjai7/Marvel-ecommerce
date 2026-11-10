import { Eye, Copy, Edit2, Key } from "lucide-react";
import { Button } from "../../ui";
import { formatAdminDate, displayValue, displayInitial } from "../adminConstants";
import AdminInlinePanel from "../AdminInlinePanel";

/**
 * The user profile overview, shown inline in the Users tab.
 *
 * The panel sits above the user table rather than over it, so the accounts
 * on the page stay visible while one of them is inspected.
 */
export default function ViewUserPanel({
  user,
  onClose,
  renderRoleBadge,
  renderStatusBadge,
  onEdit,
  onResetPassword,
  onToggleStatus,
  onCopyId,
}) {
  if (!user) return null;

  return (
    <AdminInlinePanel
      open
      title="User Account Overview"
      subtitle="Direct profile details from Supabase database"
      icon={<Eye size={20} />}
      tone="blue"
      onClose={onClose}
      closeLabel="Close the user overview"
    >
      <div className="view-user-body">
        {/* Profile Card Header */}
        <div className="view-profile-hero">
          <div className={`view-hero-avatar ${user.role}`}>
            {displayInitial(user.full_name || user.email)}
          </div>
          <div className="view-hero-info">
            <h4 className="hero-full-name">{displayValue(user.full_name)}</h4>
            <p className="hero-email">{displayValue(user.email)}</p>
            <div className="hero-badges-row">
              {renderRoleBadge(user.role)}
              {renderStatusBadge(user.status)}
            </div>
          </div>
        </div>

        {/* User Metadata Grid */}
        <div className="view-metadata-grid">
          <div className="meta-info-item">
            <span className="meta-label">USER ID</span>
            <div className="copyable-id">
              <span className="meta-value font-mono">{user.id}</span>
              <button onClick={() => onCopyId(user.id)} className="copy-id-btn" title="Copy ID">
                <Copy size={12} />
              </button>
            </div>
          </div>

          <div className="meta-info-item">
            <span className="meta-label">REGISTERED DATE</span>
            <span className="meta-value">{formatAdminDate(user.created_at)}</span>
          </div>

          <div className="meta-info-item">
            <span className="meta-label">SUBSCRIPTION PLAN</span>
            <span className="meta-value">{displayValue(user.plan)}</span>
          </div>

          <div className="meta-info-item">
            <span className="meta-label">BILLING METHOD</span>
            <span className="meta-value">{displayValue(user.billing)}</span>
          </div>

          {user.role === "vendor" && (
            <div className="meta-info-item full-width">
              <span className="meta-label">VENDOR STORE NAME</span>
              <span className="meta-value font-bold text-emerald">
                {displayValue(user.store_name)}
              </span>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="view-quick-actions">
          <Button variant="outline" onClick={() => onEdit(user)} className="quick-action-btn">
            <Edit2 size={15} /> Edit Profile
          </Button>

          <Button
            variant="outline"
            onClick={() => onResetPassword(user)}
            className="quick-action-btn"
          >
            <Key size={15} /> Reset Password
          </Button>

          <Button
            variant="outline"
            onClick={() => onToggleStatus(user.id, user.status, user.full_name || user.email)}
            className="quick-action-btn"
          >
            {user.status === "active" ? "Deactivate User" : "Activate User"}
          </Button>
        </div>
      </div>

      <div className="admin-inline-actions">
        <Button onClick={onClose} className="full-width-btn">
          Close Panel
        </Button>
      </div>
    </AdminInlinePanel>
  );
}
