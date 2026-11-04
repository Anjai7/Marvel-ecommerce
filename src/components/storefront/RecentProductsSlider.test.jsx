import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import RecentProductsSlider from "./RecentProductsSlider";
import { apiFetchProducts } from "../../api/backendApi";
import { CartProvider } from "../../context/CartContext";
import { ToastProvider } from "../ui/Toast";
import { SettingsProvider } from "../../context/SettingsContext";

vi.mock("../../api/backendApi", () => ({
  apiFetchProducts: vi.fn(),
  apiFetchSettings: vi.fn().mockResolvedValue({
    settings: {
      recent_products_slider: {
        enabled: true,
        title: "Recent Additions",
        subtitle: "Handpicked new arrivals",
        product_ids: ["p1", "p2"],
      },
    },
  }),
}));

vi.mock("../../api/settingsApi", () => ({
  apiFetchSettings: vi.fn().mockResolvedValue({
    settings: {
      recent_products_slider: {
        enabled: true,
        title: "Recent Additions",
        subtitle: "Handpicked new arrivals",
        product_ids: ["p1", "p2"],
      },
    },
  }),
  apiUpdateSettings: vi.fn(),
}));

const MOCK_PRODUCTS = [
  {
    id: "p1",
    title: "Iron Man Mark LXXXV",
    price: 4999,
    image_url: "https://example.com/ironman.jpg",
    category: "Collectibles",
    stock: 10,
    moderation_status: "approved",
  },
  {
    id: "p2",
    title: "Infinity Gauntlet Replica",
    price: 9999,
    image_url: "https://example.com/gauntlet.jpg",
    category: "Replicas",
    stock: 5,
    moderation_status: "approved",
  },
  {
    id: "p3",
    title: "Mjolnir Metal Edition",
    price: 3499,
    image_url: "https://example.com/mjolnir.jpg",
    category: "Accessories",
    stock: 8,
    moderation_status: "approved",
  },
];

const renderComponent = () =>
  render(
    <ToastProvider>
      <CartProvider>
        <SettingsProvider>
          <RecentProductsSlider />
        </SettingsProvider>
      </CartProvider>
    </ToastProvider>
  );

describe("RecentProductsSlider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetchProducts.mockResolvedValue([...MOCK_PRODUCTS]);
  });

  it("renders the recent products slider with title and navigation", async () => {
    renderComponent();

    expect(await screen.findByText("Recent Additions")).toBeVisible();
    expect(screen.getByText("Handpicked new arrivals")).toBeVisible();
    expect(await screen.findByText("Iron Man Mark LXXXV")).toBeVisible();
    expect(screen.getByText("Infinity Gauntlet Replica")).toBeVisible();
  });

  it("has navigation buttons for horizontal sliding", async () => {
    renderComponent();

    expect(await screen.findByRole("button", { name: "Previous products" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next products" })).toBeInTheDocument();
  });

  it("handles empty products list gracefully", async () => {
    apiFetchProducts.mockResolvedValue([]);
    renderComponent();

    expect(await screen.findByText("No recent products selected yet")).toBeVisible();
  });
});
