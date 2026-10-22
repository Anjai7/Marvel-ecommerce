import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CategoryListing from "./CategoryListing";
import { ToastProvider } from "../ui/Toast";
import { CartProvider } from "../../context/CartContext";
import { apiFetchCategoryProducts } from "../../api/backendApi";

// The api module is mocked wholesale: every export the component tree pulls
// in has to be listed here.
vi.mock("../../api/backendApi", () => ({
  apiFetchCategoryProducts: vi.fn(),
  apiFetchProducts: vi.fn(),
}));

const PRODUCT_A = {
  id: "p1",
  title: "Galaxy S24",
  price: 79999,
  rating: 4.6,
  reviews_count: 120,
  image_url: "https://example.com/galaxy.jpg",
};

const PRODUCT_B = {
  id: "p2",
  title: "Pixel 9",
  price: 69999,
  rating: 4.4,
  reviews_count: 87,
  image_url: "https://example.com/pixel.jpg",
};

const listing = (overrides = {}) => ({
  items: [],
  total: 0,
  page: 1,
  pageSize: 24,
  hasMore: false,
  ...overrides,
});

const renderListing = (props = {}) =>
  render(
    <ToastProvider>
      <CartProvider>
        <CategoryListing path="electronics/mobiles" {...props} />
      </CartProvider>
    </ToastProvider>
  );

describe("CategoryListing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a card for each product", async () => {
    apiFetchCategoryProducts.mockResolvedValue(
      listing({ items: [PRODUCT_A, PRODUCT_B], total: 2, hasMore: false })
    );

    const { container } = renderListing();

    expect(await screen.findByText("Galaxy S24")).toBeVisible();
    expect(screen.getByText("Pixel 9")).toBeVisible();
    expect(container.querySelectorAll(".product-card")).toHaveLength(2);
  });

  it("shows the empty state when there are no products", async () => {
    apiFetchCategoryProducts.mockResolvedValue(listing({ items: [], total: 0 }));

    const { container } = renderListing();

    expect(await screen.findByText("No products in this category yet.")).toBeVisible();
    expect(container.querySelectorAll(".product-card")).toHaveLength(0);
  });

  it("renders the pagination control when there are more pages", async () => {
    apiFetchCategoryProducts.mockResolvedValue(
      listing({ items: [PRODUCT_A], total: 48, page: 1, pageSize: 24, hasMore: true })
    );

    renderListing({ config: { pageSize: 24 } });

    const next = await screen.findByRole("button", { name: /next/i });
    expect(next).toBeVisible();
    expect(next).toBeEnabled();
    expect(screen.getByText("Page 1 of 2")).toBeVisible();
  });

  it("calls apiFetchCategoryProducts with the configured sort", async () => {
    apiFetchCategoryProducts.mockResolvedValue(listing());

    renderListing({ config: { sort: "price_asc" } });

    await waitFor(() => expect(apiFetchCategoryProducts).toHaveBeenCalled());
    expect(apiFetchCategoryProducts).toHaveBeenCalledWith(
      expect.objectContaining({ path: "electronics/mobiles", sort: "price_asc" })
    );
  });

  it("hides the sort control unless showSort is true", async () => {
    apiFetchCategoryProducts.mockResolvedValue(listing({ items: [PRODUCT_A] }));
    const { rerender } = renderListing({ config: {} });
    expect(await screen.findByText("Galaxy S24")).toBeVisible();
    expect(screen.queryByLabelText("Sort by")).toBeNull();

    rerender(
      <ToastProvider>
        <CartProvider>
          <CategoryListing path="electronics/mobiles" config={{ showSort: true }} />
        </CartProvider>
      </ToastProvider>
    );
    expect(screen.getByLabelText("Sort by")).toBeVisible();
  });

  it("hides the filter controls unless showFilters is true", async () => {
    apiFetchCategoryProducts.mockResolvedValue(listing({ items: [PRODUCT_A] }));
    const { rerender } = renderListing({ config: {} });
    expect(await screen.findByText("Galaxy S24")).toBeVisible();
    expect(screen.queryByLabelText("In stock only")).toBeNull();
    expect(screen.queryByLabelText("Min price")).toBeNull();

    rerender(
      <ToastProvider>
        <CartProvider>
          <CategoryListing path="electronics/mobiles" config={{ showFilters: true }} />
        </CartProvider>
      </ToastProvider>
    );
    expect(screen.getByLabelText("In stock only")).toBeVisible();
  });

  it("renders the list layout when config.layout is list", async () => {
    apiFetchCategoryProducts.mockResolvedValue(listing({ items: [PRODUCT_A] }));
    const { container } = renderListing({ config: { layout: "list" } });
    expect(await screen.findByText("Galaxy S24")).toBeVisible();
    expect(container.querySelector(".product-grid--list")).not.toBeNull();
  });

  it("renders the grid layout when config.layout is grid", async () => {
    apiFetchCategoryProducts.mockResolvedValue(listing({ items: [PRODUCT_A] }));
    const { container } = renderListing({ config: { layout: "grid" } });
    expect(await screen.findByText("Galaxy S24")).toBeVisible();
    expect(container.querySelector(".product-grid")).not.toBeNull();
    expect(container.querySelector(".product-grid--list")).toBeNull();
  });
});
