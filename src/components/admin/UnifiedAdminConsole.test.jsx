import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import UnifiedAdminConsole from "./UnifiedAdminConsole";

vi.mock("../../api/backendApi", () => ({
  apiFetchProducts: vi.fn().mockResolvedValue([]),
  apiFetchOrders: vi.fn().mockResolvedValue([]),
  apiFetchAllUsers: vi.fn().mockResolvedValue([]),
  apiAdminCreateUser: vi.fn(),
  apiUpdateUserDetails: vi.fn(),
  apiUpdateUserRole: vi.fn(),
  apiUpdateUserStatus: vi.fn(),
  apiResetUserPassword: vi.fn(),
  apiDeleteUser: vi.fn(),
  apiCreateProduct: vi.fn(),
  apiUpdateProduct: vi.fn(),
  apiDeleteProduct: vi.fn(),
  apiModerateProduct: vi.fn(),
  apiUpdateOrderStatus: vi.fn(),
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: { full_name: "Admin User", email: "admin@example.com" },
    logout: vi.fn(),
    role: "admin",
  }),
}));

describe("UnifiedAdminConsole", () => {
  it("does not expose an initial status selector when adding a user", async () => {
    const user = userEvent.setup();
    render(<UnifiedAdminConsole />);

    await waitFor(() => expect(screen.getByText("Add User")).toBeVisible());
    await user.click(screen.getByRole("button", { name: "Add User" }));

    expect(screen.getByRole("heading", { name: "Create User Account" })).toBeVisible();
    expect(screen.queryByText("Initial Status")).not.toBeInTheDocument();
  });

  it("exposes catalog menus with submenus and an add-product flow", async () => {
    const user = userEvent.setup();
    render(<UnifiedAdminConsole />);

    const nav = await screen.findByRole("navigation");
    await user.click(within(nav).getByRole("button", { name: /Products Catalog/ }));
    await user.click(within(nav).getByRole("button", { name: "Add Product" }));

    const main = screen.getByRole("main");
    await expect(
      within(main).getByRole("button", { name: "Publish Product" })
    ).toBeVisible();
  });

  it("shows the sales report with real-data sections", async () => {
    const user = userEvent.setup();
    render(<UnifiedAdminConsole />);

    await screen.findByRole("navigation");
    await user.click(screen.getByRole("button", { name: "Sales Report" }));

    await expect(screen.getByText("Today Orders")).toBeVisible();
    await expect(screen.getByText("Repeat Customers")).toBeVisible();
    await expect(screen.getByText("Orders Pipeline")).toBeVisible();
  });
});
