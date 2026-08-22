import React from "react";
import { useAuth } from "../../context/AuthContext";
import { ShieldAlert, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "../ui";

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, isLoggedIn, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16
      }}>
        <Loader2 size={36} className="animate-spin" color="#2563eb" />
        <div style={{ fontSize: 15, fontWeight: 600, color: "#64748b" }}>
          Verifying security token & backend permissions...
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div style={{
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24
      }}>
        <div style={{
          background: "#ffffff",
          borderRadius: 16,
          padding: "36px 32px",
          maxWidth: 460,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
          border: "1px solid #e2e8f0"
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "#eff6ff",
            color: "#2563eb",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16
          }}>
            <ShieldAlert size={28} />
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
            Authentication Required
          </h3>
          <p style={{ fontSize: 14, color: "#64748b", marginBottom: 24, lineHeight: 1.5 }}>
            You must be signed in with a valid account to access this workspace.
          </p>
          <Button
            variant="primary"
            style={{ width: "100%" }}
            onClick={() => { window.location.hash = "#/login"; }}
          >
            Sign In to Your Account
          </Button>
        </div>
      </div>
    );
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return (
      <div style={{
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24
      }}>
        <div style={{
          background: "#ffffff",
          borderRadius: 16,
          padding: "36px 32px",
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
          border: "1px solid #fee2e2"
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "#fef2f2",
            color: "#dc2626",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16
          }}>
            <ShieldAlert size={28} />
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: "#991b1b", marginBottom: 8 }}>
            Access Restricted (403 Forbidden)
          </h3>
          <p style={{ fontSize: 14, color: "#64748b", marginBottom: 20, lineHeight: 1.5 }}>
            Your account role is <strong>{user?.role?.replace("_", " ").toUpperCase()}</strong>. This portal requires one of the following permissions: <strong>[{allowedRoles.join(", ").toUpperCase()}]</strong>.
          </p>
          <Button
            variant="secondary"
            leftIcon={<ArrowLeft size={16} />}
            onClick={() => { window.location.hash = "#/"; }}
          >
            Return to Marketplace
          </Button>
        </div>
      </div>
    );
  }

  return children;
}
