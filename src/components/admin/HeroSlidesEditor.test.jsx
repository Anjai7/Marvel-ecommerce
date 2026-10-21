import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
import HeroSlidesEditor from "./HeroSlidesEditor";
import { ToastProvider } from "../ui/Toast";
import {
  apiDeleteHeroSlide,
  apiFetchHeroSlides,
  apiReorderHeroSlides,
  apiSaveHeroSlide,
  apiUpdateHeroSlide,
} from "../../api/contentApi";

vi.mock("../../api/contentApi", () => ({
  apiFetchHeroSlides: vi.fn(),
  apiSaveHeroSlide: vi.fn(),
  apiUpdateHeroSlide: vi.fn(),
  apiDeleteHeroSlide: vi.fn(),
  apiReorderHeroSlides: vi.fn(),
  apiUploadImage: vi.fn(),
}));

const SLIDES = [
  {
    id: "s1",
    badge: "New",
    title: "Summer Sale",
    subtitle: "Up to 50% off",
    btn_text: "Shop Now",
    btn_path: "/products",
    bg_image_url: "https://example.com/bg.jpg",
    product_image_url: "https://example.com/product.jpg",
    fallback_image_url: "",
    bg_gradient: "",
    price_text: "₹99",
    tag: "hot",
    ribbon_text: "deal",
    order_index: 0,
    is_active: true,
  },
  {
    id: "s2",
    badge: "",
    title: "Winter Drop",
    subtitle: "",
    btn_text: "",
    btn_path: "/products",
    bg_image_url: "",
    product_image_url: "",
    fallback_image_url: "",
    bg_gradient: "",
    price_text: "",
    tag: "",
    ribbon_text: "",
    order_index: 1,
    is_active: false,
  },
];

const renderEditor = () =>
  render(
    <ToastProvider>
      <HeroSlidesEditor />
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

afterEach(() => {
  removeContentListener();
  removeContentListener = () => {};
});

beforeEach(() => {
  vi.clearAllMocks();
  apiFetchHeroSlides.mockResolvedValue({ slides: [...SLIDES] });
  apiSaveHeroSlide.mockResolvedValue({ id: "s1" });
  apiUpdateHeroSlide.mockResolvedValue({ slide: { id: "s1" } });
  apiDeleteHeroSlide.mockResolvedValue({ message: "deleted" });
  apiReorderHeroSlides.mockResolvedValue({ message: "reordered" });
});

describe("HeroSlidesEditor", () => {
  it("renders slides list with edit and delete actions", async () => {
    renderEditor();

    expect(await screen.findByText("Summer Sale")).toBeVisible();
    expect(screen.getByText("Winter Drop")).toBeVisible();
    expect(screen.getByRole("button", { name: "Edit Summer Sale" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete Summer Sale" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Edit Winter Drop" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete Winter Drop" })).toBeVisible();
  });

  it("blocks save when title is required and missing", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Summer Sale");
    await user.click(screen.getByRole("button", { name: "Edit Summer Sale" }));

    const titleInput = await screen.findByLabelText("Title *");
    await user.clear(titleInput);
    await user.click(screen.getByRole("button", { name: "Save Slide" }));

    await waitFor(() => expect(screen.getByText("Title is required.")).toBeVisible());
    expect(apiSaveHeroSlide).not.toHaveBeenCalled();
    expect(apiUpdateHeroSlide).not.toHaveBeenCalled();
  });

  it("edits through apiUpdateHeroSlide with only the changed fields", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Summer Sale");
    await user.click(screen.getByRole("button", { name: "Edit Summer Sale" }));

    const title = screen.getByLabelText("Title *");
    await user.clear(title);
    await user.type(title, "Summer Mega Sale");
    await user.click(screen.getByRole("button", { name: "Save Slide" }));

    await waitFor(() => expect(apiUpdateHeroSlide).toHaveBeenCalledTimes(1));
    expect(apiUpdateHeroSlide).toHaveBeenCalledWith("s1", {
      id: "s1",
      title: "Summer Mega Sale",
    });
    expect(apiSaveHeroSlide).not.toHaveBeenCalled();
  });

  it("uses the kit ImageField instead of the mislabelled signed_url inputs", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Summer Sale");
    await user.click(screen.getByRole("button", { name: "Edit Summer Sale" }));

    expect(screen.getByText("Background image")).toBeVisible();
    expect(screen.getByText("Product image")).toBeVisible();
    expect(screen.getByText("Fallback image")).toBeVisible();
    expect(screen.queryByText(/signed_url/i)).not.toBeInTheDocument();
  });

  it("clears a hero image with ImageField and sends image_url: null", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Summer Sale");
    await user.click(screen.getByRole("button", { name: "Edit Summer Sale" }));
    await user.click(screen.getByRole("button", { name: "Clear Background image" }));
    await user.click(screen.getByRole("button", { name: "Save Slide" }));

    await waitFor(() => expect(apiUpdateHeroSlide).toHaveBeenCalledTimes(1));
    expect(apiUpdateHeroSlide).toHaveBeenCalledWith("s1", {
      id: "s1",
      bg_image_url: null,
    });
  });

  it("reorders with the complete slide list", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Summer Sale");
    await user.click(screen.getByRole("button", { name: "Move down Summer Sale" }));

    await waitFor(() => expect(apiReorderHeroSlides).toHaveBeenCalledTimes(1));
    expect(apiReorderHeroSlides).toHaveBeenCalledWith([
      { id: "s2", display_order: 0 },
      { id: "s1", display_order: 1 },
    ]);
  });

  it("toggles visibility through apiUpdateHeroSlide", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Summer Sale");
    await user.click(screen.getByRole("button", { name: "Deactivate Summer Sale" }));

    await waitFor(() => expect(apiUpdateHeroSlide).toHaveBeenCalledTimes(1));
    expect(apiUpdateHeroSlide).toHaveBeenCalledWith("s1", { id: "s1", is_active: false });
    expect(apiSaveHeroSlide).not.toHaveBeenCalled();
  });

  it("activates a hidden slide using the value the toggle computed", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Winter Drop");
    await user.click(screen.getByRole("button", { name: "Activate Winter Drop" }));

    // The kit's ActiveToggle hands the next state to onChange; the editor must
    // write that value instead of re-deriving it from the stale row.
    await waitFor(() => expect(apiUpdateHeroSlide).toHaveBeenCalledTimes(1));
    expect(apiUpdateHeroSlide).toHaveBeenCalledWith("s2", { id: "s2", is_active: true });
    expect(apiSaveHeroSlide).not.toHaveBeenCalled();
  });

  it("dispatches marvel_content_updated after a successful write", async () => {
    const user = userEvent.setup();
    const broadcast = captureContentUpdates();
    renderEditor();

    await screen.findByText("Summer Sale");
    await user.click(screen.getByRole("button", { name: "Edit Summer Sale" }));
    const title = screen.getByLabelText("Title *");
    await user.clear(title);
    await user.type(title, "Summer Sale 2");
    await user.click(screen.getByRole("button", { name: "Save Slide" }));

    await waitFor(() => expect(apiUpdateHeroSlide).toHaveBeenCalledTimes(1));
    expect(broadcast).toHaveBeenCalled();
  });

  it("requires confirm before calling delete", async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByText("Summer Sale");
    await user.click(screen.getByRole("button", { name: "Delete Summer Sale" }));

    // Confirm dialog appears; backend delete not called yet.
    expect(await screen.findByText("Delete 'Summer Sale'?")).toBeVisible();
    expect(apiDeleteHeroSlide).not.toHaveBeenCalled();

    const dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(apiDeleteHeroSlide).toHaveBeenCalledTimes(1));
    expect(apiDeleteHeroSlide).toHaveBeenCalledWith("s1");
  });
});
