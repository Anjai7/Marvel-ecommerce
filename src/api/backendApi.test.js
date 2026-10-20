import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as backendApi from "./backendApi.js";
import { apiRequestPasswordReset, apiResetPassword, apiResetUserPassword } from "./backendApi.js";

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) });
}

let mockFetch;

beforeEach(() => {
  localStorage.removeItem("marvel_jwt_token");
  mockFetch = vi.fn();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.removeItem("marvel_jwt_token");
});

describe("password reset api client", () => {
  it("requests a reset at /auth/request-reset and returns the parsed body", async () => {
    mockFetch.mockReturnValue(
      jsonResponse({
        message: "If this email is registered, a reset link has been sent.",
        resetToken: "fake-reset-token-123",
      })
    );

    const body = await apiRequestPasswordReset("user@example.com");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/auth/request-reset");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ email: "user@example.com" });
    expect(body).toEqual({
      message: "If this email is registered, a reset link has been sent.",
      resetToken: "fake-reset-token-123",
    });
  });

  it("returns the generic body unchanged when the server exposes no token", async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ message: "If this email is registered, a reset link has been sent." })
    );

    const body = await apiRequestPasswordReset("user@example.com");

    expect(body).toEqual({
      message: "If this email is registered, a reset link has been sent.",
    });
    expect(body.resetToken).toBeUndefined();
  });

  it("sends { token, newPassword } to /auth/reset-password", async () => {
    mockFetch.mockReturnValue(jsonResponse({ message: "Password updated." }));

    const body = await apiResetPassword("fake-token", "newpass123");

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/auth/reset-password");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({
      token: "fake-token",
      newPassword: "newpass123",
    });
    expect(JSON.parse(options.body).email).toBeUndefined();
    expect(body).toEqual({ message: "Password updated." });
  });

  it("surfaces the server error message", async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ error: "Invalid or expired reset token." }, { ok: false, status: 400 })
    );

    await expect(apiResetPassword("bad-token", "newpass123")).rejects.toThrow(
      "Invalid or expired reset token."
    );
  });

  it("no longer exports apiForgotPassword", () => {
    expect(backendApi.apiForgotPassword).toBeUndefined();
  });

  it("leaves the admin reset path untouched", async () => {
    localStorage.setItem("marvel_jwt_token", "admin-jwt");
    mockFetch.mockReturnValue(jsonResponse({ message: "Password reset." }));

    await apiResetUserPassword("user-1", "newpass123");

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/users/user-1/reset-password");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ newPassword: "newpass123" });
    expect(options.headers.Authorization).toBe("Bearer admin-jwt");
  });
});
