import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
import ConfirmDialog from "./ConfirmDialog";
import MenuTreeEditor from "./MenuTreeEditor";
import { ToastProvider } from "../ui/Toast";
import {
  apiDeleteMenuItem,
  apiFetchCategoryTree,
  apiFetchMenuItems,
  apiReorderMenuItems,
  apiSaveMenuItem,
  apiUpdateMenuItem,
} from "../../api/contentApi";

vi.mock("../../api/contentApi", () => ({
  apiFetchMenuItems: vi.fn(),
  apiFetchCategoryTree: vi.fn(),
  apiSaveMenuItem: vi.fn(),
  apiUpdateMenuItem: vi.fn(),
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
    roles_allowed: ["user", "vendor", "admin", "super_admin"],
    badge: "Premium",
    badge_variant: "sparkly",
    children: [
      {
        id: "2",
        title: "Electronics",
        path: "/electronics",
        level: 2,
        order_index: 0,
        is_active: true,
        parent_id: "1",
        badge: "HOT",
        badge_variant: "neutral",
        children: [
          {
            id: "3",
            title: "Phones",
            path: "/phones",
            level: 3,
            order_index: 0,
            is_active: true,
            parent_id: "2",
            badge: "Just In",
            badge_variant: "sparkly",
            children: [],
          },
        ],
      },
    ],
  },
  {
    id: "4",
    title: "Deals",
    path: "/deals",
    level: 1,
    order_index: 1,
    is_active: false,
    roles_allowed: ["user", "vendor", "admin", "super_admin"],
    badge: "Hot Deals",
    badge_variant: "sparkly",
    children: [],
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

const CATEGORY_TREE = {
  categories: [
    {
      id: "c1",
      name: "Electronics",
      slug: "electronics",
      level: 1,
      parent_id: null,
      children: [
        {
          id: "c2",
          name: "Mobiles",
          slug: "mobiles",
          level: 2,
          parent_id: "c1",
          children: [
            {
              id: "c5",
              name: "Smartphones",
              slug: "smartphones",
              level: 3,
              parent_id: "c2",
              children: [],
            },
          ],
        },
      ],
    },
    { id: "c4", name: "Home", slug: "home", level: 1, parent_id: null, children: [] },
  ],
};

/** Drop the badge_variant key from every row, as a schema without it would. */
const stripBadgeVariant = (nodes = []) =>
  nodes.map(({ badge_variant, children, ...rest }) => ({
    ...rest,
    children: children ? stripBadgeVariant(children) : children,
  }));

const renderEditor = () =>
  render(
    <ToastProvider>
      <MenuTreeEditor role="admin" />
    </ToastProvider>
  );

/** Open the overflow menu of one tree row and return the menu element. */
const openRowMenu = async (user, title) => {
  await user.click(screen.getByRole("button", { name: `More actions for ${title}` }));
  return screen.findByRole("menu");
};

const MENU_EVENT = "marvel_menu_updated";
const CONTENT_EVENT = "marvel_content_updated";
let cleanup = [];

const captureEvents = () => {
  const menuListener = vi.fn();
  const contentListener = vi.fn();
  window.addEventListener(MENU_EVENT, menuListener);
  window.addEventListener(CONTENT_EVENT, contentListener);
  cleanup.push(
    () => window.removeEventListener(MENU_EVENT, menuListener),
    () => window.removeEventListener(CONTENT_EVENT, contentListener)
  );
  return { menuListener, contentListener };
};

afterEach(() => {
  cleanup.forEach((remove) => remove());
  cleanup = [];
});

beforeEach(() => {
  vi.clearAllMocks();
  apiFetchMenuItems.mockResolvedValue(TREE_DATA);
  apiFetchCategoryTree.mockResolvedValue(CATEGORY_TREE);
  apiDeleteMenuItem.mockResolvedValue({ message: "deleted" });
  apiSaveMenuItem.mockResolvedValue({ id: "9" });
  apiUpdateMenuItem.mockResolvedValue({ item: { id: "2" } });
  apiReorderMenuItems.mockResolvedValue({ message: "reordered" });
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
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("MenuTreeEditor", () => {
  it("renders all three tree levels and fetches the unfiltered tree", async () => {
    renderEditor();

    expect(await screen.findByText("Shop")).toBeVisible();
    expect(screen.getByText("Electronics")).toBeVisible();
    expect(screen.getByText("Phones")).toBeVisible();
    // The reorder scope is every row sharing parent_id, hidden or role-filtered
    // included, so an editor built on the default filtered list would fail.
    expect(apiFetchMenuItems).toHaveBeenCalledWith("admin", { includeInactive: true });
  });

  it("rebuilds a tree from a legacy flat list", async () => {
    apiFetchMenuItems.mockResolvedValueOnce(FLAT_DATA);
    renderEditor();

    expect(await screen.findByText("Shop")).toBeVisible();
    expect(screen.getByText("Electronics")).toBeVisible();
    expect(screen.getByText("Phones")).toBeVisible();
  });

  it("shows the top-level and total item counts in the tree header", async () => {
    renderEditor();

    expect(await screen.findByText("2 top-level · 4 total")).toBeVisible();
  });

  it("groups the row actions into an overflow menu", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Shop");
    const menu = await openRowMenu(user, "Shop");

    expect(within(menu).getByRole("menuitem", { name: "Add child to Shop" })).toBeVisible();
    expect(within(menu).getByRole("menuitem", { name: "Edit Shop" })).toBeVisible();
    expect(within(menu).getByRole("menuitem", { name: "Delete Shop" })).toBeVisible();
  });

  it("disables adding a child below the third level", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Phones");
    const menu = await openRowMenu(user, "Phones");

    expect(within(menu).getByRole("menuitem", { name: "Add child to Phones" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  it("renders the badge with the variant stored on the item", async () => {
    renderEditor();

    // "neutral" is stored, so it wins over the text-derived fallback.
    const row = await screen.findByTestId("menu-row-2");
    const badge = within(row).getByText("HOT");
    expect(badge.closest(".ui-badge")).toHaveClass("ui-badge-outline");
  });

  it("derives the badge colour from its text when no variant is stored", async () => {
    renderEditor();

    const row = await screen.findByTestId("menu-row-4");
    const badge = within(row).getByText("Hot Deals");
    expect(badge.closest(".ui-badge")).toHaveClass("ui-badge-destructive");
  });

  it("falls back to a neutral badge for text that carries no intent", async () => {
    renderEditor();

    const row = await screen.findByTestId("menu-row-1");
    const badge = within(row).getByText("Premium");
    expect(badge.closest(".ui-badge")).toHaveClass("ui-badge-secondary");
  });

  it("shows the active state of every row", async () => {
    renderEditor();

    const activeRow = await screen.findByTestId("menu-row-1");
    expect(within(activeRow).getByText("Active")).toBeVisible();

    const hiddenRow = screen.getByTestId("menu-row-4");
    expect(within(hiddenRow).getByText("Hidden")).toBeVisible();
  });

  it("renders a skeleton while the tree loads", async () => {
    let resolveTree;
    apiFetchMenuItems.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveTree = resolve;
      })
    );
    renderEditor();

    expect(screen.getByTestId("menu-tree-skeleton")).toBeVisible();

    resolveTree(TREE_DATA);
    expect(await screen.findByText("Shop")).toBeVisible();
    expect(screen.queryByTestId("menu-tree-skeleton")).not.toBeInTheDocument();
  });

  it("renders an empty state with a call to action when there are no items", async () => {
    apiFetchMenuItems.mockResolvedValueOnce([]);
    renderEditor();

    expect(await screen.findByText("No menu items yet")).toBeVisible();
    // The header CTA and the empty-state CTA both open the same editor.
    expect(screen.getAllByRole("button", { name: "Add Top-Level Item" })).toHaveLength(2);
  });

  it("edits through apiUpdateMenuItem with is_active included in the patch", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Electronics");
    const menu = await openRowMenu(user, "Electronics");
    await user.click(within(menu).getByRole("menuitem", { name: "Edit Electronics" }));

    const dialog = await screen.findByRole("dialog", { name: "Menu item editor" });
    await user.click(within(dialog).getByRole("button", { name: "Deactivate Electronics" }));
    await user.click(within(dialog).getByRole("button", { name: "Save Menu Item" }));

    await waitFor(() => expect(apiUpdateMenuItem).toHaveBeenCalledTimes(1));
    expect(apiUpdateMenuItem).toHaveBeenCalledWith("2", { id: "2", is_active: false });
    expect(apiSaveMenuItem).not.toHaveBeenCalled();
  });

  it("creates through apiSaveMenuItem with every owned field including badge_variant", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Shop");
    await user.click(screen.getByRole("button", { name: "Add Top-Level Item" }));

    const dialog = await screen.findByRole("dialog", { name: "Menu item editor" });
    await user.type(within(dialog).getByLabelText("Title *"), "New Arrivals");
    await user.clear(within(dialog).getByLabelText("Path *"));
    await user.type(within(dialog).getByLabelText("Path *"), "/new-arrivals");
    await user.type(within(dialog).getByLabelText("Badge"), "New");
    await user.click(within(dialog).getByRole("button", { name: "Save Menu Item" }));

    await waitFor(() => expect(apiSaveMenuItem).toHaveBeenCalledTimes(1));
    const payload = apiSaveMenuItem.mock.calls[0][0];
    expect(payload).toMatchObject({
      title: "New Arrivals",
      path: "/new-arrivals",
      badge: "New",
      badge_variant: "accent",
      is_active: true,
      level: 1,
      parent_id: null,
    });
    expect(Object.keys(payload).sort()).toEqual(
      [
        "title",
        "path",
        "icon",
        "badge",
        "badge_variant",
        "roles_allowed",
        "order_index",
        "level",
        "parent_id",
        "section",
        "section_icon",
        "promo_title",
        "promo_subtitle",
        "promo_image_url",
        "promo_cta_text",
        "promo_cta_path",
        "is_active",
        "category_id",
      ].sort()
    );
  });

  it("saves the badge variant chosen in the editor", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Shop");
    await user.click(screen.getByRole("button", { name: "Add Top-Level Item" }));

    const dialog = await screen.findByRole("dialog", { name: "Menu item editor" });
    await user.type(within(dialog).getByLabelText("Title *"), "Clearance");
    await user.selectOptions(within(dialog).getByLabelText("Badge variant"), "success");
    await user.click(within(dialog).getByRole("button", { name: "Save Menu Item" }));

    await waitFor(() => expect(apiSaveMenuItem).toHaveBeenCalledTimes(1));
    expect(apiSaveMenuItem.mock.calls[0][0]).toMatchObject({ badge_variant: "success" });
  });

  it("offers the badge variant control when the column exists", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Shop");
    await user.click(screen.getByRole("button", { name: "Add Top-Level Item" }));

    const dialog = await screen.findByRole("dialog", { name: "Menu item editor" });
    expect(within(dialog).getByLabelText("Badge variant")).toBeEnabled();
  });

  it("disables the badge variant control when the column is missing", async () => {
    const user = userEvent.setup();
    apiFetchMenuItems.mockResolvedValueOnce(stripBadgeVariant(TREE_DATA));
    renderEditor();

    await screen.findByText("Shop");
    await user.click(screen.getByRole("button", { name: "Add Top-Level Item" }));

    const dialog = await screen.findByRole("dialog", { name: "Menu item editor" });
    // The variant cannot be stored without the column, so the control is
    // disabled rather than letting the save fail.
    expect(within(dialog).getByLabelText("Badge variant")).toBeDisabled();
    expect(within(dialog).getByText(/badge_variant column/i)).toBeVisible();
  });

  it("keeps saving an item when the badge variant column is missing", async () => {
    const user = userEvent.setup();
    apiFetchMenuItems.mockResolvedValueOnce(stripBadgeVariant(TREE_DATA));
    renderEditor();

    await screen.findByText("Shop");
    await user.click(screen.getByRole("button", { name: "Add Top-Level Item" }));

    const dialog = await screen.findByRole("dialog", { name: "Menu item editor" });
    await user.type(within(dialog).getByLabelText("Title *"), "Still Saved");
    await user.click(within(dialog).getByRole("button", { name: "Save Menu Item" }));

    await waitFor(() => expect(apiSaveMenuItem).toHaveBeenCalledTimes(1));
    expect(apiSaveMenuItem.mock.calls[0][0]).toMatchObject({ title: "Still Saved" });
  });

  it("reorders with the complete sibling group and no move keys", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Shop");
    await user.click(screen.getByRole("button", { name: "Move down Shop" }));

    await waitFor(() => expect(apiReorderMenuItems).toHaveBeenCalledTimes(1));
    expect(apiReorderMenuItems).toHaveBeenCalledWith([
      { id: "4", display_order: 0 },
      { id: "1", display_order: 1 },
    ]);

    // A within-group move never changes parents. `parent_id`/`level` are
    // optional (§3.6) and the server re-validates the hierarchy when they are
    // present, so a row whose stored level disagrees with its parent would
    // turn an otherwise valid reorder into a 400.
    const orders = apiReorderMenuItems.mock.calls[0][0];
    for (const order of orders) {
      expect(order).not.toHaveProperty("parent_id");
      expect(order).not.toHaveProperty("level");
    }
  });

  it("derives the path from a chosen category's full ancestor path", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Phones");
    const menu = await openRowMenu(user, "Phones");
    await user.click(within(menu).getByRole("menuitem", { name: "Edit Phones" }));

    const dialog = await screen.findByRole("dialog", { name: "Menu item editor" });
    await user.selectOptions(within(dialog).getByLabelText("Category"), "c5");

    expect(within(dialog).getByLabelText("Path *")).toHaveValue(
      "/category/electronics/mobiles/smartphones"
    );

    await user.click(within(dialog).getByRole("button", { name: "Save Menu Item" }));
    await waitFor(() => expect(apiUpdateMenuItem).toHaveBeenCalledTimes(1));
    expect(apiUpdateMenuItem).toHaveBeenCalledWith("3", {
      id: "3",
      path: "/category/electronics/mobiles/smartphones",
      category_id: "c5",
    });
  });

  it("dispatches both storefront events after a successful write", async () => {
    const user = userEvent.setup();
    const { menuListener, contentListener } = captureEvents();
    renderEditor();

    await screen.findByText("Electronics");
    const menu = await openRowMenu(user, "Electronics");
    await user.click(within(menu).getByRole("menuitem", { name: "Edit Electronics" }));
    const dialog = await screen.findByRole("dialog", { name: "Menu item editor" });
    await user.click(within(dialog).getByRole("button", { name: "Save Menu Item" }));

    await waitFor(() => expect(apiUpdateMenuItem).toHaveBeenCalledTimes(1));
    expect(menuListener).toHaveBeenCalled();
    expect(contentListener).toHaveBeenCalled();
  });

  it("keeps the form open and shows the real error when a save fails", async () => {
    const user = userEvent.setup();
    apiUpdateMenuItem.mockRejectedValue(new Error("Menu item title and path are required."));
    renderEditor();

    await screen.findByText("Electronics");
    const menu = await openRowMenu(user, "Electronics");
    await user.click(within(menu).getByRole("menuitem", { name: "Edit Electronics" }));
    const dialog = await screen.findByRole("dialog", { name: "Menu item editor" });
    await user.click(within(dialog).getByRole("button", { name: "Save Menu Item" }));

    expect(await screen.findByText("Save Failed")).toBeVisible();
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Menu item title and path are required."
    );
    expect(screen.getByRole("dialog", { name: "Menu item editor" })).toBeVisible();
  });

  it("states the descendant count in the delete title", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Shop");
    const menu = await openRowMenu(user, "Shop");
    await user.click(within(menu).getByRole("menuitem", { name: "Delete Shop" }));

    // Electronics and Phones cascade with Shop, so the count is the headline.
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Delete 'Shop' and 2 child items?")).toBeVisible();
    expect(apiDeleteMenuItem).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(apiDeleteMenuItem).toHaveBeenCalledWith("1"));
  });
});
