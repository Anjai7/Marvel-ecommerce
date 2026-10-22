import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, vi } from "vitest";
import PagesEditor from "./PagesEditor";
import { ToastProvider } from "../ui/Toast";
import {
  apiDeletePage,
  apiFetchPage,
  apiFetchPages,
  apiPublishPage,
  apiSavePage,
  apiSavePageSections,
  apiUnpublishPage,
  apiUpdatePage,
} from "../../api/pagesApi";

vi.mock("../../api/pagesApi", () => ({
  apiFetchPages: vi.fn(),
  apiFetchPage: vi.fn(),
  apiSavePage: vi.fn(),
  apiUpdatePage: vi.fn(),
  apiDeletePage: vi.fn(),
  apiSavePageSections: vi.fn(),
  apiPublishPage: vi.fn(),
  apiUnpublishPage: vi.fn(),
}));

const PAGE_A = {
  id: "p1",
  title: "Diwali Sale",
  slug: "diwali-sale",
  description: "The festive sale",
  kind: "campaign",
  template: "landing",
  status: "published",
  published_at: "2026-10-01T09:00:00.000Z",
  scheduled_at: null,
  expired_at: null,
  seo: {
    title: "Diwali Sale",
    description: "Save big this festive season.",
    canonical: "https://marvel.example/pages/diwali-sale",
  },
  updated_at: "2026-10-20T09:00:00.000Z",
};

const PAGE_B = {
  id: "p2",
  title: "Shipping Policy",
  slug: "shipping-policy",
  description: "",
  kind: "policy",
  template: "standard",
  status: "draft",
  published_at: null,
  scheduled_at: null,
  expired_at: null,
  seo: {},
  updated_at: "2026-10-19T09:00:00.000Z",
};

const HERO = {
  id: "s1",
  type: "hero",
  enabled: true,
  position: 0,
  data: {
    heading: "Diwali Sale",
    eyebrow: "",
    subheading: "",
    image_url: "",
    image_alt: "",
    cta_label: "Shop now",
    cta_href: "#/",
    theme: "light",
  },
  style: {},
};

const RICHTEXT = {
  id: "s2",
  type: "richtext",
  enabled: true,
  position: 1,
  data: { body: "The festive sale is here.", align: "left" },
  style: {},
};

const renderEditor = () =>
  render(
    <ToastProvider>
      <PagesEditor />
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
  apiFetchPages.mockResolvedValue({ pages: [PAGE_A, PAGE_B] });
  apiFetchPage.mockImplementation((id) =>
    Promise.resolve(
      id === "p3"
        ? { page: { ...PAGE_A, id: "p3", title: "Autumn Sale", slug: "autumn-sale" }, sections: [] }
        : { page: PAGE_A, sections: [HERO, RICHTEXT] }
    )
  );
  apiSavePage.mockResolvedValue({
    message: "Page created successfully.",
    page: { id: "p3", title: "Autumn Sale", slug: "autumn-sale", status: "draft" },
  });
  apiUpdatePage.mockResolvedValue({ message: "Page saved successfully.", page: PAGE_A });
  apiDeletePage.mockResolvedValue({ message: "Page deleted successfully." });
  apiSavePageSections.mockResolvedValue({ message: "Sections saved." });
  apiPublishPage.mockResolvedValue({
    message: "Page published successfully.",
    page: { ...PAGE_A, status: "published" },
    scheduled: false,
  });
  apiUnpublishPage.mockResolvedValue({
    message: "Page unpublished successfully.",
    page: { ...PAGE_A, status: "draft" },
  });
});

/** Open the editor of the first page. */
const openEditor = async (user) => {
  await screen.findAllByTestId(/^editor-row-/);
  await user.click(screen.getByRole("button", { name: "Edit Diwali Sale" }));
  await screen.findByRole("heading", { name: "Diwali Sale" });
};

/** The list the last section save submitted. */
const submittedSections = () => apiSavePageSections.mock.calls[0][1];

describe("PagesEditor", () => {
  it("renders one row per page", async () => {
    renderEditor();

    const rows = await screen.findAllByTestId(/^editor-row-/);
    expect(rows).toHaveLength(2);

    expect(within(rows[0]).getByText("Diwali Sale")).toBeVisible();
    expect(within(rows[0]).getByText("diwali-sale")).toBeVisible();
    expect(within(rows[0]).getByText("Published")).toBeVisible();

    expect(within(rows[1]).getByText("Shipping Policy")).toBeVisible();
    expect(within(rows[1]).getByText("shipping-policy")).toBeVisible();
    expect(within(rows[1]).getByText("Draft")).toBeVisible();
  });

  it("shows the published URL for a published page", async () => {
    renderEditor();

    const rows = await screen.findAllByTestId(/^editor-row-/);
    expect(within(rows[0]).getByText("#/pages/diwali-sale")).toBeVisible();
    // A draft has no public address to show.
    expect(within(rows[1]).queryByText("#/pages/shipping-policy")).toBeNull();
  });

  it("the New page action creates a draft and opens the editor", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findAllByTestId(/^editor-row-/);
    await user.click(screen.getByRole("button", { name: "New page" }));

    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Title *"), "Autumn Sale");
    // The slug follows the title until the admin types one of their own.
    expect(within(dialog).getByLabelText("Slug *")).toHaveValue("autumn-sale");

    await user.click(within(dialog).getByRole("button", { name: "Create page" }));

    await waitFor(() => expect(apiSavePage).toHaveBeenCalledTimes(1));
    expect(apiSavePage.mock.calls[0][0]).toMatchObject({
      title: "Autumn Sale",
      slug: "autumn-sale",
      status: "draft",
    });

    // The editor of the new page takes over the screen.
    expect(await screen.findByRole("heading", { name: "Autumn Sale" })).toBeVisible();
  });

  it("rejects a duplicate slug with the server error message", async () => {
    const user = userEvent.setup();
    apiSavePage.mockRejectedValue(new Error("A page with this slug already exists."));
    renderEditor();

    await screen.findAllByTestId(/^editor-row-/);
    await user.click(screen.getByRole("button", { name: "New page" }));

    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Title *"), "Diwali Sale");
    await user.click(within(dialog).getByRole("button", { name: "Create page" }));

    expect(await within(dialog).findByText("A page with this slug already exists.")).toBeVisible();
    // The form stays open: the admin's input must survive a failed write.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(apiSavePage).toHaveBeenCalledTimes(1);
  });

  it("adds a section to the page", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openEditor(user);

    await user.click(screen.getByRole("button", { name: "Add section" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Spacer" }));

    await user.click(screen.getByRole("button", { name: "Save Sections" }));

    await waitFor(() => expect(apiSavePageSections).toHaveBeenCalledTimes(1));
    expect(submittedSections()).toHaveLength(3);
    expect(submittedSections()[2].type).toBe("spacer");
    // A new section carries no id until the server assigns one.
    expect(submittedSections()[2].id).toBeNull();
  });

  it("reorders a section with the move controls", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openEditor(user);

    await user.click(screen.getByRole("button", { name: "Move down Hero banner 1" }));

    // The move is announced, and the focus follows the moved card.
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Hero banner moved to position 2 of 2."
    );
    await waitFor(() => expect(screen.getByTestId("section-card-s1")).toHaveFocus());

    await user.click(screen.getByRole("button", { name: "Save Sections" }));

    await waitFor(() => expect(apiSavePageSections).toHaveBeenCalledTimes(1));
    expect(submittedSections().map((section) => section.type)).toEqual(["richtext", "hero"]);
  });

  it("duplicates a section", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openEditor(user);

    await user.click(screen.getByRole("button", { name: "Duplicate Hero banner 1" }));
    await user.click(screen.getByRole("button", { name: "Save Sections" }));

    await waitFor(() => expect(apiSavePageSections).toHaveBeenCalledTimes(1));
    const submitted = submittedSections();
    expect(submitted).toHaveLength(3);
    // The copy sits directly below the original and carries the same content.
    expect(submitted[1].type).toBe("hero");
    expect(submitted[1].data).toEqual(HERO.data);
    expect(submitted[1].id).not.toBe(submitted[0].id);
  });

  it("hides a section without removing it", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openEditor(user);

    await user.click(screen.getByRole("button", { name: "Deactivate Hero banner 1" }));
    await user.click(screen.getByRole("button", { name: "Save Sections" }));

    await waitFor(() => expect(apiSavePageSections).toHaveBeenCalledTimes(1));
    const submitted = submittedSections();
    expect(submitted).toHaveLength(2);
    expect(submitted[0].enabled).toBe(false);
  });

  it("removes a section", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openEditor(user);

    await user.click(screen.getByRole("button", { name: "Delete Hero banner 1" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await user.click(screen.getByRole("button", { name: "Save Sections" }));

    await waitFor(() => expect(apiSavePageSections).toHaveBeenCalledTimes(1));
    expect(submittedSections()).toHaveLength(1);
    expect(submittedSections()[0].type).toBe("richtext");
  });

  it("rejects a section with an invalid field before saving", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openEditor(user);

    await user.click(screen.getByRole("button", { name: "Add section" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Hero banner" }));

    await user.click(screen.getByRole("button", { name: "Save Sections" }));

    // The hero has no heading, so the list is refused before it is written.
    expect(apiSavePageSections).not.toHaveBeenCalled();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("hero.heading is required.");
  });

  it("publishes the page", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openEditor(user);

    await user.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(apiPublishPage).toHaveBeenCalledTimes(1));
    expect(apiPublishPage.mock.calls[0][0]).toBe("p1");
    // The publish route owns the lifecycle: a status is never sent.
    expect(apiPublishPage.mock.calls[0][1]).toEqual({});
  });

  it("unpublishes the page", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openEditor(user);

    await user.click(screen.getByRole("button", { name: "Unpublish" }));

    await waitFor(() => expect(apiUnpublishPage).toHaveBeenCalledWith("p1"));
  });

  it("dispatches the content updated event after a successful save", async () => {
    const user = userEvent.setup();
    const broadcast = captureContentUpdates();
    renderEditor();
    await openEditor(user);

    const title = screen.getByLabelText("Title *");
    await user.clear(title);
    await user.type(title, "Diwali Mega Sale");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(apiUpdatePage).toHaveBeenCalledTimes(1));
    expect(broadcast).toHaveBeenCalled();
  });

  it("does not dispatch the event when the save fails", async () => {
    const user = userEvent.setup();
    const broadcast = captureContentUpdates();
    apiUpdatePage.mockRejectedValue(new Error("Could not save the page."));
    renderEditor();
    await openEditor(user);

    const title = screen.getByLabelText("Title *");
    await user.clear(title);
    await user.type(title, "Diwali Mega Sale");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Save Failed")).toBeVisible();
    expect(broadcast).not.toHaveBeenCalled();
  });

  it("shows the real status of each page", async () => {
    renderEditor();

    const rows = await screen.findAllByTestId(/^editor-row-/);
    expect(within(rows[0]).getByText("Published")).toBeVisible();
    expect(within(rows[1]).getByText("Draft")).toBeVisible();
  });

  it("shows an Archived page as Archived", async () => {
    const archivedPage = {
      ...PAGE_B,
      id: "p-archived",
      title: "Old Campaign",
      slug: "old-campaign",
      status: "archived",
    };
    apiFetchPages.mockResolvedValueOnce({ pages: [archivedPage] });
    renderEditor();

    const rows = await screen.findAllByTestId(/^editor-row-/);
    expect(within(rows[0]).getByText("Old Campaign")).toBeVisible();
    expect(within(rows[0]).getByText("Archived")).toBeVisible();
    expect(within(rows[0]).queryByText("Published")).toBeNull();
  });

  it("publishes a page from the list", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findAllByTestId(/^editor-row-/);
    const publishButton = screen.getByRole("button", { name: "Publish Shipping Policy" });
    await user.click(publishButton);

    await waitFor(() => expect(apiPublishPage).toHaveBeenCalledWith("p2", {}));
  });

  it("unpublishes a page from the list", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findAllByTestId(/^editor-row-/);
    const unpublishButton = screen.getByRole("button", { name: "Unpublish Diwali Sale" });
    await user.click(unpublishButton);

    await waitFor(() => expect(apiUnpublishPage).toHaveBeenCalledWith("p1"));
  });
});
