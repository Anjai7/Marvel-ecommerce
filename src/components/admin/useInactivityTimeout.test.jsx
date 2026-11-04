import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useInactivityTimeout, ADMIN_INACTIVITY_KEY } from "./useInactivityTimeout";

const mockLogout = vi.fn();
const mockAddToast = vi.fn();
const mockClearToken = vi.fn();

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    logout: mockLogout,
    user: { role: "admin", email: "admin@marvel.com" },
    isLoggedIn: true,
  }),
}));

vi.mock("../ui", () => ({
  useToast: () => ({
    addToast: mockAddToast,
  }),
}));

vi.mock("../../api/backendApi", () => ({
  clearStoredToken: () => mockClearToken(),
}));

describe("useInactivityTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    mockLogout.mockReset();
    mockAddToast.mockReset();
    mockClearToken.mockReset();
    window.location.hash = "#/admin";
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    window.location.hash = "";
  });

  it("stores the initial activity timestamp in localStorage on mount", () => {
    const startTime = 1000000;
    vi.setSystemTime(startTime);

    renderHook(() => useInactivityTimeout({ timeoutMs: 300000 }));

    expect(localStorage.getItem(ADMIN_INACTIVITY_KEY)).toBe(String(startTime));
  });

  it("throttles activity events and updates timestamp when user interacts", () => {
    const startTime = 1000000;
    vi.setSystemTime(startTime);

    renderHook(() => useInactivityTimeout({ timeoutMs: 300000 }));

    // Advance 500ms (less than 1s throttle)
    vi.advanceTimersByTime(500);
    window.dispatchEvent(new MouseEvent("mousemove"));
    // Still initial time due to throttling
    expect(localStorage.getItem(ADMIN_INACTIVITY_KEY)).toBe(String(startTime));

    // Advance past throttle threshold (+1500ms total)
    vi.advanceTimersByTime(1000);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    expect(localStorage.getItem(ADMIN_INACTIVITY_KEY)).toBe(String(startTime + 1500));
  });

  it("expires session after 5 minutes of continuous inactivity", () => {
    const startTime = 1000000;
    vi.setSystemTime(startTime);

    renderHook(() => useInactivityTimeout({ timeoutMs: 300000 }));

    // User is inactive for 5 minutes (300,000 ms)
    act(() => {
      vi.advanceTimersByTime(300000);
    });

    expect(mockLogout).toHaveBeenCalled();
    expect(mockClearToken).toHaveBeenCalled();
    expect(localStorage.getItem(ADMIN_INACTIVITY_KEY)).toBeNull();
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Session Expired",
        message: "Session expired due to 5 minutes of inactivity. Please log in again.",
        type: "warning",
      })
    );
    expect(window.location.hash).toBe("#/login");
  });

  it("cleans up event listeners and interval on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useInactivityTimeout({ timeoutMs: 300000 }));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("mousemove", expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith("touchstart", expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith("scroll", expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith("storage", expect.any(Function));

    removeEventListenerSpy.mockRestore();
  });

  it("immediately expires on load if existing localStorage timestamp is already overdue", () => {
    const startTime = 1000000;
    vi.setSystemTime(startTime);
    // 6 minutes overdue
    localStorage.setItem(ADMIN_INACTIVITY_KEY, String(startTime - 360000));

    renderHook(() => useInactivityTimeout({ timeoutMs: 300000 }));

    expect(mockLogout).toHaveBeenCalled();
    expect(mockClearToken).toHaveBeenCalled();
    expect(localStorage.getItem(ADMIN_INACTIVITY_KEY)).toBeNull();
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Session Expired",
        message: "Session expired due to 5 minutes of inactivity. Please log in again.",
      })
    );
  });
});
