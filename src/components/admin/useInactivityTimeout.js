import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../ui";
import { clearStoredToken } from "../../api/backendApi";

export const ADMIN_INACTIVITY_KEY = "marvel_admin_last_activity";
export const DEFAULT_INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 continuous minutes (300,000 ms)
const THROTTLE_MS = 1000; // Throttle activity updates to once every second
const CHECK_INTERVAL_MS = 1000; // Check interval frequency

/**
 * Hook to track user activity and trigger session logout after 5 continuous minutes
 * of inactivity for admin and super_admin portals.
 *
 * @param {Object} [options]
 * @param {number} [options.timeoutMs] - Inactivity duration before expiration (ms)
 * @param {Function} [options.onTimeout] - Optional callback triggered on timeout
 * @param {boolean} [options.enabled=true] - Whether tracking is enabled
 */
export function useInactivityTimeout(options = {}) {
  const auth = useAuth?.();
  const logout = auth?.logout;
  const toastContext = useToast?.();
  const addToast = toastContext?.addToast;

  const timeoutMs =
    options.timeoutMs ??
    (typeof window !== "undefined" && window.__ADMIN_INACTIVITY_TIMEOUT_MS__) ??
    DEFAULT_INACTIVITY_TIMEOUT_MS;

  const onTimeout = options.onTimeout;
  const enabled = options.enabled !== false;

  const lastRecordedTimeRef = useRef(Date.now());
  const timerRef = useRef(null);
  const isExpiringRef = useRef(false);

  const handleExpire = useCallback(() => {
    if (isExpiringRef.current) return;
    isExpiringRef.current = true;

    try {
      localStorage.removeItem(ADMIN_INACTIVITY_KEY);
    } catch {}

    if (typeof onTimeout === "function") {
      onTimeout();
      return;
    }

    clearStoredToken();
    if (logout) {
      logout();
    }

    if (addToast) {
      addToast({
        title: "Session Expired",
        message: "Session expired due to 5 minutes of inactivity. Please log in again.",
        type: "warning",
      });
    }

    if (typeof window !== "undefined") {
      try {
        if (window.history && window.history.pushState) {
          window.history.pushState(null, "", "/login");
          window.dispatchEvent(new PopStateEvent("popstate"));
        }
      } catch {}
      window.location.hash = "#/login";
    }
  }, [logout, addToast, onTimeout]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    isExpiringRef.current = false;
    const now = Date.now();

    // Check if session already expired prior to mount or page refresh
    try {
      const storedStr = localStorage.getItem(ADMIN_INACTIVITY_KEY);
      if (storedStr) {
        const storedTime = parseInt(storedStr, 10);
        if (!isNaN(storedTime) && now - storedTime >= timeoutMs) {
          handleExpire();
          return;
        }
        lastRecordedTimeRef.current = storedTime;
      } else {
        localStorage.setItem(ADMIN_INACTIVITY_KEY, String(now));
        lastRecordedTimeRef.current = now;
      }
    } catch {
      lastRecordedTimeRef.current = now;
    }

    // Activity event listener throttled to at most once per second
    const handleActivity = () => {
      const currentTime = Date.now();
      if (currentTime - lastRecordedTimeRef.current < THROTTLE_MS) {
        return;
      }
      lastRecordedTimeRef.current = currentTime;
      try {
        localStorage.setItem(ADMIN_INACTIVITY_KEY, String(currentTime));
      } catch {}
    };

    // Track mousemove, mousedown, keydown, touchstart, scroll
    const trackedEvents = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    trackedEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });

    // Cross-tab synchronization via storage events
    const handleStorageChange = (e) => {
      if (e.key === ADMIN_INACTIVITY_KEY && e.newValue) {
        const remoteTime = parseInt(e.newValue, 10);
        if (!isNaN(remoteTime)) {
          lastRecordedTimeRef.current = Math.max(lastRecordedTimeRef.current, remoteTime);
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);

    // Periodic check for elapsed continuous inactivity
    const intervalStep = Math.min(CHECK_INTERVAL_MS, Math.max(50, Math.floor(timeoutMs / 5)));
    timerRef.current = setInterval(() => {
      const currentTime = Date.now();
      let lastActive = lastRecordedTimeRef.current;

      try {
        const stored = localStorage.getItem(ADMIN_INACTIVITY_KEY);
        if (stored) {
          const parsed = parseInt(stored, 10);
          if (!isNaN(parsed)) {
            lastActive = parsed;
          }
        }
      } catch {}

      if (currentTime - lastActive >= timeoutMs) {
        handleExpire();
      }
    }, intervalStep);

    return () => {
      trackedEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
      window.removeEventListener("storage", handleStorageChange);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, timeoutMs, handleExpire]);

  return {
    resetTimer: () => {
      const now = Date.now();
      lastRecordedTimeRef.current = now;
      try {
        localStorage.setItem(ADMIN_INACTIVITY_KEY, String(now));
      } catch {}
    },
  };
}

export default useInactivityTimeout;
