import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
import CategoriesTreeEditor from "./CategoriesTreeEditor";
import { ToastProvider } from "../ui/Toast";
import {
  apiDeleteCategory,
  apiFetchCategoryTree,
  apiReorderCategories,
  apiSaveCategory,
  apiUpdateCategory,
} from "../../api/contentApi";

vi.mock("../../api/contentApi", () => ({
  apiFetchCategoryTree: vi.fn(),
  apiSaveCategory: vi.fn(),
  apiUpdateCategory: vi.fn(),
  apiDeleteCategory: vi.fn(),
  apiReorderCategories: vi.fn(),
  apiUploadImage: vi.fn(),
}));

const base = {
  parent_id: null,
  display_order: 0,
  is_active: true,
  show_in_nav: true,
  show_in_homepage: false,
  description: null,
  icon: "Layers",
  image_url: null,
  banner_image_url: null,
  children: [],
};

const TREE = {
  categories: [
    {
      ...base,
      id: "c1",
      name: "Electronics",
      slug: "electronics",
      level: 1,
      show_in_homepage: true,
      children: [
        {
          ...base,
          id: "c2",
          name: "Mobiles",
          slug: "mobiles",
          level: 2,
          parent_id: "c1",
          children: [
            {
              ...base,
              id: "c5",
              name: "Smartphones",
              slug: "smartphones",
              level: 3,
              parent_id: "c2",
            },
          ],
        },
        {
          ...base,
          id: "c3",
          name: "Laptops",
          slug: "laptops",
          level: 2,
          parent_id: "c1",
          display_order: 1,
        },
      ],
    },
    {
      ...base,
      id: "c4",
      name: "Home & Kitchen",
      slug: "home-kitchen",
      level: 1,
      display_order: 1,
    },
    {
      ...base,
      id: "c6",
      name: "Accessories",
      slug: "accessories",
      level: 1,
      display_order: 2,
      is_active: false,
    },
  ],
};

const renderEditor = () =>
  render(
    <ToastProvider>
      <CategoriesTreeEditor />
    </ToastProvider>
  );

const CONTENT_EVENT = "marvel_content_updated";
let removeContentListener = () => {};

/** Attach a listener that is always removed after the test, pass or fail. */
const captureContentUpdates = () => {
  const listener = vi.fn();
  window.addEventListener(CONTENT_EVENT, listener);
  removeContentListener = () => window.removeEventListener(CONTENT_EVENT, listener);
  return listener;
};

afterEach(() => {
  removeContentListener();
  removeContentListener = () => {};
});

beforeEach(() => {
  vi.clearAllMocks();
  apiFetchCategoryTree.mockResolvedValue(TREE);
  apiSaveCategory.mockResolvedValue({ category: { id: "c9" } });
  apiUpdateCategory.mockResolvedValue({ category: { id: "c1" } });
  apiDeleteCategory.mockResolvedValue({ message: "deleted" });
  apiReorderCategories.mockResolvedValue({ message: "reordered" });
});

describe("CategoriesTreeEditor", () => {
  it("renders the fetched tree, children included", async () => {
    renderEditor();

    expect(await screen.findByText("Electronics")).toBeVisible();
    expect(screen.getByText("Mobiles")).toBeVisible();
    expect(screen.getByText("Smartphones")).toBeVisible();
    expect(screen.getByText("Laptops")).toBeVisible();
    expect(apiFetchCategoryTree).toHaveBeenCalledWith({ includeInactive: true });
  });

  it("opens an add-subcategory form whose parent is the clicked node", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Electronics");
    await user.click(screen.getByRole("button", { name: "Add subcategory to Electronics" }));

    const dialog = await screen.findByRole("dialog", { name: "Category editor" });
    expect(within(dialog).getByLabelText("Parent category")).toHaveValue("c1");
    expect(within(dialog).getByText(/Level 2/)).toBeVisible();
  });

  it("disables add-subcategory on a level-3 node", async () => {
    renderEditor();

    await screen.findByText("Smartphones");
    expect(screen.getByRole("button", { name: "Add subcategory to Smartphones" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add subcategory to Electronics" })).toBeEnabled();
  });

  it("creates with the full payload: typed values, derived level and every owned field", async () => {
    const user = userEvent.setup();
    const broadcast = captureContentUpdates();
    renderEditor();

    await screen.findByText("Electronics");
    await user.click(screen.getByRole("button", { name: "Add subcategory to Electronics" }));
    await user.type(screen.getByLabelText("Name *"), "Tablets");

    // A new row's slug follows its name until the admin edits the slug.
    expect(screen.getByLabelText("Slug *")).toHaveValue("tablets");

    await user.click(screen.getByRole("button", { name: "Save Category" }));

    await waitFor(() => expect(apiSaveCategory).toHaveBeenCalledTimes(1));
    const payload = apiSaveCategory.mock.calls[0][0];
    expect(payload).toMatchObject({
      name: "Tablets",
      slug: "tablets",
      parent_id: "c1",
      level: 2,
    });
    expect(Object.keys(payload).sort()).toEqual(
      [
        "name",
        "slug",
        "parent_id",
        "level",
        "description",
        "icon",
        "image_url",
        "banner_image_url",
        "display_order",
        "is_active",
        "show_in_nav",
        "show_in_homepage",
      ].sort()
    );
    expect(broadcast).toHaveBeenCalled();
  });

  it("edits through apiUpdateCategory with only the changed fields", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Electronics");
    await user.click(screen.getByRole("button", { name: "Edit Electronics" }));

    const name = screen.getByLabelText("Name *");
    await user.clear(name);
    await user.type(name, "Electronics & Tech");
    await user.click(screen.getByRole("button", { name: "Save Category" }));

    await waitFor(() => expect(apiUpdateCategory).toHaveBeenCalledTimes(1));
    // Controller ruling: the patch carries the id so the server patches rather
    // than inserts, plus only the fields the admin actually changed.
    expect(apiUpdateCategory).toHaveBeenCalledWith("c1", {
      id: "c1",
      name: "Electronics & Tech",
    });
    expect(apiSaveCategory).not.toHaveBeenCalled();
  });

  it("sends only show_in_homepage when that is the only edited field", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Electronics");
    await user.click(screen.getByRole("button", { name: "Edit Electronics" }));

    await user.click(screen.getByLabelText("Show on homepage"));
    await user.click(screen.getByRole("button", { name: "Save Category" }));

    await waitFor(() => expect(apiUpdateCategory).toHaveBeenCalledTimes(1));
    expect(apiUpdateCategory).toHaveBeenCalledWith("c1", {
      id: "c1",
      show_in_homepage: false,
    });
  });

  it("keeps a saved category's stored slug when only its name changes", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Electronics");
    await user.click(screen.getByRole("button", { name: "Edit Electronics" }));

    const name = screen.getByLabelText("Name *");
    await user.clear(name);
    await user.type(name, "Electronics & Gadgets");

    expect(screen.getByLabelText("Slug *")).toHaveValue("electronics");
  });

  it("stops deriving a new row's slug once the admin edits the slug", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Electronics");
    await user.click(screen.getByRole("button", { name: "Add Top-Level Category" }));

    const name = screen.getByLabelText("Name *");
    const slug = screen.getByLabelText("Slug *");

    await user.type(name, "Home & Kitchen");
    expect(slug).toHaveValue("home-kitchen");

    await user.clear(slug);
    await user.type(slug, "custom-home");
    await user.type(name, " Decor");

    expect(slug).toHaveValue("custom-home");
  });

  it("warns when a saved category's slug changes", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Electronics");
    await user.click(screen.getByRole("button", { name: "Edit Electronics" }));

    const slug = screen.getByLabelText("Slug *");
    await user.clear(slug);
    await user.type(slug, "electronics-new");

    expect(await screen.findByRole("status")).toHaveTextContent(/path/i);
  });

  it("hides inactive rows until Show hidden is on", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Electronics");
    expect(screen.queryByText("Accessories")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Show hidden"));
    expect(await screen.findByText("Accessories")).toBeVisible();
  });

  it("deletes only after confirmation, stating the descendant count in the title", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Electronics");
    await user.click(screen.getByRole("button", { name: "Delete Electronics" }));

    // Mobiles, Laptops and Smartphones cascade with the parent, so the count is
    // the headline rather than a trailing sentence in the body.
    const title = await screen.findByText("Delete 'Electronics' and 3 subcategories?");
    expect(title).toBeVisible();
    expect(screen.getByText(/every subcategory/i)).toBeVisible();
    expect(apiDeleteCategory).not.toHaveBeenCalled();

    const dialog = screen.getByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", { name: "Delete" });
    expect(confirm).toHaveClass("chart-pill-btn-danger");
    await user.click(confirm);

    await waitFor(() => expect(apiDeleteCategory).toHaveBeenCalledWith("c1"));
  });

  it("counts hidden descendants in the delete warning", async () => {
    const user = userEvent.setup();
    apiFetchCategoryTree.mockResolvedValueOnce({
      categories: [
        {
          ...base,
          id: "c1",
          name: "Electronics",
          slug: "electronics",
          level: 1,
          children: [
            {
              ...base,
              id: "c7",
              name: "Clearance",
              slug: "clearance",
              level: 2,
              parent_id: "c1",
              is_active: false,
            },
          ],
        },
      ],
    });
    renderEditor();

    await screen.findByText("Electronics");
    expect(screen.queryByText("Clearance")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete Electronics" }));
    // The cascade deletes hidden rows too, so the headline must count them.
    expect(await screen.findByText("Delete 'Electronics' and 1 subcategory?")).toBeVisible();
  });

  it("reorders one sibling group and sends the complete ordered list", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Electronics");
    await user.click(screen.getByRole("button", { name: "Move down Electronics" }));

    await waitFor(() => expect(apiReorderCategories).toHaveBeenCalledTimes(1));
    // All three roots, renumbered 0..n-1 in the new order — the hidden
    // Accessories row is part of the scope even though it is not rendered.
    expect(apiReorderCategories).toHaveBeenCalledWith([
      { id: "c4", display_order: 0 },
      { id: "c1", display_order: 1 },
      { id: "c6", display_order: 2 },
    ]);
  });

  it("keeps the form open and shows the real error when a save fails", async () => {
    const user = userEvent.setup();
    apiSaveCategory.mockRejectedValue(new Error("Slug already exists."));
    renderEditor();

    await screen.findByText("Electronics");
    await user.click(screen.getByRole("button", { name: "Add subcategory to Electronics" }));
    await user.type(screen.getByLabelText("Name *"), "Tablets");
    await user.click(screen.getByRole("button", { name: "Save Category" }));

    expect(await screen.findByText("Save Failed")).toBeVisible();
    const dialog = screen.getByRole("dialog", { name: "Category editor" });
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Slug already exists.");
    // A failed write must not be followed by a reload that hides the form.
    expect(apiFetchCategoryTree).toHaveBeenCalledTimes(1);
  });

  it("clears an image then saves with image_url: null and no escaping exception", async () => {
    const user = userEvent.setup();
    apiFetchCategoryTree.mockResolvedValueOnce({
      categories: [
        {
          ...base,
          id: "c1",
          name: "Electronics",
          slug: "electronics",
          level: 1,
          image_url: "https://cdn.example.com/electronics.png",
          banner_image_url: "https://cdn.example.com/electronics-banner.png",
        },
      ],
    });
    renderEditor();

    await screen.findByText("Electronics");
    await user.click(screen.getByRole("button", { name: "Edit Electronics" }));
    // ImageField reports null, which previously crashed toPayload() before the
    // try block and left the form silently stuck.
    await user.click(screen.getByRole("button", { name: "Clear Category image" }));
    await user.click(screen.getByRole("button", { name: "Clear Banner image" }));
    await user.click(screen.getByRole("button", { name: "Save Category" }));

    await waitFor(() => expect(apiUpdateCategory).toHaveBeenCalledTimes(1));
    expect(apiUpdateCategory).toHaveBeenCalledWith("c1", {
      id: "c1",
      image_url: null,
      banner_image_url: null,
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Category editor" })).not.toBeInTheDocument()
    );
  });

  it("sends an emptied slug as typed so the server can reject it", async () => {
    const user = userEvent.setup();
    apiUpdateCategory.mockRejectedValue(
      new Error("Slug is required and must use lowercase letters, numbers and hyphens.")
    );
    renderEditor();

    await screen.findByText("Electronics");
    await user.click(screen.getByRole("button", { name: "Edit Electronics" }));
    await user.clear(screen.getByLabelText("Slug *"));
    await user.click(screen.getByRole("button", { name: "Save Category" }));

    await waitFor(() => expect(apiUpdateCategory).toHaveBeenCalledTimes(1));
    // No silent slugify fallback: the empty value reaches the transport.
    expect(apiUpdateCategory).toHaveBeenCalledWith("c1", { id: "c1", slug: "" });
    const dialog = screen.getByRole("dialog", { name: "Category editor" });
    expect(within(dialog).getByRole("alert")).toHaveTextContent(/slug is required/i);
  });

  it("does not dispatch marvel_content_updated when a save fails", async () => {
    const user = userEvent.setup();
    const broadcast = captureContentUpdates();
    apiSaveCategory.mockRejectedValue(new Error("Slug already exists."));
    renderEditor();

    await screen.findByText("Electronics");
    await user.click(screen.getByRole("button", { name: "Add subcategory to Electronics" }));
    await user.type(screen.getByLabelText("Name *"), "Tablets");
    await user.click(screen.getByRole("button", { name: "Save Category" }));

    expect(await screen.findByText("Save Failed")).toBeVisible();
    expect(broadcast).not.toHaveBeenCalled();
  });

  it("fires a single delete request when Delete is double-clicked", async () => {
    const user = userEvent.setup();
    let resolveDelete;
    apiDeleteCategory.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDelete = resolve;
        })
    );
    renderEditor();

    await screen.findByText("Electronics");
    await user.click(screen.getByRole("button", { name: "Delete Electronics" }));
    const dialog = screen.getByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", { name: "Delete" });

    await user.dblClick(confirm);
    expect(apiDeleteCategory).toHaveBeenCalledTimes(1);

    resolveDelete({ message: "deleted" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("fires a single reorder request when a move button is double-clicked", async () => {
    const user = userEvent.setup();
    let resolveReorder;
    apiReorderCategories.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveReorder = resolve;
        })
    );
    renderEditor();

    await screen.findByText("Electronics");
    const moveDown = screen.getByRole("button", { name: "Move down Electronics" });

    await user.dblClick(moveDown);
    expect(apiReorderCategories).toHaveBeenCalledTimes(1);

    resolveReorder({ message: "reordered" });
    await waitFor(() => expect(screen.getByText("Categories Reordered")).toBeVisible());
  });
});
