import { useState } from "react";
import {
  User,
  Store,
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Building,
  ArrowRight
} from "lucide-react";
import { Button, Input, useToast } from "../ui";
import { useAuth } from "../../context/AuthContext";

export default function SignUpPage({ onSignUpSuccess, onNavigateLogin }) {
  const [role, setRole] = useState("user");
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
        role,
        storeName: role === "vendor" ? storeName : undefined
      });

      addToast({
        title: "Account Created Successfully!",
        message: `Welcome to Marvel, ${fullName}! Your ${role.toUpperCase()} account is ready.`,
        type: "success"
      });

      if (onSignUpSuccess) {
        onSignUpSuccess(newUser);
      } else {
        if (newUser.role === "vendor") window.location.hash = "#/vendor";
        else if (newUser.role === "admin") window.location.hash = "#/admin";
        else if (newUser.role === "super_admin") window.location.hash = "#/super-admin";
        else window.location.hash = "#/";
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed to create account. Please try again.");
      addToast({
        title: "Sign Up Error",
        message: err.message || "Could not register",
        type: "error"
      });
    } finally {
      setLoading(false);
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
        maxWidth: 900,
        width: "100%",
        background: "#ffffff",
        borderRadius: 20,
        boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0,0,0,0.1)",
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))"
      }}>
        {/* Left Side: Branding Banner */}
        <div style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #3b82f6 100%)",
          color: "#ffffff",
          padding: "40px 32px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between"
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
              <img src="/header.png" alt="Marvel Logo" style={{ height: 36, filter: "brightness(0) invert(1)" }} />
            </div>

            <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12, lineHeight: 1.3 }}>
              Join the Marvel Platform
            </h2>
            <p style={{ fontSize: 14, color: "rgba(255, 255, 255, 0.8)", lineHeight: 1.6, marginBottom: 32 }}>
              Create an account to shop, launch your seller store, or manage e-commerce catalog operations seamlessly.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <CheckCircle2 size={20} color="#60a5fa" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Role-Based Access</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Tailored dashboards for Users, Vendors, and Admins</div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <CheckCircle2 size={20} color="#60a5fa" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Supabase Database Sync</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Real-time profiles and permissions tracking</div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <CheckCircle2 size={20} color="#60a5fa" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Instant Setup</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Zero-friction onboarding & account configuration</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.6)", marginTop: 40 }}>
            Already registered?{" "}
            <button
              onClick={onNavigateLogin}
              style={{ background: "none", border: "none", color: "#93c5fd", fontWeight: 700, cursor: "pointer" }}
            >
              Sign In here
            </button>
          </div>
        </div>

        {/* Right Side: Form */}
        <div style={{ padding: "36px 32px" }}>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 22, fontWeight: 700, color: "var(--gray-900)" }}>
              Create New Account
            </h3>
            <p style={{ fontSize: 13, color: "var(--gray-500)" }}>
              Fill in your details below to register
            </p>
          </div>

          {errorMsg && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: 12,
              borderRadius: 8,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              fontSize: 13,
              marginBottom: 16
            }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Account Role Selector */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--gray-600)", marginBottom: 8 }}>
                Select Account Type
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  { id: "user", label: "Customer", icon: User },
                  { id: "vendor", label: "Vendor", icon: Store },
                  { id: "admin", label: "Admin", icon: ShieldCheck }
                ].map((r) => {
                  const IconComp = r.icon;
                  const selected = role === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRole(r.id)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                        padding: "10px 8px",
                        borderRadius: 10,
                        border: selected ? "2px solid #2563eb" : "1px solid #e2e8f0",
                        background: selected ? "#eff6ff" : "#ffffff",
                        color: selected ? "#1e40af" : "#64748b",
                        fontSize: 12,
                        fontWeight: selected ? 700 : 500,
                        cursor: "pointer",
                        transition: "all 0.15s ease"
                      }}
                    >
                      <IconComp size={18} />
                      <span>{r.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--gray-700)", marginBottom: 4 }}>
                Full Name
              </label>
              <Input
                type="text"
                placeholder="Jane Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                leftIcon={<User size={16} />}
                required
              />
            </div>

            {/* Vendor Store Name (if Vendor) */}
            {role === "vendor" && (
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--gray-700)", marginBottom: 4 }}>
                  Store / Business Name
                </label>
                <Input
                  type="text"
                  placeholder="Apex Electronics & Gear"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  leftIcon={<Building size={16} />}
                  required
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--gray-700)", marginBottom: 4 }}>
                Email Address
              </label>
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--gray-700)", marginBottom: 4 }}>
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    leftIcon={<Lock size={16} />}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--gray-700)", marginBottom: 4 }}>
                  Confirm Password
                </label>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  leftIcon={<Lock size={16} />}
                  required
                />
              </div>
            </div>

            {/* Terms & Conditions */}
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--gray-600)", cursor: "pointer", marginTop: 4 }}>
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
              />
              I agree to the <a href="#terms" onClick={(e) => e.preventDefault()} style={{ color: "#2563eb" }}>Terms of Service</a> & <a href="#privacy" onClick={(e) => e.preventDefault()} style={{ color: "#2563eb" }}>Privacy Policy</a>
            </label>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={loading}
              style={{
                borderRadius: 10,
                fontWeight: 700,
                marginTop: 8
              }}
            >
              {loading ? "Registering..." : "Create Account"}
              <ArrowRight size={16} style={{ marginLeft: 8 }} />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
