import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import HeroSlidesEditor from "./HeroSlidesEditor";
import { ToastProvider } from "../ui/Toast";
import { apiFetchHeroSlides, apiSaveHeroSlide, apiDeleteHeroSlide } from "../../api/contentApi";

vi.mock("../../api/contentApi", () => ({
  apiFetchHeroSlides: vi.fn(),
  apiSaveHeroSlide: vi.fn(),
  apiDeleteHeroSlide: vi.fn(),
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
    price_text: "$99",
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

beforeEach(() => {
  vi.clearAllMocks();
  apiFetchHeroSlides.mockResolvedValue({ slides: [...SLIDES] });
  apiSaveHeroSlide.mockResolvedValue({ id: "s1" });
  apiDeleteHeroSlide.mockResolvedValue({ message: "deleted" });
});

describe("HeroSlidesEditor", () => {
  it("renders slides list with edit and delete actions", async () => {
    render(<HeroSlidesEditor />);

    expect(await screen.findByText("Summer Sale")).toBeVisible();
    expect(screen.getByText("Winter Drop")).toBeVisible();
    expect(screen.getByRole("button", { name: "Edit Summer Sale" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete Summer Sale" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Edit Winter Drop" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete Winter Drop" })).toBeVisible();
  });

  it("blocks save when title is required and missing", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <HeroSlidesEditor />
      </ToastProvider>
    );

    await screen.findByText("Summer Sale");
    await user.click(screen.getByRole("button", { name: "Edit Summer Sale" }));

    const titleInput = await screen.findByLabelText("Title *");
    await user.clear(titleInput);
    await user.click(screen.getByRole("button", { name: "Save Slide" }));

    await waitFor(() => expect(screen.getByText("Title is required.")).toBeVisible());
    expect(apiSaveHeroSlide).not.toHaveBeenCalled();
  });

  it("requires confirm before calling delete", async () => {
    const user = userEvent.setup();
    render(<HeroSlidesEditor />);

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
