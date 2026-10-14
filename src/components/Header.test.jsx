import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import Header from "./Header";

vi.mock("../api/backendApi", () => ({
  apiFetchProducts: vi.fn().mockResolvedValue([]),
}));

const renderHeader = (overrides = {}) => {
  const props = {
    currentUser: null,
    isLoggedIn: false,
    onNavigateLogin: vi.fn(),
    onNavigateSignUp: vi.fn(),
    onNavigateAdmin: vi.fn(),
    onNavigateCustomerPortal: vi.fn(),
    onNavigateHome: vi.fn(),
    onLogout: vi.fn(),
    cartCount: 0,
    onMenuOpen: vi.fn(),
    onSelectProduct: vi.fn(),
    ...overrides,
  };

  return { ...render(<Header {...props} />), props };
};

describe("Header", () => {
  it("shows an icon-free Sign Up action that navigates on click", async () => {
    const user = userEvent.setup();
    const { props } = renderHeader();

    const signUpButton = screen.getByRole("button", { name: "Sign Up" });

    expect(signUpButton).toBeVisible();
    expect(signUpButton).toHaveClass("signup-btn");
    expect(signUpButton.querySelector("svg")).toBeNull();

    await user.click(signUpButton);
    expect(props.onNavigateSignUp).toHaveBeenCalledOnce();
  });
});
