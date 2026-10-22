import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProductGridSection from "./ProductGridSection";

// The product card needs the cart context, so it is mocked: the grid's own
// behaviour is what this file is about.
vi.mock("../components/ProductCard", () => ({
  default: ({ product }) => <div data-testid="product-card">{product?.title}</div>,
}));

const PRODUCTS = [
  { id: "p1", title: "First product", price: 100 },
  { id: "p2", title: "Second product", price: 200 },
  { id: "p3", title: "Third product", price: 300 },
];

describe("the product grid section", () => {
  it("renders an empty grid for unknown product ids instead of throwing", () => {
    const productIds = ["11111111-1111-4111-8111-111111111111"];

    expect(() =>
      render(<ProductGridSection product_ids={productIds} products={PRODUCTS} />)
    ).not.toThrow();

    expect(screen.queryAllByTestId("product-card")).toHaveLength(0);
  });

  it("renders one card per product", () => {
    render(<ProductGridSection products={PRODUCTS} />);

    expect(screen.getAllByTestId("product-card")).toHaveLength(3);
    expect(screen.getByText("Second product")).toBeVisible();
  });

  it("honours the limit", () => {
    render(<ProductGridSection limit={2} products={PRODUCTS} />);

    expect(screen.getAllByTestId("product-card")).toHaveLength(2);
  });
});
