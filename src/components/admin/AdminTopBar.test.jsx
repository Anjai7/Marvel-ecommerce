import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AdminNotifications, AdminProfileMenu } from "./AdminTopBar";
import { ToastProvider } from "../ui/Toast";

const ALERTS = [
  {
    id: "orders-pending",
    tone: "warning",
    title: "3 orders awaiting fulfilment",
    detail: "Orders sitting in the pending stage need to be accepted.",
    tab: "orders",
    icon: () => <span data-testid="alert-icon" />,
  },
];

const withToasts = (ui) => render(<ToastProvider>{ui}</ToastProvider>);

describe("AdminNotifications", () => {
  it("shows the alert count on the bell", () => {
    withToasts(<AdminNotifications alerts={ALERTS} onOpenTab={() => {}} />);
    expect(screen.getByRole("button", { name: /Notifications, 1 alert/ })).toBeVisible();
  });

  it("shows no count when there is nothing to act on", () => {
    withToasts(<AdminNotifications alerts={[]} onOpenTab={() => {}} />);
    expect(screen.getByRole("button", { name: "Notifications" })).toBeVisible();
  });

  it("lists the alerts and navigates to the tab that can act on them", async () => {
    const user = userEvent.setup();
    const onOpenTab = vi.fn();
    withToasts(<AdminNotifications alerts={ALERTS} onOpenTab={onOpenTab} />);

    await user.click(screen.getByRole("button", { name: /Notifications/ }));
    expect(await screen.findByText("3 orders awaiting fulfilment")).toBeVisible();

    await user.click(screen.getByText("3 orders awaiting fulfilment"));
    expect(onOpenTab).toHaveBeenCalledWith("orders");
  });

  it("says so when there is nothing to report", async () => {
    const user = userEvent.setup();
    withToasts(<AdminNotifications alerts={[]} onOpenTab={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    expect(await screen.findByText("Nothing needs your attention right now.")).toBeVisible();
  });
});

describe("AdminProfileMenu", () => {
  const USER = { full_name: "Sarah Jenkins", email: "admin@marvel.com" };

  it("shows the signed-in person and their role", () => {
    withToasts(
      <AdminProfileMenu
        user={USER}
        role="admin"
        isSuperAdmin={false}
        onOpenSettings={() => {}}
        onSignOut={() => {}}
      />
    );
    expect(screen.getByText("Sarah Jenkins")).toBeVisible();
    expect(screen.getByText("Admin")).toBeVisible();
  });

  it("puts settings and sign out in the menu", async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    const onSignOut = vi.fn();
    withToasts(
      <AdminProfileMenu
        user={USER}
        role="admin"
        isSuperAdmin={false}
        onOpenSettings={onOpenSettings}
        onSignOut={onSignOut}
      />
    );

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    expect(await screen.findByRole("menuitem", { name: "Settings" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Sign Out" })).toBeVisible();

    // Selecting an item closes the menu, so each one is opened again.
    await user.click(screen.getByRole("menuitem", { name: "Settings" }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(await screen.findByRole("menuitem", { name: "Sign Out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("never shows a made-up name when the API has none", () => {
    withToasts(
      <AdminProfileMenu
        user={{}}
        role="admin"
        isSuperAdmin={false}
        onOpenSettings={() => {}}
        onSignOut={() => {}}
      />
    );
    // The name and the avatar both fall back to the neutral dash.
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.queryByText("admin@marvel.com")).not.toBeInTheDocument();
  });
});
