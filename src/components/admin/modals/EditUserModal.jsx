import { Edit2, X, RefreshCw, Check } from "lucide-react";
import { Button, Input } from "../../ui";
import { EMPTY } from "../adminConstants";

/**
 * Modal dialog for editing user profile in the Unified Admin Console.
 */
export default function EditUserModal({
  user,
  onClose,
  form,
  setForm,
  onSubmit,
  loading,
  isSuperAdmin,
}) {
  if (!user) return null;

  return (
    <div className="modal-backdrop-overlay">
      <div className="modal-content-container animate-scale-up">
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <div className="modal-icon-bubble emerald">
              <Edit2 size={20} />
            </div>
            <div>
              <h3 className="modal-title">Edit User Profile</h3>
              <p className="modal-subtitle">Update user details in Supabase profiles database</p>
            </div>
          </div>
          <button onClick={onClose} className="modal-close-btn">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="modal-form">
          <div className="form-group-row">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <Input
                type="text"
                required
                value={form.full_name}
                onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <Input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
          </div>

          <div className="form-group-row">
            {/* Role Selector */}
            <div className="form-group">
              <label className="form-label">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                className="form-select-field"
              >
                <option value="user">Customer (User)</option>
                <option value="vendor">Vendor</option>
                <option value="admin">Platform Admin</option>
                {isSuperAdmin && <option value="super_admin">Super Admin</option>}
              </select>
            </div>

            {/* Status Selector */}
            <div className="form-group">
              <label className="form-label">Account Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                className="form-select-field"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
                <option value="banned">Banned</option>
              </select>
            </div>
          </div>

          {/* Vendor Store Name */}
          {form.role === "vendor" && (
            <div className="form-group animate-fade-in">
              <label className="form-label">Vendor Store Name</label>
              <Input
                type="text"
                value={form.store_name}
                onChange={(e) => setForm((prev) => ({ ...prev, store_name: e.target.value }))}
              />
            </div>
          )}

          {/* Plan and billing are derived by the server from the account
              role (server/routes/users.js → formatUserProfile) and are not
              stored from the client. The console only shows what the API
              returned; it never offers a value the server would overwrite. */}
          <div className="form-group-row">
            <div className="form-group">
              <label className="form-label" htmlFor="edit-user-plan">
                Plan Tier
              </label>
              <select
                id="edit-user-plan"
                value={form.plan}
                disabled
                aria-describedby="edit-user-plan-hint"
                className="form-select-field"
              >
                <option value="">{EMPTY}</option>
                {form.plan ? <option value={form.plan}>{form.plan}</option> : null}
              </select>
              <p id="edit-user-plan-hint" className="form-field-hint">
                Derived by the server from the account role — read only.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit-user-billing">
                Billing Method
              </label>
              <select
                id="edit-user-billing"
                value={form.billing}
                disabled
                aria-describedby="edit-user-billing-hint"
                className="form-select-field"
              >
                <option value="">{EMPTY}</option>
                {form.billing ? <option value={form.billing}>{form.billing}</option> : null}
              </select>
              <p id="edit-user-billing-hint" className="form-field-hint">
                Derived by the server from the account role — read only.
              </p>
            </div>
          </div>

          <div className="modal-actions-footer">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="submit-primary-btn emerald">
              {loading ? (
                <>
                  <RefreshCw size={15} className="spin-animation" /> Saving...
                </>
              ) : (
                <>
                  <Check size={16} /> Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
