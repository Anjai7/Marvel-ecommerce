import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

function Probe() {
  const { user, token, loading } = useAuth();
  const status = loading ? "loading" : user ? "user" : "anon";
  return <span data-testid="auth">{`${status}:${token}`}</span>;
}

function renderAuth() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
}

beforeEach(() => {
  localStorage.removeItem("marvel_jwt_token");
  window.location.hash = "#/";
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.removeItem("marvel_jwt_token");
  window.location.hash = "";
});

describe("AuthProvider", () => {
  it("clears the token and routes to login when a request answers 401", async () => {
    localStorage.setItem("marvel_jwt_token", "expired-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Invalid or expired token." }),
      })
    );

    renderAuth();

    await waitFor(() => expect(localStorage.getItem("marvel_jwt_token")).toBeNull());

    expect(window.location.pathname).toBe("/login");
    expect(window.location.hash).toBe("");
    expect(await screen.findByTestId("auth")).toHaveTextContent("anon:");
  });

  it("keeps the signed-in user when the restore succeeds", async () => {
    localStorage.setItem("marvel_jwt_token", "good-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ user: { id: "u1", role: "admin" } }),
      })
    );

    renderAuth();

    await waitFor(() => expect(screen.getByTestId("auth")).toHaveTextContent("user:good-token"));
    expect(window.location.hash).toBe("#/");
  });

  it("does not redirect an unauthenticated guest visitor on the storefront homepage when receiving 401", async () => {
    // No stored token, visitor is on home page
    window.location.hash = "#/";
    const pushSpy = vi.spyOn(window.history, "pushState");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Unauthorized" }),
      })
    );

    renderAuth();

    expect(await screen.findByTestId("auth")).toHaveTextContent("anon:");
    expect(window.location.hash).toBe("#/");
    expect(pushSpy).not.toHaveBeenCalledWith(expect.anything(), "", "/login");

    pushSpy.mockRestore();
  });

  it("does not resurrect an expired admin session after prolonged inactivity", async () => {
    localStorage.setItem("marvel_jwt_token", "admin-token");
    // Set last active timestamp to 10 minutes ago
    localStorage.setItem("marvel_admin_last_activity", String(Date.now() - 10 * 60 * 1000));

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ user: { id: "u-admin", role: "admin" } }),
      })
    );

    renderAuth();

    await waitFor(() => expect(localStorage.getItem("marvel_jwt_token")).toBeNull());
    expect(localStorage.getItem("marvel_admin_last_activity")).toBeNull();
    expect(window.location.pathname).toBe("/login");
    expect(window.location.hash).toBe("");
  });
});
