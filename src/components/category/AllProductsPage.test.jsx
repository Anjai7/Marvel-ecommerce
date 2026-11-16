import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AllProductsPage from "./AllProductsPage";
import { ToastProvider } from "../ui/Toast";
import { CartProvider } from "../../context/CartContext";
import { apiFetchCategoryProducts } from "../../api/backendApi";

vi.mock("../../api/backendApi", () => ({
  apiFetchCategoryProducts: vi.fn(),
  apiFetchProducts: vi.fn(),
}));

const navigateToPath = vi.fn();
vi.mock("../../lib/routes", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, navigateToPath: (...args) => navigateToPath(...args) };
});

const PRODUCT_A = {
  id: "p1",
  title: "Galaxy S24",
  price: 79999,
  rating: 4.6,
  reviews_count: 120,
  image_url: "https://example.com/galaxy.jpg",
};

const listing = (overrides = {}) => ({
  items: [],
  total: 0,
  page: 1,
  pageSize: 24,
  hasMore: false,
  ...overrides,
});

function renderPage() {
  return render(
    <ToastProvider>
      <CartProvider>
        <AllProductsPage onSelectProduct={vi.fn()} />
      </CartProvider>
    </ToastProvider>
  );
}

describe("AllProductsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetchCategoryProducts.mockResolvedValue(listing({ items: [PRODUCT_A], total: 1 }));
  });

  it("asks for the whole catalogue, not for a category", async () => {
    renderPage();

    await waitFor(() => expect(apiFetchCategoryProducts).toHaveBeenCalled());
    const params = apiFetchCategoryProducts.mock.calls[0][0];
    expect(params.scope).toBe("all");
    expect(params.path).toBeUndefined();
  });

  it("lists the products it is given", async () => {
    renderPage();

    expect(await screen.findByText("Galaxy S24")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "All products" })).toBeInTheDocument();
  });

  it("puts the search term in the URL when the form is submitted", async () => {
    const user = userEvent.setup();
    renderPage();

    const input = screen.getByLabelText("Search the catalogue");
    await user.type(input, "shirt");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(navigateToPath).toHaveBeenCalledWith("/products?search=shirt");
  });

  it("shows the term it was opened with", async () => {
    window.history.replaceState(null, "", "/products?search=boots");
    renderPage();

    expect(await screen.findByRole("heading", { name: /Results for/ })).toBeInTheDocument();
    expect(apiFetchCategoryProducts).toHaveBeenCalledWith(
      expect.objectContaining({ search: "boots" })
    );
  });
});
