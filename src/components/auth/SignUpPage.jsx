import { useState } from "react";
import {
  User,
  Store,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Truck,
  Award,
  Building,
} from "lucide-react";
import { Button, Input, useToast } from "../ui";
import { useAuth } from "../../context/AuthContext";
import { navigateToPath } from "../../lib/routes";

export default function SignUpPage({ onSignUpSuccess, onNavigateLogin }) {
  const [role, setRole] = useState("user"); // Strictly "user" or "vendor"
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [storeName, setStoreName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const { signup } = useAuth();
  const { addToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please re-enter.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    if (!agreeTerms) {
      setErrorMsg("You must accept the terms of service to create an account.");
      return;
    }

    setLoading(true);

    try {
      const newUser = await signup({
        email: email.trim().toLowerCase(),
        password,
        fullName,
        role: role === "vendor" ? "vendor" : "user",
        storeName: role === "vendor" ? storeName : undefined,
      });

      addToast({
        title: "Account Created Successfully!",
        message: `Welcome to Marvel, ${fullName}! Your ${role === "vendor" ? "Vendor Store" : "Customer"} account is ready.`,
        type: "success",
      });

      if (onSignUpSuccess) {
        onSignUpSuccess(newUser);
      } else {
        if (newUser.role === "vendor") navigateToPath("/vendor");
        else navigateToPath("/");
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed to create account. Please try again.");
      addToast({
        title: "Sign Up Error",
        message: err.message || "Could not register",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell auth-shell--signup">
      <div className="auth-card auth-card--signup">
        {/* Left Side: Brand Showcase */}
        <div className="auth-brand auth-brand--signup">
          <div className="auth-brand-content">
            <div className="auth-badge auth-badge--signup">
              <Sparkles size={14} color="#ffd700" /> Create Your Account
            </div>

            <h2 className="auth-brand-title">Join Marvel Marketplace</h2>
            <p className="auth-brand-text">
              Shop top-tier consumer tech or open your certified vendor store to reach thousands of
              verified buyers.
            </p>

            <div className="auth-feature-list auth-feature-list--roomy">
              <div className="auth-perk">
                <div className="auth-perk-icon">
                  <Award size={18} />
                </div>
                <div>
                  <div className="auth-perk-title">Member &amp; Seller Benefits</div>
                  <div className="auth-perk-sub">
                    Special member pricing, sales analytics &amp; order management
                  </div>
                </div>
              </div>

              <div className="auth-perk">
                <div className="auth-perk-icon">
                  <Truck size={18} />
                </div>
                <div>
                  <div className="auth-perk-title">Live Order &amp; Shipment Tracking</div>
                  <div className="auth-perk-sub">Real-time updates on dispatch and fulfillment</div>
                </div>
              </div>

              <div className="auth-perk">
                <div className="auth-perk-icon">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <div className="auth-perk-title">Buyer &amp; Vendor Protection</div>
                  <div className="auth-perk-sub">Verified authenticity and secure payments</div>
                </div>
              </div>
            </div>
          </div>

          <div className="auth-brand-footer auth-brand-footer--signup">
            Already have an account?{" "}
            <button
              type="button"
              className="auth-text-button auth-text-button--on-dark"
              onClick={onNavigateLogin}
            >
              Sign In here
            </button>
          </div>
        </div>

        {/* Right Side: Registration Form */}
        <div className="auth-form-panel">
          <div className="auth-form-header auth-form-header--compact">
            <h3 className="auth-form-title auth-form-title--flush">Create Account</h3>
            <p className="auth-form-subtitle auth-form-subtitle--sm">
              Register as a Customer or Seller on Marvel
            </p>
          </div>

          {errorMsg && (
            <div className="auth-error auth-error--signup">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form auth-form--signup">
            {/* Account Type (Strictly Customer or Vendor) */}
            <div>
              <label className="auth-label auth-label--caps">Select Account Type</label>
              <div className="auth-role-grid">
                <button
                  type="button"
                  className={`auth-role-option${role === "user" ? " auth-role-option--user" : ""}`}
                  onClick={() => setRole("user")}
                  aria-pressed={role === "user"}
                >
                  <User size={18} color={role === "user" ? "#2563eb" : "#64748b"} />
                  <div className="auth-role-text">
                    <div className="auth-role-title">Customer</div>
                    <div className="auth-role-sub">Shop &amp; track orders</div>
                  </div>
                </button>

                <button
                  type="button"
                  className={`auth-role-option${role === "vendor" ? " auth-role-option--vendor" : ""}`}
                  onClick={() => setRole("vendor")}
                  aria-pressed={role === "vendor"}
                >
                  <Store size={18} color={role === "vendor" ? "#7c3aed" : "#64748b"} />
                  <div className="auth-role-text">
                    <div className="auth-role-title">Seller (Vendor)</div>
                    <div className="auth-role-sub">Sell your products</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label className="auth-label auth-label--sm">Full Name</label>
              <Input
                type="text"
                placeholder="Jane Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                leftIcon={<User size={16} />}
                required
              />
            </div>

            {/* Store Name (if Vendor) */}
            {role === "vendor" && (
              <div>
                <label className="auth-label auth-label--sm">Store / Brand Name</label>
                <Input
                  type="text"
                  placeholder="e.g. Nexus Electronics Store"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  leftIcon={<Building size={16} />}
                  required
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="auth-label auth-label--sm">Email Address</label>
              <Input
                type="email"
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail size={16} />}
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="auth-label auth-label--sm">Password (min. 6 characters)</label>
              <div className="auth-password-field">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock size={16} />}
                  className="auth-password-input"
                  required
                />
                <button
                  type="button"
                  className="auth-eye-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="auth-label auth-label--sm">Confirm Password</label>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                leftIcon={<Lock size={16} />}
                required
              />
            </div>

            {/* Terms and Conditions */}
            <div className="auth-terms-row">
              <input
                type="checkbox"
                id="terms"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="auth-checkbox auth-checkbox--offset"
              />
              <label htmlFor="terms" className="auth-terms-label">
                I agree to the{" "}
                <a href="#terms" onClick={(e) => e.preventDefault()} className="auth-terms-link">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#privacy" onClick={(e) => e.preventDefault()} className="auth-terms-link">
                  Privacy Policy
                </a>
              </label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={loading}
              className="auth-submit auth-submit--signup"
            >
              {loading
                ? "Creating Account..."
                : `Sign Up as ${role === "vendor" ? "Vendor" : "Customer"}`}
              <ArrowRight size={16} className="auth-submit-icon" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
