import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, vi } from "vitest";
import BannersEditor from "./BannersEditor";
import { ToastProvider } from "../ui/Toast";
import {
  apiDeleteBanner,
  apiFetchBanners,
  apiReorderBanners,
  apiSaveBanner,
  apiUpdateBanner,
} from "../../api/contentApi";

vi.mock("../../api/contentApi", () => ({
  apiFetchBanners: vi.fn(),
  apiSaveBanner: vi.fn(),
  apiUpdateBanner: vi.fn(),
  apiDeleteBanner: vi.fn(),
  apiReorderBanners: vi.fn(),
  apiUploadImage: vi.fn(),
}));

const LAYOUT = {
  banners: [
    {
      id: "b1",
      placement: "home_banner_layout",
      variant: "large",
      title: "Big Sale",
      subtitle: "Up to 50% off",
      cta_text: "Shop Now",
      cta_path: "/products",
      image_url: "https://cdn.example.com/big.jpg",
      display_order: 0,
      is_active: true,
    },
    {
      id: "b2",
      placement: "home_banner_layout",
      variant: "sideways",
      title: "Small Deal",
      subtitle: "",
      cta_text: "",
      cta_path: "",
      image_url: "",
      display_order: 1,
      is_active: true,
    },
  ],
};

const CAROUSEL = {
  banners: [
    {
      id: "c1",
      placement: "home_promo_carousel",
      variant: "standard",
      badge: "END OF SEASON",
      title: "End of Season",
      highlight: "Up to 70% off",
      description: "Fashion and home favourites.",
      cta_text: "Shop the sale",
      cta_path: "/category/fashion",
      gallery: ["https://cdn.example.com/sale-1.jpg", "https://cdn.example.com/sale-2.jpg"],
      display_order: 0,
      is_active: true,
      ends_at: "2026-10-31T23:59:59.000Z",
    },
  ],
};

const renderEditor = () =>
  render(
    <ToastProvider>
      <BannersEditor />
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
  apiFetchBanners.mockImplementation(({ placement }) =>
    Promise.resolve(placement === "home_promo_carousel" ? CAROUSEL : LAYOUT)
  );
  apiSaveBanner.mockResolvedValue({ banner: { id: "b9" } });
  apiUpdateBanner.mockResolvedValue({ banner: { id: "b1" } });
  apiDeleteBanner.mockResolvedValue({ message: "deleted" });
  apiReorderBanners.mockResolvedValue({ message: "reordered" });
});

afterEach(() => {
  removeContentListener();
  removeContentListener = () => {};
});

describe("BannersEditor", () => {
  it("lists the banners for the selected placement", async () => {
    renderEditor();

    expect(await screen.findByText("Big Sale")).toBeVisible();
    expect(screen.getByText("Small Deal")).toBeVisible();
    expect(apiFetchBanners).toHaveBeenCalledWith({
      placement: "home_banner_layout",
      includeInactive: true,
    });
    expect(screen.queryByText("End of Season")).not.toBeInTheDocument();
  });

  it("refetches with the new placement query parameter when the tab changes", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Big Sale");
    await user.click(screen.getByRole("tab", { name: "Home Promo Carousel" }));

    await waitFor(() =>
      expect(apiFetchBanners).toHaveBeenLastCalledWith({
        placement: "home_promo_carousel",
        includeInactive: true,
      })
    );
    expect(await screen.findByText("End of Season")).toBeVisible();
    expect(screen.queryByText("Big Sale")).not.toBeInTheDocument();
  });

  it("treats any variant other than large as a small slot in its preview", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Big Sale");
    await user.click(screen.getByRole("button", { name: "Edit Big Sale" }));
    expect(screen.getByTestId("banner-preview")).toHaveAttribute("data-variant", "large");

    await user.click(screen.getByRole("button", { name: "Close editor" }));
    await user.click(screen.getByRole("button", { name: "Edit Small Deal" }));
    // §3.4: a variant that is neither `large` nor `small` renders as `small`.
    expect(screen.getByTestId("banner-preview")).toHaveAttribute("data-variant", "small");
  });

  it("saves a carousel banner with gallery as an array of strings", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Big Sale");
    await user.click(screen.getByRole("tab", { name: "Home Promo Carousel" }));
    await screen.findByText("End of Season");
    await user.click(screen.getByRole("button", { name: "Edit End of Season" }));

    const dialog = screen.getByRole("dialog", { name: "Banner editor" });
    await user.click(within(dialog).getByRole("button", { name: "Remove gallery image 2" }));
    await user.click(within(dialog).getByRole("button", { name: "Save Banner" }));

    await waitFor(() => expect(apiUpdateBanner).toHaveBeenCalledTimes(1));
    const [id, patch] = apiUpdateBanner.mock.calls[0];
    expect(id).toBe("c1");
    expect(Array.isArray(patch.gallery)).toBe(true);
    expect(patch.gallery).toEqual(["https://cdn.example.com/sale-1.jpg"]);
  });

  it("creates a carousel banner with an empty gallery array rather than null", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Big Sale");
    await user.click(screen.getByRole("tab", { name: "Home Promo Carousel" }));
    await screen.findByText("End of Season");
    await user.click(screen.getByRole("button", { name: "Add Banner" }));

    const dialog = screen.getByRole("dialog", { name: "Banner editor" });
    await user.type(within(dialog).getByLabelText("Title *"), "Fresh Promo");
    await user.click(within(dialog).getByRole("button", { name: "Save Banner" }));

    await waitFor(() => expect(apiSaveBanner).toHaveBeenCalledTimes(1));
    const payload = apiSaveBanner.mock.calls[0][0];
    expect(payload.placement).toBe("home_promo_carousel");
    expect(payload.gallery).toEqual([]);

    // The new banner joins the placement's ordered list: the whole group is
    // renumbered so no two banners share a display_order.
    await waitFor(() => expect(apiReorderBanners).toHaveBeenCalledTimes(1));
    expect(apiReorderBanners).toHaveBeenCalledWith([
      { id: "c1", display_order: 0 },
      { id: "b9", display_order: 1 },
    ]);
  });

  it("edits through apiUpdateBanner with only the changed fields", async () => {
    const user = userEvent.setup();
    const broadcast = captureContentUpdates();
    renderEditor();

    await screen.findByText("Big Sale");
    await user.click(screen.getByRole("button", { name: "Edit Big Sale" }));

    const title = screen.getByLabelText("Title *");
    await user.clear(title);
    await user.type(title, "Bigger Sale");
    await user.click(screen.getByRole("button", { name: "Save Banner" }));

    await waitFor(() => expect(apiUpdateBanner).toHaveBeenCalledTimes(1));
    expect(apiUpdateBanner).toHaveBeenCalledWith("b1", { id: "b1", title: "Bigger Sale" });
    expect(apiSaveBanner).not.toHaveBeenCalled();
    expect(broadcast).toHaveBeenCalled();
  });

  it("updates the banner in place when the edit changes its placement", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Big Sale");
    await user.click(screen.getByRole("button", { name: "Edit Big Sale" }));

    const dialog = screen.getByRole("dialog", { name: "Banner editor" });
    await user.selectOptions(within(dialog).getByLabelText("Placement"), "home_promo_carousel");
    await user.click(within(dialog).getByRole("button", { name: "Save Banner" }));

    // The tab refetched the new placement, so the edited row is no longer in
    // the list — the save must still be an update, never a duplicate create.
    await waitFor(() => expect(apiUpdateBanner).toHaveBeenCalledTimes(1));
    expect(apiUpdateBanner).toHaveBeenCalledWith("b1", {
      id: "b1",
      placement: "home_promo_carousel",
    });
    expect(apiSaveBanner).not.toHaveBeenCalled();
  });

  it("reports a no-op save without writing or broadcasting", async () => {
    const user = userEvent.setup();
    const broadcast = captureContentUpdates();
    renderEditor();

    await screen.findByText("Big Sale");
    await user.click(screen.getByRole("button", { name: "Edit Big Sale" }));
    await user.click(screen.getByRole("button", { name: "Save Banner" }));

    expect(await screen.findByText("No Changes")).toBeVisible();
    expect(screen.getByText("'Big Sale' was not modified.")).toBeVisible();
    expect(apiUpdateBanner).not.toHaveBeenCalled();
    expect(apiSaveBanner).not.toHaveBeenCalled();
    expect(broadcast).not.toHaveBeenCalled();
  });

  it("surfaces display_order in the form and renumbers the placement on save", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Big Sale");
    await user.click(screen.getByRole("button", { name: "Edit Big Sale" }));

    const dialog = screen.getByRole("dialog", { name: "Banner editor" });
    expect(within(dialog).getByText("Display order")).toBeVisible();
    expect(within(dialog).getByText("Position 1 of 2")).toBeVisible();

    await user.click(within(dialog).getByRole("button", { name: "Move down this banner" }));
    expect(within(dialog).getByText("Position 2 of 2")).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Save Banner" }));

    await waitFor(() => expect(apiUpdateBanner).toHaveBeenCalledTimes(1));
    expect(apiUpdateBanner).toHaveBeenCalledWith("b1", { id: "b1", display_order: 1 });
    // Every sibling is renumbered, so no two banners share a position.
    await waitFor(() => expect(apiReorderBanners).toHaveBeenCalledTimes(1));
    expect(apiReorderBanners).toHaveBeenCalledWith([
      { id: "b2", display_order: 0 },
      { id: "b1", display_order: 1 },
    ]);
  });

  it("sends ends_at as an ISO string", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Big Sale");
    await user.click(screen.getByRole("tab", { name: "Home Promo Carousel" }));
    await screen.findByText("End of Season");
    await user.click(screen.getByRole("button", { name: "Edit End of Season" }));

    const endsAt = screen.getByLabelText("Ends at");
    fireEvent.change(endsAt, { target: { value: "2026-11-05T18:30" } });
    await user.click(screen.getByRole("button", { name: "Save Banner" }));

    await waitFor(() => expect(apiUpdateBanner).toHaveBeenCalledTimes(1));
    const patch = apiUpdateBanner.mock.calls[0][1];
    expect(patch.ends_at).toBe(new Date("2026-11-05T18:30").toISOString());
  });

  it("reorders the complete placement list", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Big Sale");
    await user.click(screen.getByRole("button", { name: "Move down Big Sale" }));

    await waitFor(() => expect(apiReorderBanners).toHaveBeenCalledTimes(1));
    expect(apiReorderBanners).toHaveBeenCalledWith([
      { id: "b2", display_order: 0 },
      { id: "b1", display_order: 1 },
    ]);
  });

  it("keeps the form open and shows the real error when a save fails", async () => {
    const user = userEvent.setup();
    apiSaveBanner.mockRejectedValue(new Error("Banner title is required."));
    renderEditor();

    await screen.findByText("Big Sale");
    await user.click(screen.getByRole("button", { name: "Add Banner" }));
    await user.type(screen.getByLabelText("Title *"), "Broken Banner");
    await user.click(screen.getByRole("button", { name: "Save Banner" }));

    expect(await screen.findByText("Save Failed")).toBeVisible();
    const dialog = screen.getByRole("dialog", { name: "Banner editor" });
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Banner title is required.");
    expect(apiFetchBanners).toHaveBeenCalledTimes(1);
  });

  it("renders responsive mobile data-labels on table cells and responsive layout classes", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Big Sale");
    const row = screen.getByTestId("editor-row-b1");
    expect(row).toHaveClass("banners-table-row");

    const cells = within(row).getAllByRole("cell");
    expect(cells[0]).toHaveAttribute("data-label", "title");
    expect(cells[1]).toHaveAttribute("data-label", "variant");
    expect(cells[2]).toHaveAttribute("data-label", "display order");
    expect(cells[3]).toHaveAttribute("data-label", "Actions");

    const tablist = screen.getByRole("tablist", { name: "Banner placement" });
    expect(tablist).toHaveClass("banners-placement-tabs");

    await user.click(screen.getByRole("button", { name: "Add Banner" }));
    const dialog = screen.getByRole("dialog", { name: "Banner editor" });
    expect(dialog).toHaveClass("banners-modal-container");
    expect(dialog.querySelector(".banners-modal-form")).toBeInTheDocument();
    expect(dialog.querySelector(".banners-modal-footer")).toBeInTheDocument();
  });
});
