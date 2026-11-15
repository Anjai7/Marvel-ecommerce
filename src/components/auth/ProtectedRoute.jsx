import React, { useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { ShieldAlert, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "../ui";
import { navigateToPath } from "../../lib/routes";
import "../storefront/widgets.css";

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, isLoggedIn, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      navigateToPath("/login");
    }
  }, [loading, isLoggedIn]);

  if (loading) {
    return (
      <div className="protected-route-loading">
        <Loader2 size={36} className="animate-spin" color="#2563eb" />
        <div className="protected-route-loading-text">
          Verifying security token & backend permissions...
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="protected-route-gate">
        <div className="protected-route-card">
          <div className="protected-route-badge">
            <ShieldAlert size={28} />
          </div>
          <h3 className="protected-route-title">Authentication Required</h3>
          <p className="protected-route-text">
            You must be signed in with a valid account to access this workspace.
          </p>
          <Button
            variant="primary"
            className="protected-route-submit"
            onClick={() => navigateToPath("/login")}
          >
            Sign In to Your Account
          </Button>
        </div>
      </div>
    );
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return (
      <div className="protected-route-gate">
        <div className="protected-route-card protected-route-card--danger">
          <div className="protected-route-badge protected-route-badge--danger">
            <ShieldAlert size={28} />
          </div>
          <h3 className="protected-route-title protected-route-title--danger">
            Access Restricted (403 Forbidden)
          </h3>
          <p className="protected-route-text protected-route-text--tight">
            Your account role is <strong>{user?.role?.replace("_", " ").toUpperCase()}</strong>.
            This portal requires one of the following permissions:{" "}
            <strong>[{allowedRoles.join(", ").toUpperCase()}]</strong>.
          </p>
          <Button
            variant="secondary"
            leftIcon={<ArrowLeft size={16} />}
            onClick={() => navigateToPath("/")}
          >
            Return to Marketplace
          </Button>
        </div>
      </div>
    );
  }

  return children;
}
