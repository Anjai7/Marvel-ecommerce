import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ProductCard from "../ProductCard";
import { ToastProvider } from "../ui/Toast";
import { CartProvider } from "../../context/CartContext";

function renderCard(product) {
  const { container } = render(
    <ToastProvider>
      <CartProvider>
        <ProductCard product={product} />
      </CartProvider>
    </ToastProvider>
  );
  return container;
}

const PRODUCT = {
  id: "p1",
  title: "Trail Shoe",
  price: "1499.00",
  original_price: "1999.00",
  rating: 4.2,
  reviews_count: 12,
  image_url: "https://cdn.example.com/shoe.jpg",
};

describe("ProductCard", () => {
  it("shows no offer label when the product has no offer_text", () => {
    const container = renderCard(PRODUCT);

    expect(container.querySelector(".product-card-offer-label")).toBeNull();
    expect(screen.queryByText(/SPECIAL DEAL/)).not.toBeInTheDocument();
  });

  it("shows the stored offer_text as a label", () => {
    const container = renderCard({ ...PRODUCT, offer_text: "Bank offer available" });

    expect(container.querySelector(".product-card-offer-label")).not.toBeNull();
    expect(screen.getByText("Bank offer available")).toBeInTheDocument();
  });

  it("shortens an offer that is a sentence to the words a label can hold", () => {
    renderCard({ ...PRODUCT, offer_text: "No Cost EMI from \u20b924,249.65/Month" });

    // The label says the offer's name; the figure stays with the price.
    expect(screen.getByText("No Cost EMI")).toBeInTheDocument();
    expect(screen.queryByText(/24,249.65/)).not.toBeInTheDocument();
  });

  it("uses only the stored rating and discount", () => {
    renderCard({ id: "p2", title: "Plain Shoe", price: "1000" });

    expect(screen.queryByText("4.8")).not.toBeInTheDocument();
    expect(screen.queryByText("24")).not.toBeInTheDocument();
    expect(screen.queryByText(/OFF/)).not.toBeInTheDocument();
  });
});
