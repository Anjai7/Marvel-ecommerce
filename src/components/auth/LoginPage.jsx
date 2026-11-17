import { useState } from "react";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  AlertCircle,
  ShieldCheck,
  Truck,
  Award,
  X,
  CheckCircle2,
} from "lucide-react";
import { Button, Input, useToast } from "../ui";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { apiRequestPasswordReset, apiResetPassword } from "../../api/backendApi";
import { navigateToPath } from "../../lib/routes";

export default function LoginPage({ onLoginSuccess, onNavigateSignUp, onNavigateHome }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStep, setForgotStep] = useState(1); // 1: enter email, 2: token + new password, 3: success
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");

  const { login } = useAuth();
  const { addToast } = useToast();
  const { settings } = useSettings();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");

    try {
      // Authenticate securely with backend
      const user = await login({
        email: email.trim().toLowerCase(),
        password,
      });

      addToast({
        title: `Welcome back, ${user.full_name}!`,
        message: `Signed in successfully.`,
        type: "success",
      });

      if (onLoginSuccess) {
        onLoginSuccess(user);
      } else {
        // Automatically route to user's authorized workspace based on database role
        if (user.role === "vendor") navigateToPath("/vendor");
        else if (user.role === "admin") navigateToPath("/admin");
        else if (user.role === "super_admin") navigateToPath("/super-admin");
        else navigateToPath("/");
      }
    } catch (err) {
      // Generic error message - zero metadata disclosure
      setErrorMsg("Invalid email or password. Please check your credentials.");
      addToast({
        title: "Authentication Failed",
        message: "Invalid email or password.",
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError("");

    try {
      if (forgotStep === 1) {
        const body = await apiRequestPasswordReset(forgotEmail.trim());
        // Local development only: the server echoes the token when
        // EXPOSE_RESET_TOKEN=true. In every other case no token is returned and
        // reset delivery is still a follow-up.
        setResetToken(body?.resetToken || "");
        setForgotStep(2);
      } else if (forgotStep === 2) {
        if (!resetToken.trim()) {
          setForgotError("Enter the reset token you received.");
          setForgotLoading(false);
          return;
        }
        if (newPassword !== confirmNewPassword) {
          setForgotError("Passwords do not match.");
          setForgotLoading(false);
          return;
        }
        if (newPassword.length < 6) {
          setForgotError("Password must be at least 6 characters long.");
          setForgotLoading(false);
          return;
        }
        await apiResetPassword(resetToken.trim(), newPassword);
        setForgotStep(3);
        addToast({
          title: "Password Reset Successful",
          message: "You can now sign in with your new password.",
          type: "success",
        });
      }
    } catch (err) {
      setForgotError(err.message || "Failed to process request.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="auth-shell auth-shell--login">
      {/* Dedicated Top Back Navigation */}
      <div className="auth-top-bar">
        <button
          type="button"
          className="auth-back-btn"
          onClick={() => {
            if (onNavigateHome) onNavigateHome();
            else navigateToPath("/");
          }}
          aria-label="Back to store"
        >
          <ArrowLeft size={18} />
          <span>Back to Store</span>
        </button>
      </div>

      <div className="auth-card">
        {/* Left Side: Clean Brand Panel */}
        <div className="auth-brand auth-brand--login">
          {/* Subtle Ambient Glow Effect */}
          <div className="auth-brand-glow" aria-hidden="true" />

          <div className="auth-brand-content">
            <div className="auth-badge">
              <Sparkles size={14} color="#ffd700" /> Marvel Premium Tech
            </div>

            <h2 className="auth-brand-title">Smart Tech for Smarter Living</h2>
            <p className="auth-brand-text">
              Access your personalized recommendations, track your active shipments, and manage your
              wishlist.
            </p>

            <div className="auth-feature-list">
              <div className="auth-feature">
                <div className="auth-feature-icon">
                  <Award size={18} color="#93c5fd" />
                </div>
                <span>
                  <strong>Curated Catalog</strong> — 100% Genuine, tested devices
                </span>
              </div>

              <div className="auth-feature">
                <div className="auth-feature-icon">
                  <Truck size={18} color="#93c5fd" />
                </div>
                <span>
                  <strong>Express Delivery</strong> — Real-time live shipment tracking
                </span>
              </div>

              <div className="auth-feature">
                <div className="auth-feature-icon">
                  <ShieldCheck size={18} color="#93c5fd" />
                </div>
                <span>
                  <strong>Buyer Protection</strong> — 2-Year comprehensive warranty
                </span>
              </div>
            </div>
          </div>

          <div className="auth-brand-footer">{settings?.footer?.copyright || ""}</div>
        </div>

        {/* Right Side: Sign In Form */}
        <div className="auth-form-panel auth-form-panel--center">
          <div className="auth-form-header">
            <h3 className="auth-form-title">Sign In</h3>
            <p className="auth-form-subtitle">
              Enter your email and password to access your account
            </p>
          </div>

          {errorMsg && (
            <div className="auth-error">
              <AlertCircle size={18} className="auth-error-icon" />
              <div>{errorMsg}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div>
              <label className="auth-label">Email Address</label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail size={16} />}
                required
              />
            </div>

            <div>
              <div className="auth-password-row">
                <label className="auth-label-inline">Password</label>
                <button
                  type="button"
                  className="auth-text-button auth-text-button--sm"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotStep(1);
                    setForgotError("");
                    setResetToken("");
                    setNewPassword("");
                    setConfirmNewPassword("");
                    setShowForgotModal(true);
                  }}
                >
                  Forgot password?
                </button>
              </div>

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

            {/* Remember Me */}
            <div className="auth-remember-row">
              <label className="auth-remember-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="auth-checkbox"
                />
                Remember me on this browser
              </label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={submitting}
              className="auth-submit"
            >
              {submitting ? "Signing in..." : "Sign In"}
              <ArrowRight size={16} className="auth-submit-icon" />
            </Button>

            <div className="auth-switch">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                className="auth-text-button auth-text-button--bold"
                onClick={() => {
                  if (onNavigateSignUp) onNavigateSignUp();
                  else navigateToPath("/signup");
                }}
              >
                Create an account
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── FORGOT PASSWORD MODAL ── */}
      {showForgotModal && (
        <div className="auth-modal-overlay">
          <div className="auth-modal">
            <button
              type="button"
              className="auth-modal-close"
              onClick={() => setShowForgotModal(false)}
              aria-label="Close"
            >
              <X size={16} />
            </button>

            {forgotStep === 1 && (
              <form onSubmit={handleForgotSubmit}>
                <div className="auth-modal-header">
                  <div className="auth-modal-icon">
                    <Lock size={22} />
                  </div>
                  <h3 className="auth-modal-title">Reset Password</h3>
                  <p className="auth-modal-text">
                    Enter your registered email address to request a password reset
                  </p>
                </div>

                {forgotError && <div className="auth-modal-error">{forgotError}</div>}

                <div className="auth-modal-field">
                  <label className="auth-label">Email Address</label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={forgotLoading}
                  className="auth-modal-submit"
                >
                  Continue to Set New Password
                </Button>
              </form>
            )}

            {forgotStep === 2 && (
              <form onSubmit={handleForgotSubmit}>
                <div className="auth-modal-header">
                  <h3 className="auth-modal-title">Set New Password</h3>
                  <p className="auth-modal-text">
                    Enter the reset token you received for <strong>{forgotEmail}</strong>. In local
                    development it is filled in automatically.
                  </p>
                </div>

                {forgotError && <div className="auth-modal-error">{forgotError}</div>}

                <div className="auth-modal-fields">
                  <div>
                    <label className="auth-label">Reset Token</label>
                    <Input
                      type="text"
                      aria-label="Reset Token"
                      placeholder="Paste the reset token"
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      required
                      autoFocus={!resetToken}
                    />
                    <p className="auth-modal-hint">
                      Local development only: this field is prefilled when the server exposes the
                      reset token.
                    </p>
                  </div>

                  <div>
                    <label className="auth-label">New Password (min 6 chars)</label>
                    <Input
                      type="password"
                      aria-label="New Password (min 6 chars)"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="auth-label">Confirm New Password</label>
                    <Input
                      type="password"
                      aria-label="Confirm New Password"
                      placeholder="••••••••"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={forgotLoading}
                  className="auth-modal-submit"
                >
                  Update &amp; Save Password
                </Button>
              </form>
            )}

            {forgotStep === 3 && (
              <div className="auth-modal-success">
                <div className="auth-modal-icon auth-modal-icon--success">
                  <CheckCircle2 size={30} />
                </div>
                <h3 className="auth-modal-title auth-modal-title--spaced">
                  Password Reset Complete!
                </h3>
                <p className="auth-modal-text auth-modal-text--success">
                  Your password has been successfully updated. You can now log in with your new
                  credentials.
                </p>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setShowForgotModal(false);
                    setPassword("");
                    setResetToken("");
                    setNewPassword("");
                    setConfirmNewPassword("");
                  }}
                  className="auth-modal-submit"
                >
                  Back to Sign In
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
