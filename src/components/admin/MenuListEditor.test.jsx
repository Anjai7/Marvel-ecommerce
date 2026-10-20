import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MenuListEditor from "./MenuListEditor";
import { ToastProvider } from "../ui";
import {
  apiFetchMenuItems,
  apiSaveMenuItem,
  apiUpdateMenuItem,
  apiDeleteMenuItem,
  apiReorderMenuItems,
} from "../../api/contentApi";

vi.mock("../../api/contentApi", () => ({
  apiFetchMenuItems: vi.fn(),
  apiSaveMenuItem: vi.fn(),
  apiUpdateMenuItem: vi.fn(),
  apiDeleteMenuItem: vi.fn(),
  apiReorderMenuItems: vi.fn(),
}));

const EDITOR_ROLE = "admin";

const ITEMS = [
  {
    id: "m1",
    title: "Home",
    path: "/",
    icon: "Layers",
    badge: "",
    badge_variant: "accent",
    roles_allowed: ["user"],
    order_index: 0,
    is_active: true,
    parent_id: null,
  },
];

function renderEditor() {
  return render(
    <ToastProvider>
      <MenuListEditor role={EDITOR_ROLE} />
    </ToastProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  apiFetchMenuItems.mockResolvedValue(ITEMS);
  apiSaveMenuItem.mockResolvedValue({ id: "m2" });
  apiUpdateMenuItem.mockResolvedValue({});
  apiDeleteMenuItem.mockResolvedValue({});
  apiReorderMenuItems.mockResolvedValue({});
});

describe("MenuListEditor", () => {
  it("loads the menu through the shared transport with the current role", async () => {
    renderEditor();

    expect(await screen.findByText("Home")).toBeVisible();
    expect(apiFetchMenuItems).toHaveBeenCalledWith("admin");
  });

  it("shows the real server error when a save fails instead of claiming success", async () => {
    const user = userEvent.setup();
    apiSaveMenuItem.mockRejectedValue(new Error("Menu item title and path are required."));

    renderEditor();
    await screen.findByText("Home");

    await user.click(screen.getByRole("button", { name: /Add Top-Level Item/ }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByPlaceholderText(/Home/), "Deals");
    await user.type(within(dialog).getByPlaceholderText("/products"), "/deals");
    await user.click(within(dialog).getByRole("button", { name: "Add Menu Item" }));

    await waitFor(() =>
      expect(screen.getByText("Menu item title and path are required.")).toBeVisible()
    );
    expect(screen.queryByText("Menu saved")).not.toBeInTheDocument();
    // A failed write must not be followed by a reload that hides it.
    expect(apiFetchMenuItems).toHaveBeenCalledTimes(1);
  });

  it("labels a successful save only once the transport resolves", async () => {
    const user = userEvent.setup();

    renderEditor();
    await screen.findByText("Home");

    await user.click(screen.getByRole("button", { name: /Add Top-Level Item/ }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByPlaceholderText(/Home/), "Deals");
    await user.type(within(dialog).getByPlaceholderText("/products"), "/deals");
    await user.click(within(dialog).getByRole("button", { name: "Add Menu Item" }));

    await waitFor(() => expect(screen.getByText("Menu saved")).toBeVisible());
    expect(apiSaveMenuItem).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Deals", path: "/deals" })
    );
  });

  it("edits an item through PATCH rather than the missing PUT route", async () => {
    const user = userEvent.setup();

    renderEditor();
    await screen.findByText("Home");

    await user.click(screen.getByTitle("Edit"));
    const dialog = await screen.findByRole("dialog");
    const titleInput = within(dialog).getByDisplayValue("Home");
    await user.clear(titleInput);
    await user.type(titleInput, "Home Updated");
    await user.click(within(dialog).getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(apiUpdateMenuItem).toHaveBeenCalledTimes(1));
    expect(apiUpdateMenuItem).toHaveBeenCalledWith(
      "m1",
      expect.objectContaining({ title: "Home Updated" })
    );
    expect(apiSaveMenuItem).not.toHaveBeenCalled();
  });
});
