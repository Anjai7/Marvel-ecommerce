import { useState } from "react";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
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

export default function LoginPage({ onLoginSuccess, onNavigateSignUp }) {
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
        if (user.role === "vendor") window.location.hash = "#/vendor";
        else if (user.role === "admin") window.location.hash = "#/admin";
        else if (user.role === "super_admin") window.location.hash = "#/super-admin";
        else window.location.hash = "#/";
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
    <div
      style={{
        minHeight: "calc(100vh - 120px)",
        background: "var(--gray-50, #f8fafc)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 16px",
      }}
    >
      <div
        style={{
          maxWidth: 880,
          width: "100%",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
          background: "#ffffff",
          borderRadius: 20,
          boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0,0,0,0.1)",
          overflow: "hidden",
        }}
      >
        {/* Left Side: Brand & Hero Showcase Panel */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            background:
              "linear-gradient(180deg, rgba(15, 23, 42, 0.74) 0%, rgba(15, 23, 42, 0.92) 100%), url('/login-hero.jpg') center/cover no-repeat",
            color: "#ffffff",
            padding: "clamp(28px, 5vw, 44px) clamp(22px, 4vw, 36px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* Subtle Ambient Glow Effect */}
          <div
            style={{
              position: "absolute",
              top: -60,
              right: -60,
              width: 180,
              height: 180,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(59, 130, 246, 0.35) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(255, 255, 255, 0.14)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                padding: "6px 14px",
                borderRadius: 30,
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.5px",
                marginBottom: 24,
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
              }}
            >
              <Sparkles size={14} color="#ffd700" /> Marvel Premium Tech
            </div>

            <h2
              style={{
                fontSize: 28,
                fontWeight: 800,
                marginBottom: 12,
                color: "#ffffff",
                lineHeight: 1.3,
                textShadow: "0 2px 12px rgba(0, 0, 0, 0.45)",
              }}
            >
              Smart Tech for Smarter Living
            </h2>
            <p
              style={{
                fontSize: 14,
                color: "rgba(255, 255, 255, 0.88)",
                marginBottom: 32,
                lineHeight: 1.6,
                textShadow: "0 1px 6px rgba(0, 0, 0, 0.35)",
              }}
            >
              Access your personalized recommendations, track your active shipments, and manage your
              wishlist.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  fontSize: 13,
                  color: "#ffffff",
                  background: "rgba(255, 255, 255, 0.08)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  border: "1px solid rgba(255, 255, 255, 0.14)",
                  padding: "10px 14px",
                  borderRadius: 12,
                  boxShadow: "0 4px 14px rgba(0, 0, 0, 0.12)",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "rgba(37, 99, 235, 0.35)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Award size={18} color="#93c5fd" />
                </div>
                <span>
                  <strong>Curated Catalog</strong> — 100% Genuine, tested devices
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  fontSize: 13,
                  color: "#ffffff",
                  background: "rgba(255, 255, 255, 0.08)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  border: "1px solid rgba(255, 255, 255, 0.14)",
                  padding: "10px 14px",
                  borderRadius: 12,
                  boxShadow: "0 4px 14px rgba(0, 0, 0, 0.12)",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "rgba(37, 99, 235, 0.35)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Truck size={18} color="#93c5fd" />
                </div>
                <span>
                  <strong>Express Delivery</strong> — Real-time live shipment tracking
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  fontSize: 13,
                  color: "#ffffff",
                  background: "rgba(255, 255, 255, 0.08)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  border: "1px solid rgba(255, 255, 255, 0.14)",
                  padding: "10px 14px",
                  borderRadius: 12,
                  boxShadow: "0 4px 14px rgba(0, 0, 0, 0.12)",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "rgba(37, 99, 235, 0.35)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <ShieldCheck size={18} color="#93c5fd" />
                </div>
                <span>
                  <strong>Buyer Protection</strong> — 2-Year comprehensive warranty
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              position: "relative",
              zIndex: 1,
              marginTop: 36,
              fontSize: 12,
              color: "rgba(255, 255, 255, 0.75)",
            }}
          >
            {settings?.footer?.copyright || ""}
          </div>
        </div>

        {/* Right Side: Sign In Form */}
        <div
          style={{
            padding: "clamp(24px, 5vw, 44px) clamp(18px, 4vw, 38px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ marginBottom: 28 }}>
            <h3
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "var(--gray-900, #0f172a)",
                marginBottom: 6,
              }}
            >
              Sign In
            </h3>
            <p style={{ fontSize: 14, color: "var(--gray-500, #64748b)" }}>
              Enter your email and password to access your account
            </p>
          </div>

          {errorMsg && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: 14,
                borderRadius: 10,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                fontSize: 13,
                marginBottom: 20,
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>{errorMsg}</div>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 18 }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--gray-700)",
                  marginBottom: 6,
                }}
              >
                Email Address
              </label>
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
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-700)" }}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotStep(1);
                    setForgotError("");
                    setResetToken("");
                    setNewPassword("");
                    setConfirmNewPassword("");
                    setShowForgotModal(true);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: 12,
                    color: "var(--navy-light, #1e40af)",
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Forgot password?
                </button>
              </div>

              <div style={{ position: "relative" }}>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock size={16} />}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--gray-400)",
                    cursor: "pointer",
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: "var(--gray-600)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ borderRadius: 4 }}
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
              style={{
                background: "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)",
                border: "none",
                borderRadius: 10,
                fontWeight: 700,
                marginTop: 10,
              }}
            >
              {submitting ? "Signing in..." : "Sign In"}
              <ArrowRight size={16} style={{ marginLeft: 8 }} />
            </Button>

            <div
              style={{ textAlign: "center", marginTop: 14, fontSize: 13, color: "var(--gray-500)" }}
            >
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  if (onNavigateSignUp) onNavigateSignUp();
                  else window.location.hash = "#/signup";
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--navy-light, #1e40af)",
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: 0,
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
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              maxWidth: 440,
              width: "100%",
              padding: 30,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              position: "relative",
            }}
          >
            <button
              onClick={() => setShowForgotModal(false)}
              style={{
                position: "absolute",
                top: 18,
                right: 18,
                background: "#f1f5f9",
                border: "none",
                borderRadius: "50%",
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={16} />
            </button>

            {forgotStep === 1 && (
              <form onSubmit={handleForgotSubmit}>
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      background: "#eff6ff",
                      color: "#2563eb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 12px",
                    }}
                  >
                    <Lock size={22} />
                  </div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                    Reset Password
                  </h3>
                  <p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
                    Enter your registered email address to request a password reset
                  </p>
                </div>

                {forgotError && (
                  <div
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      background: "#fef2f2",
                      color: "#991b1b",
                      fontSize: 13,
                      marginBottom: 16,
                    }}
                  >
                    {forgotError}
                  </div>
                )}

                <div style={{ marginBottom: 20 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: 6,
                    }}
                  >
                    Email Address
                  </label>
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
                  style={{ width: "100%", background: "#2563eb", borderRadius: 8 }}
                >
                  Continue to Set New Password
                </Button>
              </form>
            )}

            {forgotStep === 2 && (
              <form onSubmit={handleForgotSubmit}>
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                    Set New Password
                  </h3>
                  <p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
                    Enter the reset token you received for <strong>{forgotEmail}</strong>. In local
                    development it is filled in automatically.
                  </p>
                </div>

                {forgotError && (
                  <div
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      background: "#fef2f2",
                      color: "#991b1b",
                      fontSize: 13,
                      marginBottom: 16,
                    }}
                  >
                    {forgotError}
                  </div>
                )}

                <div
                  style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: 6,
                      }}
                    >
                      Reset Token
                    </label>
                    <Input
                      type="text"
                      aria-label="Reset Token"
                      placeholder="Paste the reset token"
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      required
                      autoFocus={!resetToken}
                    />
                    <p style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
                      Local development only: this field is prefilled when the server exposes the
                      reset token.
                    </p>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: 6,
                      }}
                    >
                      New Password (min 6 chars)
                    </label>
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
                    <label
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: 6,
                      }}
                    >
                      Confirm New Password
                    </label>
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
                  style={{ width: "100%", background: "#2563eb", borderRadius: 8 }}
                >
                  Update &amp; Save Password
                </Button>
              </form>
            )}

            {forgotStep === 3 && (
              <div style={{ textAlign: "center", padding: "10px 0" }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    background: "#dcfce7",
                    color: "#16a34a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px",
                  }}
                >
                  <CheckCircle2 size={30} />
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
                  Password Reset Complete!
                </h3>
                <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>
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
                  style={{ width: "100%", background: "#2563eb", borderRadius: 8 }}
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
