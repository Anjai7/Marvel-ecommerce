import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiLogin, apiSignUp, apiGetMe, clearStoredToken } from "../api/backendApi";
import { getStoredToken, setStoredToken, onUnauthorized } from "../api/client";
import {
  getHashRoute,
  isAdminRoute,
  isSuperAdminRoute,
  isVendorRoute,
  isAccountRoute,
} from "../lib/routes";

const ADMIN_INACTIVITY_KEY = "marvel_admin_last_activity";
const DEFAULT_INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(getStoredToken());
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Validate and restore user session from backend on mount & token change
  const refreshUser = useCallback(async () => {
    const currentToken = getStoredToken();
    if (!currentToken) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      setLoading(true);
      const verifiedUser = await apiGetMe();
      if (verifiedUser) {
        // Prevent resurrecting expired admin session after prolonged inactivity
        if (
          (verifiedUser.role === "admin" || verifiedUser.role === "super_admin") &&
          typeof localStorage !== "undefined"
        ) {
          const lastActiveStr = localStorage.getItem(ADMIN_INACTIVITY_KEY);
          if (lastActiveStr) {
            const lastActive = parseInt(lastActiveStr, 10);
            const timeoutMs =
              (typeof window !== "undefined" && window.__ADMIN_INACTIVITY_TIMEOUT_MS__) ||
              DEFAULT_INACTIVITY_TIMEOUT_MS;
            if (!isNaN(lastActive) && Date.now() - lastActive >= timeoutMs) {
              clearStoredToken();
              localStorage.removeItem(ADMIN_INACTIVITY_KEY);
              setUser(null);
              setToken("");
              if (typeof window !== "undefined") {
                try {
                  if (window.history && window.history.pushState) {
                    window.history.pushState(null, "", "/login");
                    if (window.location.hash) {
                      window.history.replaceState(null, "", "/login");
                    }
                    window.dispatchEvent(new PopStateEvent("popstate"));
                    return null;
                  }
                } catch {}
                window.location.pathname = "/login";
                return null;
              }
              return null;
            }
          }
        }

        setUser(verifiedUser);
        setAuthError(null);
        return verifiedUser;
      } else {
        // Token was invalid or expired
        clearStoredToken();
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem(ADMIN_INACTIVITY_KEY);
        }
        setUser(null);
        setToken("");
        return null;
      }
    } catch (err) {
      console.error("AuthContext refresh error:", err);
      clearStoredToken();
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(ADMIN_INACTIVITY_KEY);
      }
      setUser(null);
      setToken("");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // The app's global 401 handler:
  // A guest user on the homepage must NOT be redirected to /login.
  // Only redirect to /login if user had a token (session revoked) or is on a protected route.
  useEffect(() => {
    return onUnauthorized(() => {
      const hadToken = Boolean(getStoredToken());
      clearStoredToken();
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(ADMIN_INACTIVITY_KEY);
      }
      setToken("");
      setUser(null);
      setAuthError(null);

      const currentRoute = getHashRoute();
      const isProtected =
        isAdminRoute(currentRoute.page) ||
        isSuperAdminRoute(currentRoute.page) ||
        isVendorRoute(currentRoute.page) ||
        isAccountRoute(currentRoute.page);

      if (hadToken || isProtected) {
        if (typeof window !== "undefined") {
          try {
            if (window.history && window.history.pushState) {
              window.history.pushState(null, "", "/login");
              if (window.location.hash) {
                window.history.replaceState(null, "", "/login");
              }
              window.dispatchEvent(new PopStateEvent("popstate"));
              return;
            }
          } catch {}
          window.location.pathname = "/login";
        }
      }
    });
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async ({ email, password, expectedRole }) => {
    setLoading(true);
    setAuthError(null);
    try {
      const data = await apiLogin({ email, password, expectedRole });
      if (data.token) {
        setStoredToken(data.token);
        setToken(data.token);
      }
      if (data.user) {
        setUser(data.user);
        if (
          (data.user.role === "admin" || data.user.role === "super_admin") &&
          typeof localStorage !== "undefined"
        ) {
          localStorage.setItem(ADMIN_INACTIVITY_KEY, String(Date.now()));
        }
      }
      return data.user;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (formData) => {
    setLoading(true);
    setAuthError(null);
    try {
      const data = await apiSignUp(formData);
      if (data.token) {
        setStoredToken(data.token);
        setToken(data.token);
      }
      if (data.user) {
        setUser(data.user);
      }
      return data.user;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearStoredToken();
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(ADMIN_INACTIVITY_KEY);
    }
    setToken("");
    setUser(null);
    setAuthError(null);
    if (typeof window !== "undefined") {
      try {
        if (window.history && window.history.pushState) {
          window.history.pushState(null, "", "/login");
          if (window.location.hash) {
            window.history.replaceState(null, "", "/login");
          }
          window.dispatchEvent(new PopStateEvent("popstate"));
        } else {
          window.location.pathname = "/login";
        }
      } catch {
        window.location.pathname = "/login";
      }
    }
  };

  const value = {
    user,
    token,
    role: user?.role || "user",
    isLoggedIn: Boolean(user),
    loading,
    authError,
    login,
    signup,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
