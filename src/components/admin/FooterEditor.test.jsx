import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, vi } from "vitest";
import FooterEditor from "./FooterEditor";
import { ToastProvider } from "../ui/Toast";
import {
  apiDeleteFooterLink,
  apiDeleteFooterSection,
  apiFetchFooter,
  apiReorderFooterLinks,
  apiReorderFooterSections,
  apiSaveFooterLink,
  apiSaveFooterSection,
  apiUpdateFooterLink,
  apiUpdateFooterSection,
} from "../../api/contentApi";

vi.mock("../../api/contentApi", () => ({
  apiFetchFooter: vi.fn(),
  apiSaveFooterSection: vi.fn(),
  apiUpdateFooterSection: vi.fn(),
  apiDeleteFooterSection: vi.fn(),
  apiReorderFooterSections: vi.fn(),
  apiSaveFooterLink: vi.fn(),
  apiUpdateFooterLink: vi.fn(),
  apiDeleteFooterLink: vi.fn(),
  apiReorderFooterLinks: vi.fn(),
  apiUploadImage: vi.fn(),
}));

const LINKS = [
  {
    id: "l1",
    section_id: "s1",
    label: "Help Center",
    href: "#/help",
    display_order: 0,
    is_active: true,
  },
  {
    id: "l2",
    section_id: "s1",
    label: "Returns",
    href: "/returns",
    display_order: 1,
    is_active: true,
  },
];

const SECTIONS = [
  {
    id: "s1",
    heading: "Customer Support",
    section_type: "links",
    column_index: 0,
    display_order: 0,
    is_active: true,
    links: LINKS,
  },
  {
    id: "s2",
    heading: "Popular Searches",
    section_type: "tags",
    column_index: 1,
    display_order: 1,
    is_active: true,
    links: [],
  },
];

const renderEditor = () =>
  render(
    <ToastProvider>
      <FooterEditor />
    </ToastProvider>
  );

const CONTENT_EVENT = "marvel_content_updated";
let removeContentListener = () => {};

const captureContentUpdates = () => {
  const listener = vi.fn();
  window.addEventListener(CONTENT_EVENT, listener);
  removeContentListener = () => window.removeEventListener(CONTENT_EVENT, listener);
  return listener;
};

beforeEach(() => {
  vi.clearAllMocks();
  apiFetchFooter.mockResolvedValue({ sections: SECTIONS, links: LINKS });
  apiSaveFooterSection.mockResolvedValue({ section: { id: "s9" } });
  apiUpdateFooterSection.mockResolvedValue({ section: { id: "s1" } });
  apiDeleteFooterSection.mockResolvedValue({ message: "deleted" });
  apiReorderFooterSections.mockResolvedValue({ message: "reordered" });
  apiSaveFooterLink.mockResolvedValue({ link: { id: "l9" } });
  apiUpdateFooterLink.mockResolvedValue({ link: { id: "l1" } });
  apiDeleteFooterLink.mockResolvedValue({ message: "deleted" });
  apiReorderFooterLinks.mockResolvedValue({ message: "reordered" });
});

afterEach(() => {
  removeContentListener();
  removeContentListener = () => {};
});

describe("FooterEditor", () => {
  it("lists the sections and the selected section's links", async () => {
    renderEditor();

    expect(await screen.findByText("Customer Support")).toBeVisible();
    expect(screen.getByText("Popular Searches")).toBeVisible();
    expect(screen.getByText("Help Center")).toBeVisible();
    expect(screen.getByText("Returns")).toBeVisible();
    expect(apiFetchFooter).toHaveBeenCalledWith({ includeInactive: true });
  });

  it("switches the right pane when another section is selected", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Customer Support");
    await user.click(screen.getByRole("button", { name: "Popular Searches" }));

    await waitFor(() => expect(screen.queryByText("Help Center")).not.toBeInTheDocument());
    expect(screen.getByText(/no links in this section/i)).toBeVisible();
  });

  it("creates a link with the selected section's section_id", async () => {
    const user = userEvent.setup();
    const broadcast = captureContentUpdates();
    renderEditor();

    await screen.findByText("Customer Support");
    await user.click(screen.getByRole("button", { name: "Add Link" }));

    const dialog = screen.getByRole("dialog", { name: "Footer link editor" });
    await user.type(within(dialog).getByLabelText("Label *"), "Contact Us");
    await user.type(within(dialog).getByLabelText("Href *"), "#/contact");
    await user.click(within(dialog).getByRole("button", { name: "Save Link" }));

    await waitFor(() => expect(apiSaveFooterLink).toHaveBeenCalledTimes(1));
    expect(apiSaveFooterLink).toHaveBeenCalledWith({
      section_id: "s1",
      label: "Contact Us",
      href: "#/contact",
      display_order: 2,
      is_active: true,
    });
    expect(broadcast).toHaveBeenCalled();
  });

  it("renumbers the section's links after a create so no position is shared", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Customer Support");
    await user.click(screen.getByRole("button", { name: "Add Link" }));

    const dialog = screen.getByRole("dialog", { name: "Footer link editor" });
    await user.type(within(dialog).getByLabelText("Label *"), "Contact Us");
    await user.type(within(dialog).getByLabelText("Href *"), "#/contact");
    await user.click(within(dialog).getByRole("button", { name: "Save Link" }));

    await waitFor(() => expect(apiReorderFooterLinks).toHaveBeenCalledTimes(1));
    // The whole group is renumbered 0..n-1: a create must not reuse a
    // display_order that a delete left behind.
    expect(apiReorderFooterLinks).toHaveBeenCalledWith([
      { id: "l1", display_order: 0 },
      { id: "l2", display_order: 1 },
      { id: "l9", display_order: 2 },
    ]);
  });

  it("accepts a hash route as the href without adding a stricter client rule", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Customer Support");
    await user.click(screen.getByRole("button", { name: "Edit link Help Center" }));

    const href = screen.getByLabelText("Href *");
    await user.clear(href);
    await user.type(href, "#/category/electronics/mobiles");
    await user.click(screen.getByRole("button", { name: "Save Link" }));

    await waitFor(() => expect(apiUpdateFooterLink).toHaveBeenCalledTimes(1));
    expect(apiUpdateFooterLink).toHaveBeenCalledWith("l1", {
      id: "l1",
      href: "#/category/electronics/mobiles",
    });
  });

  it("states how many links are deleted with a section, in the dialog title", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Customer Support");
    await user.click(screen.getByRole("button", { name: "Delete section Customer Support" }));

    expect(await screen.findByText("Delete 'Customer Support' and its 2 links?")).toBeVisible();
    expect(apiDeleteFooterSection).not.toHaveBeenCalled();

    const dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(apiDeleteFooterSection).toHaveBeenCalledWith("s1"));
  });

  it("drops the link clause from the delete title when the section is empty", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Popular Searches");
    await user.click(screen.getByRole("button", { name: "Delete section Popular Searches" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Delete 'Popular Searches'?")).toBeVisible();
    expect(within(dialog).queryByText(/0 links/i)).not.toBeInTheDocument();
    expect(
      within(dialog).getByText("This section has no links. This cannot be undone.")
    ).toBeVisible();
  });

  it("keeps ordering out of the form so links cannot share a position", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Help Center");
    await user.click(screen.getByRole("button", { name: "Edit link Help Center" }));

    const dialog = screen.getByRole("dialog", { name: "Footer link editor" });
    // The row-level up/down controls renumber the complete group; a raw
    // display_order in the form would leave two links on the same position.
    expect(within(dialog).queryByText("Display order")).not.toBeInTheDocument();

    const label = within(dialog).getByLabelText("Label *");
    await user.clear(label);
    await user.type(label, "Help & Support");
    await user.click(within(dialog).getByRole("button", { name: "Save Link" }));

    await waitFor(() => expect(apiUpdateFooterLink).toHaveBeenCalledTimes(1));
    expect(apiUpdateFooterLink).toHaveBeenCalledWith("l1", {
      id: "l1",
      label: "Help & Support",
    });
  });

  it("steers admins to hash routes in the href hint", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Help Center");
    await user.click(screen.getByRole("button", { name: "Edit link Help Center" }));

    const dialog = screen.getByRole("dialog", { name: "Footer link editor" });
    expect(within(dialog).getByText(/#\/category\/electronics/)).toBeVisible();
    expect(within(dialog).getByText(/leaves the app/i)).toBeVisible();
  });

  it("reorders links with the complete list for that section", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Customer Support");
    await user.click(screen.getByRole("button", { name: "Move down Help Center" }));

    await waitFor(() => expect(apiReorderFooterLinks).toHaveBeenCalledTimes(1));
    expect(apiReorderFooterLinks).toHaveBeenCalledWith([
      { id: "l2", display_order: 0 },
      { id: "l1", display_order: 1 },
    ]);
  });

  it("reorders sections with the complete section list", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Customer Support");
    await user.click(screen.getByRole("button", { name: "Move down Customer Support" }));

    await waitFor(() => expect(apiReorderFooterSections).toHaveBeenCalledTimes(1));
    expect(apiReorderFooterSections).toHaveBeenCalledWith([
      { id: "s2", display_order: 0 },
      { id: "s1", display_order: 1 },
    ]);
  });

  it("keeps the form open and shows the real error when a save fails", async () => {
    const user = userEvent.setup();
    apiSaveFooterLink.mockRejectedValue(
      new Error("Field 'href' must be an https URL or a relative path.")
    );
    renderEditor();

    await screen.findByText("Customer Support");
    await user.click(screen.getByRole("button", { name: "Add Link" }));
    await user.type(screen.getByLabelText("Label *"), "Broken");
    await user.type(screen.getByLabelText("Href *"), "ftp://nope");
    await user.click(screen.getByRole("button", { name: "Save Link" }));

    expect(await screen.findByText("Save Failed")).toBeVisible();
    const dialog = screen.getByRole("dialog", { name: "Footer link editor" });
    expect(within(dialog).getByRole("alert")).toHaveTextContent(/must be an https URL/i);
    expect(apiFetchFooter).toHaveBeenCalledTimes(1);
  });
});
