import { X, Sparkles, Eye, RefreshCw, Check, AlertCircle } from "lucide-react";
import clsx from "clsx";
import { Button, Input, RequiredMark } from "../../ui";
import AdminInlinePanel from "../AdminInlinePanel";
import "../admin-forms.css";

/**
 * The create-user form, shown inline in the Users tab.
 *
 * The panel sits above the user table rather than over it, so the accounts
 * already on the page stay visible while a new one is written.
 */
export default function CreateUserForm({
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
    <AdminInlinePanel
      open
      title="Create User Account"
      subtitle="Add a new authenticated user profile to Supabase database"
      onClose={onClose}
      closeLabel="Close the create user form"
    >
      <form onSubmit={onSubmit} className="admin-inline-form" noValidate>
        <div className="form-group-row">
          <div className="form-group">
            <label
              className={clsx(
                "form-label",
                "user-form-label",
                errors.fullName && "user-form-label--invalid"
              )}
              htmlFor="user-create-fullname"
            >
              Full Name <RequiredMark />
            </label>
            <Input
              id="user-create-fullname"
              type="text"
              placeholder="e.g. Alex Morgan"
              required
              value={form.fullName}
              className={clsx(errors.fullName && "user-form-input--invalid")}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, fullName: e.target.value }));
                clearError?.("fullName");
              }}
            />
            {errors.fullName && (
              <span className="field-error-text">
                <AlertCircle size={13} color="#dc2626" />
                {errors.fullName}
              </span>
            )}
          </div>

          <div className="form-group">
            <label
              className={clsx(
                "form-label",
                "user-form-label",
                errors.email && "user-form-label--invalid"
              )}
              htmlFor="user-create-email"
            >
              Email Address <RequiredMark />
            </label>
            <Input
              id="user-create-email"
              type="email"
              placeholder="alex@marvel.com"
              required
              value={form.email}
              className={clsx(errors.email && "user-form-input--invalid")}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, email: e.target.value }));
                clearError?.("email");
              }}
            />
            {errors.email && (
              <span className="field-error-text">
                <AlertCircle size={13} color="#dc2626" />
                {errors.email}
              </span>
            )}
          </div>
        </div>

        <div className="form-group">
          <div className="label-with-action">
            <label
              className={clsx(
                "form-label",
                "user-form-label",
                errors.password && "user-form-label--invalid"
              )}
              htmlFor="user-create-password"
            >
              Temporary Password <RequiredMark />
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
              required
              value={form.password}
              className={clsx(errors.password && "user-form-input--invalid")}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, password: e.target.value }));
                clearError?.("password");
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="toggle-password-btn"
              aria-label={showPassword ? "Hide the password" : "Show the password"}
              aria-pressed={showPassword}
            >
              {showPassword ? <X size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <span className="field-error-text">
              <AlertCircle size={13} color="#dc2626" />
              {errors.password}
            </span>
          )}
        </div>

        <div className="form-group-row">
          <div className="form-group">
            <label className="form-label" htmlFor="user-create-role">
              Account Role <RequiredMark />
            </label>
            <select
              id="user-create-role"
              value={form.role}
              onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
              className="form-select-field"
              required
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
              className={clsx(
                "form-label",
                "user-form-label",
                errors.storeName && "user-form-label--invalid"
              )}
              htmlFor="user-create-storename"
            >
              Store / Business Name <RequiredMark />
            </label>
            <Input
              id="user-create-storename"
              type="text"
              placeholder="e.g. Apex Electronics"
              required
              value={form.storeName}
              className={clsx(errors.storeName && "user-form-input--invalid")}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, storeName: e.target.value }));
                clearError?.("storeName");
              }}
            />
            {errors.storeName && (
              <span className="field-error-text">
                <AlertCircle size={13} color="#dc2626" />
                {errors.storeName}
              </span>
            )}
          </div>
        )}

        <div className="admin-inline-actions">
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
    </AdminInlinePanel>
  );
}
