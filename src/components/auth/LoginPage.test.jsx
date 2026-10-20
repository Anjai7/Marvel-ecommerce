import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequestReset, mockResetPassword } = vi.hoisted(() => ({
  mockRequestReset: vi.fn(),
  mockResetPassword: vi.fn(),
}));

vi.mock("../../api/backendApi", () => ({
  getStoredToken: vi.fn(() => ""),
  setStoredToken: vi.fn(),
  clearStoredToken: vi.fn(),
  apiLogin: vi.fn(),
  apiSignUp: vi.fn(),
  apiGetMe: vi.fn(),
  apiRequestPasswordReset: mockRequestReset,
  apiResetPassword: mockResetPassword,
}));

import LoginPage from "./LoginPage";
import { AuthProvider } from "../../context/AuthContext";
import { ToastProvider } from "../ui";

function renderPage() {
  return render(
    <ToastProvider>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </ToastProvider>
  );
}

async function openStepTwo(user, email = "user@example.com") {
  await user.type(screen.getByPlaceholderText("you@example.com"), email);
  await user.click(screen.getByRole("button", { name: "Forgot password?" }));
  await user.click(screen.getByRole("button", { name: /Continue to Set New Password/i }));
  return screen.findByLabelText("Reset Token");
}

beforeEach(() => {
  mockRequestReset.mockReset();
  mockResetPassword.mockReset();
  mockRequestReset.mockResolvedValue({
    message: "If this email is registered, a reset link has been sent.",
  });
  mockResetPassword.mockResolvedValue({ message: "Password updated." });
});

describe("LoginPage forgot-password wizard", () => {
  it("prefills the reset token when the server returned one", async () => {
    const user = userEvent.setup();
    mockRequestReset.mockResolvedValue({
      message: "If this email is registered, a reset link has been sent.",
      resetToken: "fake-dev-token-123",
    });
    renderPage();

    const tokenInput = await openStepTwo(user);

    expect(mockRequestReset).toHaveBeenCalledWith("user@example.com");
    expect(tokenInput).toHaveValue("fake-dev-token-123");
  });

  it("leaves the token empty when the server did not expose one", async () => {
    const user = userEvent.setup();
    renderPage();

    const tokenInput = await openStepTwo(user);

    expect(tokenInput).toHaveValue("");
  });

  it("submits the pasted token and the new password", async () => {
    const user = userEvent.setup();
    renderPage();

    const tokenInput = await openStepTwo(user);
    await user.type(tokenInput, "fake-pasted-token");
    await user.type(screen.getByLabelText("New Password (min 6 chars)"), "newpass123");
    await user.type(screen.getByLabelText("Confirm New Password"), "newpass123");
    await user.click(screen.getByRole("button", { name: /Update & Save Password/i }));

    expect(mockResetPassword).toHaveBeenCalledWith("fake-pasted-token", "newpass123");
    expect(await screen.findByText(/Password Reset Complete!/i)).toBeVisible();
  });

  it("requires a token before submitting", async () => {
    const user = userEvent.setup();
    renderPage();

    await openStepTwo(user);
    await user.type(screen.getByLabelText("New Password (min 6 chars)"), "newpass123");
    await user.type(screen.getByLabelText("Confirm New Password"), "newpass123");
    await user.click(screen.getByRole("button", { name: /Update & Save Password/i }));

    expect(await screen.findByText(/Enter the reset token/i)).toBeVisible();
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it("does not promise an email that nothing sends", async () => {
    const user = userEvent.setup();
    renderPage();

    const tokenInput = await openStepTwo(user);
    const stepText = tokenInput.closest("form")?.textContent || "";

    expect(stepText).not.toMatch(/by email|sent to|check your inbox/i);
    expect(stepText).toMatch(/In local development/i);
  });

  it("keeps the six-character minimum and the mismatch check", async () => {
    const user = userEvent.setup();
    renderPage();

    const tokenInput = await openStepTwo(user);
    await user.type(tokenInput, "fake-token");
    await user.type(screen.getByLabelText("New Password (min 6 chars)"), "12345");
    await user.type(screen.getByLabelText("Confirm New Password"), "12345");
    await user.click(screen.getByRole("button", { name: /Update & Save Password/i }));

    expect(await screen.findByText(/at least 6 characters/i)).toBeVisible();
    expect(mockResetPassword).not.toHaveBeenCalled();
  });
});
