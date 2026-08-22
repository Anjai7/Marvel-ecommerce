import { useState } from "react";
import {
  User,
  ShieldCheck,
  Store,
  Zap,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  AlertCircle
} from "lucide-react";
import { Button, Input, useToast } from "../ui";
import { useAuth } from "../../context/AuthContext";

export default function LoginPage({ onLoginSuccess, onNavigateSignUp }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const { login } = useAuth();
  const { addToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");

    try {
      // Authenticate securely with backend (no role disclosure)
      const user = await login({
        email: email.trim().toLowerCase(),
        password
      });

      addToast({
        title: `Welcome back, ${user.full_name}!`,
        message: `Signed in successfully.`,
        type: "success"
      });

      if (onLoginSuccess) {
        onLoginSuccess(user);
      } else {
        // Automatically route to the user's authorized workspace based on database role
        if (user.role === "vendor") window.location.hash = "#/vendor";
        else if (user.role === "admin") window.location.hash = "#/admin";
        else if (user.role === "super_admin") window.location.hash = "#/super-admin";
        else window.location.hash = "#/";
      }
    } catch (err) {
      // Secure generic error message - never leak internal role or existence
      setErrorMsg("Invalid email or password. Please check your credentials.");
      addToast({
        title: "Authentication Failed",
        message: "Invalid email or password.",
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: "calc(100vh - 120px)",
      background: "var(--gray-50, #f8fafc)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 16px"
    }}>
      <div style={{
        maxWidth: 880,
        width: "100%",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        background: "#ffffff",
        borderRadius: 20,
        boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0,0,0,0.1)",
        overflow: "hidden"
      }}>
        {/* Left Side: Account Portal Overview */}
        <div style={{
          background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
          color: "#ffffff",
          padding: "40px 32px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          transition: "all 0.3s ease"
        }}>
          <div>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(255, 255, 255, 0.15)",
              backdropFilter: "blur(8px)",
              padding: "6px 14px",
              borderRadius: 30,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.5px",
              marginBottom: 24
            }}>
              <Sparkles size={14} color="#ffd700" /> Marvel Universal Sign In
            </div>

            <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12, color: "#ffffff" }}>
              Welcome to Marvel
            </h2>
            <p style={{ fontSize: 14, color: "rgba(255, 255, 255, 0.85)", marginBottom: 28, lineHeight: 1.6 }}>
              One unified account for customers, vendors, operators, and platform administrators.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "rgba(255,255,255,0.9)" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <User size={16} />
                </div>
                <span><strong>Customers</strong>: Track orders, wishlist &amp; express checkout</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "rgba(255,255,255,0.9)" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Store size={16} />
                </div>
                <span><strong>Vendors</strong>: Manage store products &amp; order fulfillment</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "rgba(255,255,255,0.9)" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ShieldCheck size={16} />
                </div>
                <span><strong>Operations &amp; Admin</strong>: Catalog moderation &amp; governance</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 32, fontSize: 12, color: "rgba(255, 255, 255, 0.75)" }}>
            Secured by JWT Authentication &amp; Supabase PostgreSQL.
          </div>
        </div>

        {/* Right Side: Unified Sign In Form */}
        <div style={{ padding: "40px 36px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 24, fontWeight: 700, color: "var(--gray-900, #0f172a)", marginBottom: 6 }}>
              Sign In
            </h3>
            <p style={{ fontSize: 14, color: "var(--gray-500, #64748b)" }}>
              Enter your registered email and password to continue
            </p>
          </div>

          {errorMsg && (
            <div style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: 14,
              borderRadius: 10,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              fontSize: 13,
              marginBottom: 20
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>{errorMsg}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--gray-700)", marginBottom: 6 }}>
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-700)" }}>
                  Password
                </label>
                <a href="#forgot" onClick={(e) => e.preventDefault()} style={{ fontSize: 12, color: "var(--navy-light, #1e40af)", fontWeight: 500 }}>
                  Forgot password?
                </a>
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
                    cursor: "pointer"
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--gray-600)", cursor: "pointer" }}>
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
                marginTop: 10
              }}
            >
              {submitting ? "Signing in..." : "Sign In"}
              <ArrowRight size={16} style={{ marginLeft: 8 }} />
            </Button>

            <div style={{ textAlign: "center", marginTop: 14, fontSize: 13, color: "var(--gray-500)" }}>
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
                  padding: 0
                }}
              >
                Create an account
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
