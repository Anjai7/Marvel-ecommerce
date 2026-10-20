import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiLogin, apiSignUp, apiGetMe, clearStoredToken } from "../api/backendApi";
import { getStoredToken, setStoredToken, onUnauthorized } from "../api/client";

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
        setUser(verifiedUser);
        setAuthError(null);
        return verifiedUser;
      } else {
        // Token was invalid or expired
        clearStoredToken();
        setUser(null);
        setToken("");
        return null;
      }
    } catch (err) {
      console.error("AuthContext refresh error:", err);
      clearStoredToken();
      setUser(null);
      setToken("");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // The app's only global 401 handler: a revoked or expired token logs out.
  // Registered before the session restore below so that first call is covered.
  useEffect(() => {
    return onUnauthorized(() => {
      setStoredToken(null);
      setToken("");
      setUser(null);
      setAuthError(null);
      window.location.hash = "#/login";
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
    setToken("");
    setUser(null);
    setAuthError(null);
    window.location.hash = "#/";
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
