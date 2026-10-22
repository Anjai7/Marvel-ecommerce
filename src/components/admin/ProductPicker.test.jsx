import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductPicker from "./ProductPicker";
import { apiFetchProducts } from "../../api/backendApi";

vi.mock("../../api/backendApi", () => ({
  apiFetchProducts: vi.fn(),
}));

describe("ProductPicker", () => {
  const sampleProducts = [
    {
      id: "prod-1",
      title: "Iron Man Helmet",
      price: 1999,
      image_url: "https://example.com/iron.jpg",
    },
    {
      id: "prod-2",
      title: "Captain America Shield",
      price: 2999,
      image_url: "https://example.com/shield.jpg",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("searches the api for products as the admin types", async () => {
    const user = userEvent.setup();
    apiFetchProducts.mockResolvedValueOnce(sampleProducts);

    render(<ProductPicker value={[]} onChange={vi.fn()} />);

    const searchInput = screen.getByLabelText("Search products");
    await user.type(searchInput, "Iron");

    await waitFor(() => {
      expect(apiFetchProducts).toHaveBeenCalledWith({ search: "Iron" });
    });
    expect(await screen.findByText("Iron Man Helmet")).toBeInTheDocument();
  });

  it("adds a product to the selection", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    apiFetchProducts.mockResolvedValueOnce(sampleProducts);

    render(<ProductPicker value={[]} onChange={handleChange} />);

    const searchInput = screen.getByLabelText("Search products");
    await user.type(searchInput, "Iron");

    const addButton = await screen.findByRole("button", { name: "Add Iron Man Helmet" });
    await user.click(addButton);

    expect(handleChange).toHaveBeenCalledWith(["prod-1"]);
  });

  it("removes a product from the selection", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<ProductPicker value={["prod-1", "prod-2"]} onChange={handleChange} />);

    expect(screen.getByText("prod-1")).toBeInTheDocument();
    const removeButton = screen.getByRole("button", { name: "Remove product prod-1" });
    await user.click(removeButton);

    expect(handleChange).toHaveBeenCalledWith(["prod-2"]);
  });

  it("shows the empty state when the search returns nothing", async () => {
    const user = userEvent.setup();
    apiFetchProducts.mockResolvedValueOnce([]);

    render(<ProductPicker value={[]} onChange={vi.fn()} />);

    const searchInput = screen.getByLabelText("Search products");
    await user.type(searchInput, "Nonexistent");

    await waitFor(() => {
      expect(apiFetchProducts).toHaveBeenCalledWith({ search: "Nonexistent" });
    });

    expect(await screen.findByText('No products found for "Nonexistent".')).toBeInTheDocument();
  });
});
