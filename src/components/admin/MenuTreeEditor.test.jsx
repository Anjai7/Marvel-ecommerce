import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import ConfirmDialog from "./ConfirmDialog";
import MenuTreeEditor from "./MenuTreeEditor";
import { apiFetchMenuItems, apiSaveMenuItem, apiDeleteMenuItem } from "../../api/contentApi";

vi.mock("../../api/contentApi", () => ({
  apiFetchMenuItems: vi.fn(),
  apiSaveMenuItem: vi.fn(),
  apiDeleteMenuItem: vi.fn(),
  apiReorderMenuItems: vi.fn(),
}));

const TREE_DATA = [
  {
    id: "1",
    title: "Shop",
    path: "/",
    level: 1,
    order_index: 0,
    is_active: true,
    children: [
      {
        id: "2",
        title: "Electronics",
        path: "/electronics",
        level: 2,
        order_index: 0,
        is_active: true,
        parent_id: "1",
        children: [
          {
            id: "3",
            title: "Phones",
            path: "/phones",
            level: 3,
            order_index: 0,
            is_active: true,
            parent_id: "2",
            children: [],
          },
        ],
      },
    ],
  },
];

const FLAT_DATA = [
  { id: "1", title: "Shop", path: "/", level: 1, order_index: 0, is_active: true, parent_id: null },
  {
    id: "2",
    title: "Electronics",
    path: "/electronics",
    level: 2,
    order_index: 0,
    is_active: true,
    parent_id: "1",
  },
  {
    id: "3",
    title: "Phones",
    path: "/phones",
    level: 3,
    order_index: 0,
    is_active: true,
    parent_id: "2",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  apiFetchMenuItems.mockResolvedValue(TREE_DATA);
  apiDeleteMenuItem.mockResolvedValue({ message: "deleted" });
  apiSaveMenuItem.mockResolvedValue({ id: "1" });
});

describe("ConfirmDialog", () => {
  it("renders and calls onConfirm exactly once on Delete click", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open
        title="Delete 'Shop'?"
        message="This will remove the item."
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText("Delete 'Shop'?")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <ConfirmDialog
        open={false}
        title="Delete?"
        message="..."
        onCancel={() => {}}
        onConfirm={() => {}}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("calls onCancel (not onConfirm) on Escape, and cleans up on close", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { rerender } = render(
      <ConfirmDialog open title="Delete?" message="..." onCancel={onCancel} onConfirm={onConfirm} />
    );

    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    rerender(
      <ConfirmDialog
        open={false}
        title="Delete?"
        message="..."
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("MenuTreeEditor", () => {
  it("renders all three tree levels", async () => {
    render(<MenuTreeEditor role="admin" />);

    expect(await screen.findByText("Shop")).toBeVisible();
    expect(screen.getByText("Electronics")).toBeVisible();
    expect(screen.getByText("Phones")).toBeVisible();
    expect(apiFetchMenuItems).toHaveBeenCalledWith("admin");
  });

  it("rebuilds a tree from a legacy flat list", async () => {
    apiFetchMenuItems.mockResolvedValueOnce(FLAT_DATA);
    render(<MenuTreeEditor role="admin" />);

    expect(await screen.findByText("Shop")).toBeVisible();
    expect(screen.getByText("Electronics")).toBeVisible();
    expect(screen.getByText("Phones")).toBeVisible();
  });

  it("asks for confirmation before calling delete", async () => {
    const user = userEvent.setup();
    render(<MenuTreeEditor role="admin" />);

    await screen.findByText("Electronics");
    await user.click(screen.getByRole("button", { name: "Delete Electronics" }));

    // Confirm dialog appears; backend delete not called yet.
    expect(await screen.findByText("Delete 'Electronics'?")).toBeVisible();
    expect(apiDeleteMenuItem).not.toHaveBeenCalled();

    const dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(apiDeleteMenuItem).toHaveBeenCalledTimes(1));
    expect(apiDeleteMenuItem).toHaveBeenCalledWith("2");
  });
});
