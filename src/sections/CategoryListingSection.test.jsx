import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CategoryListingSection from "./CategoryListingSection";

vi.mock("../components/ProductCard", () => ({
  default: ({ product, onNavigate }) => (
    <div
      data-testid="product-card"
      tabIndex={onNavigate ? 0 : undefined}
      onClick={() => onNavigate?.(product)}
    >
      {product?.title}
    </div>
  ),
}));

const PRODUCTS = [
  { id: "p1", title: "Product 1", price: 100 },
  { id: "p2", title: "Product 2", price: 200 },
];

describe("CategoryListingSection", () => {
  it("forwards onNavigate to each product card", () => {
    const handleNavigate = vi.fn();
    render(<CategoryListingSection products={PRODUCTS} onNavigate={handleNavigate} />);

    const cards = screen.getAllByTestId("product-card");
    expect(cards).toHaveLength(2);

    cards[0].click();
    expect(handleNavigate).toHaveBeenCalledWith(PRODUCTS[0]);

    cards[1].click();
    expect(handleNavigate).toHaveBeenCalledWith(PRODUCTS[1]);
  });
});
