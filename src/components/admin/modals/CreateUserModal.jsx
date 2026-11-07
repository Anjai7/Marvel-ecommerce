import { Plus, X, Sparkles, Eye, RefreshCw, Check, AlertCircle } from "lucide-react";
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
  errors = {},
  clearError,
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

        <form onSubmit={onSubmit} className="modal-form" noValidate>
          <div className="form-group-row">
            <div className="form-group">
              <label
                className="form-label"
                htmlFor="user-create-fullname"
                style={{
                  color: errors.fullName ? "#dc2626" : undefined,
                  fontWeight: 600,
                }}
              >
                Full Name <span style={{ color: "#ef4444", fontWeight: 700 }}>*</span>{" "}
                <span
                  style={{
                    fontSize: "11px",
                    color: errors.fullName ? "#dc2626" : "#ef4444",
                    fontWeight: 600,
                  }}
                >
                  (Mandatory)
                </span>
              </label>
              <Input
                id="user-create-fullname"
                type="text"
                placeholder="e.g. Alex Morgan"
                value={form.fullName}
                style={
                  errors.fullName
                    ? {
                        borderColor: "#ef4444",
                        borderWidth: "2px",
                        backgroundColor: "#fef2f2",
                        boxShadow: "0 0 0 3px rgba(239, 68, 68, 0.15)",
                      }
                    : {}
                }
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, fullName: e.target.value }));
                  clearError?.("fullName");
                }}
              />
              {errors.fullName && (
                <span
                  className="field-error-text"
                  style={{
                    color: "#dc2626",
                    fontSize: "12px",
                    fontWeight: 600,
                    marginTop: "5px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <AlertCircle size={13} color="#dc2626" />
                  {errors.fullName}
                </span>
              )}
            </div>

            <div className="form-group">
              <label
                className="form-label"
                htmlFor="user-create-email"
                style={{
                  color: errors.email ? "#dc2626" : undefined,
                  fontWeight: 600,
                }}
              >
                Email Address <span style={{ color: "#ef4444", fontWeight: 700 }}>*</span>{" "}
                <span
                  style={{
                    fontSize: "11px",
                    color: errors.email ? "#dc2626" : "#ef4444",
                    fontWeight: 600,
                  }}
                >
                  (Mandatory)
                </span>
              </label>
              <Input
                id="user-create-email"
                type="email"
                placeholder="alex@marvel.com"
                value={form.email}
                style={
                  errors.email
                    ? {
                        borderColor: "#ef4444",
                        borderWidth: "2px",
                        backgroundColor: "#fef2f2",
                        boxShadow: "0 0 0 3px rgba(239, 68, 68, 0.15)",
                      }
                    : {}
                }
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, email: e.target.value }));
                  clearError?.("email");
                }}
              />
              {errors.email && (
                <span
                  className="field-error-text"
                  style={{
                    color: "#dc2626",
                    fontSize: "12px",
                    fontWeight: 600,
                    marginTop: "5px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <AlertCircle size={13} color="#dc2626" />
                  {errors.email}
                </span>
              )}
            </div>
          </div>

          <div className="form-group">
            <div className="label-with-action">
              <label
                className="form-label"
                htmlFor="user-create-password"
                style={{
                  color: errors.password ? "#dc2626" : undefined,
                  fontWeight: 600,
                }}
              >
                Temporary Password <span style={{ color: "#ef4444", fontWeight: 700 }}>*</span>{" "}
                <span
                  style={{
                    fontSize: "11px",
                    color: errors.password ? "#dc2626" : "#ef4444",
                    fontWeight: 600,
                  }}
                >
                  (Mandatory)
                </span>
              </label>
              <button type="button" onClick={onGeneratePassword} className="generate-pass-btn">
                <Sparkles size={12} /> Auto-Generate
              </button>
            </div>
            <div className="password-input-wrapper">
              <Input
                id="user-create-password"
                type={showPassword ? "text" : "password"}
                placeholder="Minimum 6 characters"
                value={form.password}
                style={
                  errors.password
                    ? {
                        borderColor: "#ef4444",
                        borderWidth: "2px",
                        backgroundColor: "#fef2f2",
                        boxShadow: "0 0 0 3px rgba(239, 68, 68, 0.15)",
                      }
                    : {}
                }
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, password: e.target.value }));
                  clearError?.("password");
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="toggle-password-btn"
              >
                {showPassword ? <X size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <span
                className="field-error-text"
                style={{
                  color: "#dc2626",
                  fontSize: "12px",
                  fontWeight: 600,
                  marginTop: "5px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <AlertCircle size={13} color="#dc2626" />
                {errors.password}
              </span>
            )}
          </div>

          <div className="form-group-row">
            <div className="form-group">
              <label className="form-label" htmlFor="user-create-role">
                Account Role <span style={{ color: "#ef4444", fontWeight: 700 }}>*</span>{" "}
                <span style={{ fontSize: "11px", color: "#ef4444", fontWeight: 600 }}>
                  (Mandatory)
                </span>
              </label>
              <select
                id="user-create-role"
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
              <label
                className="form-label"
                htmlFor="user-create-storename"
                style={{
                  color: errors.storeName ? "#dc2626" : undefined,
                  fontWeight: 600,
                }}
              >
                Store / Business Name <span style={{ color: "#ef4444", fontWeight: 700 }}>*</span>{" "}
                <span
                  style={{
                    fontSize: "11px",
                    color: errors.storeName ? "#dc2626" : "#ef4444",
                    fontWeight: 600,
                  }}
                >
                  (Mandatory)
                </span>
              </label>
              <Input
                id="user-create-storename"
                type="text"
                placeholder="e.g. Apex Electronics"
                value={form.storeName}
                style={
                  errors.storeName
                    ? {
                        borderColor: "#ef4444",
                        borderWidth: "2px",
                        backgroundColor: "#fef2f2",
                        boxShadow: "0 0 0 3px rgba(239, 68, 68, 0.15)",
                      }
                    : {}
                }
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, storeName: e.target.value }));
                  clearError?.("storeName");
                }}
              />
              {errors.storeName && (
                <span
                  className="field-error-text"
                  style={{
                    color: "#dc2626",
                    fontSize: "12px",
                    fontWeight: 600,
                    marginTop: "5px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <AlertCircle size={13} color="#dc2626" />
                  {errors.storeName}
                </span>
              )}
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
