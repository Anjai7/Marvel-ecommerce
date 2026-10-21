import { Plus, X, Sparkles, Eye, RefreshCw, Check } from "lucide-react";
import { Button, Input } from "../../ui";

/**
 * Modal dialog for creating a new user in the Unified Admin Console.
 */
export default function CreateUserModal({
  isOpen,
  onClose,
  form,
  setForm,
  onSubmit,
  loading,
  isSuperAdmin,
  showPassword,
  setShowPassword,
  onGeneratePassword,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop-overlay">
      <div className="modal-content-container animate-scale-up">
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <div className="modal-icon-bubble purple">
              <Plus size={20} />
            </div>
            <div>
              <h3 className="modal-title">Create User Account</h3>
              <p className="modal-subtitle">
                Add a new authenticated user profile to Supabase database
              </p>
            </div>
          </div>
          <button onClick={onClose} className="modal-close-btn">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="modal-form">
          <div className="form-group-row">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <Input
                required
                type="text"
                placeholder="e.g. Alex Morgan"
                value={form.fullName}
                onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <Input
                required
                type="email"
                placeholder="alex@marvel.com"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
          </div>

          <div className="form-group">
            <div className="label-with-action">
              <label className="form-label">Temporary Password *</label>
              <button type="button" onClick={onGeneratePassword} className="generate-pass-btn">
                <Sparkles size={12} /> Auto-Generate
              </button>
            </div>
            <div className="password-input-wrapper">
              <Input
                required
                type={showPassword ? "text" : "password"}
                placeholder="Minimum 6 characters"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="toggle-password-btn"
              >
                {showPassword ? <X size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group-row">
            <div className="form-group">
              <label className="form-label">Account Role *</label>
              <select
                value={form.role}
                onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                className="form-select-field"
              >
                <option value="user">Customer (Standard Shopper)</option>
                <option value="vendor">Vendor / Seller</option>
                <option value="admin">Platform Admin</option>
                {isSuperAdmin && <option value="super_admin">Super Admin (Root)</option>}
              </select>
            </div>
          </div>

          {form.role === "vendor" && (
            <div className="form-group animate-fade-in">
              <label className="form-label">Store / Business Name *</label>
              <Input
                type="text"
                placeholder="e.g. Apex Electronics"
                value={form.storeName}
                onChange={(e) => setForm((prev) => ({ ...prev, storeName: e.target.value }))}
              />
            </div>
          )}

          <div className="modal-actions-footer">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="submit-primary-btn">
              {loading ? (
                <>
                  <RefreshCw size={15} className="spin-animation" /> Creating...
                </>
              ) : (
                <>
                  <Check size={16} /> Create User Account
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
