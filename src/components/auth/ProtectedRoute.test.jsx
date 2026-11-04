import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ProtectedRoute from "./ProtectedRoute";

const mockUseAuth = vi.fn();

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("ProtectedRoute", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    window.location.hash = "#/admin";
  });

  it("redirects unauthenticated users to /login", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoggedIn: false,
      loading: false,
    });

    const pushSpy = vi.spyOn(window.history, "pushState");
    try {
      render(
        <ProtectedRoute allowedRoles={["admin"]}>
          <div>Admin Content</div>
        </ProtectedRoute>
      );

      expect(pushSpy).toHaveBeenCalledWith(
        expect.objectContaining({ route: "login" }),
        "",
        "/login"
      );
      expect(screen.queryByText("Admin Content")).toBeNull();
      expect(screen.getByText("Authentication Required")).toBeInTheDocument();
    } finally {
      pushSpy.mockRestore();
    }
  });

  it("clicking sign in button navigates to /login", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: null,
      isLoggedIn: false,
      loading: false,
    });

    const pushSpy = vi.spyOn(window.history, "pushState");
    try {
      render(
        <ProtectedRoute allowedRoles={["admin"]}>
          <div>Admin Content</div>
        </ProtectedRoute>
      );

      const signInBtn = screen.getByRole("button", { name: /Sign In to Your Account/i });
      await user.click(signInBtn);

      expect(pushSpy).toHaveBeenCalledWith(
        expect.objectContaining({ route: "login" }),
        "",
        "/login"
      );
    } finally {
      pushSpy.mockRestore();
    }
  });

  it("renders protected content when user has allowed role", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "1", role: "admin" },
      isLoggedIn: true,
      loading: false,
    });

    render(
      <ProtectedRoute allowedRoles={["admin"]}>
        <div>Secret Admin Area</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("Secret Admin Area")).toBeInTheDocument();
  });

  it("shows 403 Forbidden when user role is not allowed", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "2", role: "user" },
      isLoggedIn: true,
      loading: false,
    });

    render(
      <ProtectedRoute allowedRoles={["admin"]}>
        <div>Secret Admin Area</div>
      </ProtectedRoute>
    );

    expect(screen.queryByText("Secret Admin Area")).toBeNull();
    expect(screen.getByText(/Access Restricted \(403 Forbidden\)/i)).toBeInTheDocument();
  });
});
