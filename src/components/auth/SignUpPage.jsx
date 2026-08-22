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
  Building
} from "lucide-react";
import { Button, Input, useToast } from "../ui";
import { useAuth } from "../../context/AuthContext";

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
        storeName: role === "vendor" ? storeName : undefined
      });

      addToast({
        title: "Account Created Successfully!",
        message: `Welcome to Marvel, ${fullName}! Your ${role === "vendor" ? "Vendor Store" : "Customer"} account is ready.`,
        type: "success"
      });

      if (onSignUpSuccess) {
        onSignUpSuccess(newUser);
      } else {
        if (newUser.role === "vendor") window.location.hash = "#/vendor";
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
        maxWidth: 920,
        width: "100%",
        background: "#ffffff",
        borderRadius: 20,
        boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0,0,0,0.1)",
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))"
      }}>
        {/* Left Side: Brand Showcase */}
        <div style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #2563eb 100%)",
          color: "#ffffff",
          padding: "44px 36px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between"
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
              <Sparkles size={14} color="#ffd700" /> Create Your Account
            </div>

            <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12, lineHeight: 1.3 }}>
              Join Marvel Marketplace
            </h2>
            <p style={{ fontSize: 14, color: "rgba(255, 255, 255, 0.8)", lineHeight: 1.6, marginBottom: 32 }}>
              Shop top-tier consumer tech or open your certified vendor store to reach thousands of verified buyers.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Award size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Member &amp; Seller Benefits</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Special member pricing, sales analytics &amp; order management</div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Truck size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Live Order &amp; Shipment Tracking</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Real-time updates on dispatch and fulfillment</div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Buyer &amp; Vendor Protection</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Verified authenticity and secure payments</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.7)", marginTop: 36 }}>
            Already have an account?{" "}
            <button
              onClick={onNavigateLogin}
              style={{ background: "none", border: "none", color: "#93c5fd", fontWeight: 700, cursor: "pointer", padding: 0 }}
            >
              Sign In here
            </button>
          </div>
        </div>

        {/* Right Side: Registration Form */}
        <div style={{ padding: "44px 38px" }}>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 24, fontWeight: 700, color: "var(--gray-900)" }}>
              Create Account
            </h3>
            <p style={{ fontSize: 13, color: "var(--gray-500)" }}>
              Register as a Customer or Seller on Marvel
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

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            {/* Account Type (Strictly Customer or Vendor) */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--gray-700)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Select Account Type
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setRole("user")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: role === "user" ? "2px solid #2563eb" : "1px solid #e2e8f0",
                    background: role === "user" ? "#eff6ff" : "#ffffff",
                    color: role === "user" ? "#1e40af" : "#64748b",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 13,
                    transition: "all 0.15s ease"
                  }}
                >
                  <User size={18} color={role === "user" ? "#2563eb" : "#64748b"} />
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 700 }}>Customer</div>
                    <div style={{ fontSize: 11, opacity: 0.8 }}>Shop &amp; track orders</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRole("vendor")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: role === "vendor" ? "2px solid #7c3aed" : "1px solid #e2e8f0",
                    background: role === "vendor" ? "#f5f3ff" : "#ffffff",
                    color: role === "vendor" ? "#6d28d9" : "#64748b",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 13,
                    transition: "all 0.15s ease"
                  }}
                >
                  <Store size={18} color={role === "vendor" ? "#7c3aed" : "#64748b"} />
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 700 }}>Seller (Vendor)</div>
                    <div style={{ fontSize: 11, opacity: 0.8 }}>Sell your products</div>
                  </div>
                </button>
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

            {/* Store Name (if Vendor) */}
            {role === "vendor" && (
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--gray-700)", marginBottom: 4 }}>
                  Store / Brand Name
                </label>
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
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--gray-700)", marginBottom: 4 }}>
                Password (min. 6 characters)
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

            {/* Confirm Password */}
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

            {/* Terms and Conditions */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 2 }}>
              <input
                type="checkbox"
                id="terms"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                style={{ marginTop: 3, borderRadius: 4 }}
              />
              <label htmlFor="terms" style={{ fontSize: 12, color: "var(--gray-600)", lineHeight: 1.5 }}>
                I agree to the <a href="#terms" onClick={(e) => e.preventDefault()} style={{ color: "#2563eb", fontWeight: 600 }}>Terms of Service</a> and <a href="#privacy" onClick={(e) => e.preventDefault()} style={{ color: "#2563eb", fontWeight: 600 }}>Privacy Policy</a>
              </label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={loading}
              style={{
                background: "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)",
                border: "none",
                borderRadius: 10,
                fontWeight: 700,
                marginTop: 4
              }}
            >
              {loading ? "Creating Account..." : `Sign Up as ${role === "vendor" ? "Vendor" : "Customer"}`}
              <ArrowRight size={16} style={{ marginLeft: 8 }} />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
